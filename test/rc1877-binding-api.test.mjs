import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const source=require.resolve('../api/pickup-transport-bindings/index.js');
function fixture(options={}){
 const calls={proof:[],reads:[],writes:[],teams:[],reconciles:[],auth:0};
 const user={id:'PLANNER-1',companyId:'essentra',rights:{
  pickupcalendar:{level:'view'},planning:{level:'edit'},shipment:{level:'view'}
 }};
 const auth={
  error(code,message,status){return Object.assign(new Error(message),{code,status})},
  json(status,data){return{status,headers:{'Cache-Control':'no-store'},body:JSON.stringify(data)}},
  body(req){return req.body||{}},
  async validateSession(req){calls.auth++;if(req.headers?.authorization!=='Bearer valid')
    throw auth.error('AUTH_REQUIRED','Not authorized',401);
    return{user:req.user||user,team:{state:{shipments:[]}}};
  },
  environmentFromRequest(req){return req.headers?.host?.includes('-testservice.')?'testservice':'production'},
  async clientsForEnvironment(env){calls.teams.push(env);return{team:{environment:env}}},
  async readJson(){return{value:{state:{shipments:[{id:'MAIN-UK',reference:'REF-UK'}]}}}},
  emptyTeam(){return{state:{}}}
 };
 const company={resolveCompanyContext(req,currentUser){
  const requested=req.headers?.['x-exporthub-company-id']||currentUser.companyId;
  if(requested!=='essentra')throw auth.error('COMPANY_FORBIDDEN','Forbidden',403);
  return{companyKey:requested};
 }};
 const rights={
  canReadAny(u,modules){return modules.some(id=>['view','edit','admin'].includes(u.rights?.[id]?.level))},
  canEditAny(u,modules){return modules.some(id=>['edit','admin'].includes(u.rights?.[id]?.level))}
 };
 const fixed={resolveEnvironment(req,payload){
   const host=req.headers?.host||'',environment=host.includes('-testservice.')?'testservice':'production';
   if(payload.environment&&payload.environment!==environment)
    throw auth.error('ENVIRONMENT_MISMATCH','Wrong environment',409);
   return environment;
 }};
 const fast={isSource:()=>true,validateSession:auth.validateSession};
 const bindingStore={
  async read(scope,options){calls.reads.push({scope,options});if(options?.storageError)throw options.storageError;
   return{revision:2,...scope,bindings:[{shipmentId:'MAIN-UK',reference:'REF-UK',pickupTargetId:'FIX-UK'}],
    ...(options?.includeAudit?{audit:[{action:'bind-main',by:'PLANNER-1'}]}:{})}},
  async applyBinding(params){calls.writes.push(params);
   if(options.failWrite)throw options.failWrite;
   return{changed:true,revision:3,bindings:[{shipmentId:'MAIN-UK',reference:'REF-UK',pickupTargetId:'FIX-UK'}]}}
 };
 const proof={
  async inspect(params){calls.proof.push(params);if(options.failProof)throw options.failProof;
   return{id:'MAIN-UK',shipmentId:'MAIN-UK',reference:'REF-UK',pickupDate:'2026-11-09',
      pickupTargetId:'FIX-UK',companyKey:'essentra',environment:'testservice',registered:true}}
 };
 const reconcileService={async reconcile(args){
  calls.reconciles.push(args);
  if(options.failReconcile)throw options.failReconcile;
  return{pickupDate:args.pickupDate,verifiedTransports:1,added:['REF-A','REF-B'],conflicts:[],changed:true};
 }};
 const stubs={
  '../shared/auth-store':auth,'../shared/fast-auth-store':fast,
  '../shared/company-context':company,'../shared/state-write-guard':rights,
  '../shared/fixed-pickup-store':fixed,'../shared/public-access-store':{},
  '../shared/pickup-store':{},'../shared/pickup-transport-registration-proof':proof,
  '../shared/pickup-transport-binding-store':bindingStore,
  '../shared/pickup-transport-link-store':{},
  '../shared/pickup-transport-reconcile':reconcileService,
  '../shared/i18n':{t:()=>'Could not load pickup assignments'}
 };
 const original=Module._load;
 Module._load=function(name,parent,isMain){
  if(parent?.filename===source&&Object.hasOwn(stubs,name))return stubs[name];
  return original.call(this,name,parent,isMain);
 };
 delete require.cache[source];
 let handler;try{handler=require(source)}finally{Module._load=original}
 const request=(overrides={})=>({
  method:'POST',
  headers:{host:'warehouse-testservice.westeurope.6.azurestaticapps.net',authorization:'Bearer valid'},
  body:{shipmentId:'MAIN-UK',pickupTargetId:'FIX-UK',pickupDate:'2026-11-09',
    expectedRevision:2},user,...overrides
 });
 const invoke=async req=>{const ctx={};await handler(ctx,req);return{...ctx.res,data:JSON.parse(ctx.res.body)}};
 return{request,invoke,calls,user};
}
test('planning editor with shipment view (not FIX admin) can link a verified main shipment',async()=>{
 const {request,invoke,calls}=fixture();
 const r=await invoke(request());
 assert.equal(r.status,200);assert.equal(r.data.revision,3);assert.equal(calls.writes.length,1);
 assert.equal(calls.writes[0].proof.registered,true);
 assert.equal(calls.writes[0].actor,'PLANNER-1');
 assert.equal(calls.writes[0].expectedRevision,2);
 assert.equal(calls.proof.length,1);assert.equal(calls.proof[0].permitNewBinding,true);
 assert.equal(calls.reconciles.length,1);
 assert.deepEqual(calls.reconciles[0].team.state.shipments,[{id:'MAIN-UK',reference:'REF-UK'}]);
 assert.deepEqual(r.data.reconciliation.added,['REF-A','REF-B']);
 assert.equal(calls.proof[0].team.state.shipments[0].id,'MAIN-UK');
 assert.deepEqual(calls.teams,['testservice']);
});
test('GET loads current persisted binding without requiring a FIX admin permission',async()=>{
 const {request,invoke,calls}=fixture();
 const r=await invoke(request({method:'GET',body:{},query:{}}));
 assert.equal(r.status,200);assert.equal(r.data.revision,2);assert.equal(r.data.canEdit,true);
 assert.equal(r.data.audit,undefined);assert.equal(calls.proof.length,0);
 assert.equal(calls.writes.length,0);
});
test('a read-only calendar user can read but never write a binding',async()=>{
 const {request,invoke,calls,user}=fixture();
 const viewer={...user,rights:{pickupcalendar:{level:'view'},planning:{level:'view'},
  shipment:{level:'view'}}};
 const read=await invoke(request({method:'GET',body:{},user:viewer}));
 assert.equal(read.status,200);assert.equal(read.data.canEdit,false);
 const write=await invoke(request({user:viewer}));
 assert.equal(write.status,403);assert.equal(write.data.code,'PICKUP_LINK_WRITE_FORBIDDEN');
 assert.equal(calls.writes.length,0);assert.equal(calls.proof.length,0);
});
test('planning edit alone is insufficient without shipment viewing rights',async()=>{
 const {request,invoke,calls,user}=fixture();
 const denied={...user,rights:{pickupcalendar:{level:'view'},planning:{level:'edit'},
  shipment:{level:'none'}}};
 const r=await invoke(request({user:denied}));
 assert.equal(r.status,403);assert.equal(calls.proof.length,0);
});
test('calendar read permission is needed even with planning permissions',async()=>{
 const {request,invoke,calls,user}=fixture();
 const denied={...user,rights:{pickupcalendar:{level:'none'},planning:{level:'edit'},
  shipment:{level:'view'}}};
 const r=await invoke(request({user:denied}));
 assert.equal(r.status,403);assert.equal(calls.proof.length,0);
});
test('no session means no team state, proof or storage access',async()=>{
 const {request,invoke,calls}=fixture();
 const r=await invoke(request({headers:{host:'warehouse-testservice.westeurope.6.azurestaticapps.net'}}));
 assert.equal(r.status,401);assert.equal(calls.proof.length,0);
 assert.equal(calls.writes.length,0);assert.equal(calls.teams.length,0);
});
test('foreign company cannot be chosen through forged company header',async()=>{
 const {request,invoke,calls}=fixture();
 const r=await invoke(request({headers:{host:'warehouse-testservice.westeurope.6.azurestaticapps.net',
  authorization:'Bearer valid','x-exporthub-company-id':'foreign-company'}}));
 assert.equal(r.status,403);assert.equal(calls.writes.length,0);
 assert.equal(calls.teams.length,0);
});
test('production cannot be targeted from TESTSERVICE by forged environment',async()=>{
 const {request,invoke,calls}=fixture();
 const r=await invoke(request({body:{shipmentId:'MAIN-UK',pickupTargetId:'FIX-UK',
  pickupDate:'2026-11-09',environment:'production',expectedRevision:2}}));
 assert.equal(r.status,409);assert.equal(r.data.code,'ENVIRONMENT_MISMATCH');
 assert.equal(calls.teams.length,0);assert.equal(calls.proof.length,0);
});
test('incomplete IDs/date/revision are blocked before any authoritative team download',async()=>{
 const {request,invoke,calls}=fixture();
 for(const bad of [
  {shipmentId:'',pickupTargetId:'FIX-UK',pickupDate:'2026-11-09',expectedRevision:2},
  {shipmentId:'MAIN-UK',pickupTargetId:'',pickupDate:'2026-11-09',expectedRevision:2},
  {shipmentId:'MAIN-UK',pickupTargetId:'FIX-UK',pickupDate:'invalid',expectedRevision:2},
  {shipmentId:'MAIN-UK',pickupTargetId:'FIX-UK',pickupDate:'2026-11-09',expectedRevision:'2'}
 ]){
  const r=await invoke(request({body:bad}));
  assert.equal(r.status,400);
 }
 assert.equal(calls.teams.length,0);assert.equal(calls.writes.length,0);
});
test('browser-supplied fake registered proof is never forwarded to the storage layer',async()=>{
 const {request,invoke,calls}=fixture();
 const r=await invoke(request({body:{shipmentId:'MAIN-UK',pickupTargetId:'FIX-UK',
  pickupDate:'2026-11-09',expectedRevision:2,proof:{id:'UNTRUSTED',registered:true},
  actor:'SUPERADMIN',reason:'Browser provided reason'}}));
 assert.equal(r.status,200);
 assert.equal(calls.writes[0].proof.id,'MAIN-UK');
 assert.equal(calls.writes[0].actor,'PLANNER-1');
});
test('unverified main pickup fails closed without saving any binding',async()=>{
 const e=Object.assign(new Error('not registered'),{code:'TRANSPORT_NOT_REGISTERED',status:409});
 const {request,invoke,calls}=fixture({failProof:e});
 const r=await invoke(request());
 assert.equal(r.status,409);assert.equal(r.data.code,'TRANSPORT_NOT_REGISTERED');
 assert.equal(calls.writes.length,0);
});
test('stale ETag/revision conflict returns an error and never reports success',async()=>{
 const e=Object.assign(new Error('ETag conflict'),{code:'BINDING_CONCURRENT_UPDATE',status:409});
 const {request,invoke,calls}=fixture({failWrite:e});
 const r=await invoke(request());
 assert.equal(r.status,409);assert.equal(r.data.code,'BINDING_CONCURRENT_UPDATE');
 assert.equal(calls.writes.length,1);
});
test('raw secrets and internal paths from storage failures cannot leak to HTTP',async()=>{
 const e=Object.assign(new Error('AccountKey=PRIVATE-SECRET /srv/azure/path'),{code:'BlobForbidden',statusCode:403});
 const {request,invoke}=fixture({failWrite:e});
 const r=await invoke(request());
 assert.equal(r.status,403);assert.equal(r.data.code,'PICKUP_TRANSPORT_BINDING_FAILED');
 assert.doesNotMatch(r.body,/PRIVATE-SECRET|AccountKey|\/srv|BlobForbidden/i);
});
test('GET audit trail is restricted to planning editors with shipment viewing rights',async()=>{
 const {request,invoke,calls,user}=fixture();
 const read=await invoke(request({method:'GET',body:{},query:{includeAudit:'1'}}));
 assert.equal(read.status,200);assert.equal(read.data.audit.length,1);
 const viewer={...user,rights:{pickupcalendar:{level:'view'},planning:{level:'view'},
  shipment:{level:'view'}}};
 const other=await invoke(request({method:'GET',body:{},query:{includeAudit:'1'},user:viewer}));
 assert.equal(other.status,200);assert.equal(other.data.audit,undefined);
 assert.equal(calls.reads[1].options.includeAudit,false);
});
test('unrecognized HTTP write methods are rejected without side effects',async()=>{
 const {request,invoke,calls}=fixture();
 assert.equal((await invoke(request({method:'DELETE'}))).status,405);
 assert.equal((await invoke(request({method:'OPTIONS'}))).status,204);
 assert.equal(calls.teams.length,0);assert.equal(calls.writes.length,0);
});
test('a failed REF refresh reports pending but retains the successful main binding',async()=>{
 const failure=Object.assign(new Error('Azure unavailable'),{code:'STORAGE_UNAVAILABLE'});
 const {request,invoke,calls}=fixture({failReconcile:failure});
 const r=await invoke(request());
 assert.equal(r.status,200);
 assert.equal(r.data.ok,true);assert.equal(r.data.revision,3);
 assert.equal(r.data.reconciliation.status,'pending');
 assert.equal(r.data.reconciliation.code,'RECONCILE_RETRY_REQUIRED');
 assert.equal(calls.writes.length,1);assert.equal(calls.reconciles.length,1);
});
test('a denied write cannot trigger automatic REF association',async()=>{
 const {request,invoke,calls,user}=fixture();
 const viewer={...user,rights:{pickupcalendar:{level:'view'},
   planning:{level:'view'},shipment:{level:'view'}}};
 const r=await invoke(request({user:viewer}));
 assert.equal(r.status,403);assert.equal(calls.reconciles.length,0);
});
