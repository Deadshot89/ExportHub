import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const source=require.resolve('../api/pickup-transport-reconcile/index.js');
function fixture(options={}){
 const calls={runs:[],team:0};
 const user={id:'PLANNER-1',companyId:'essentra',rights:{
  pickupcalendar:{level:'view'},planning:{level:'edit'},shipment:{level:'view'}
 }};
 const auth={
  json(status,data){return{status,body:JSON.stringify(data)}},
  error(code,message,status){return Object.assign(new Error(message),{code,status})},
  body(req){return req.body||{}},
  async validateSession(req){if(req.headers?.authorization!=='Bearer valid')
   throw auth.error('AUTH_REQUIRED','Not authorized',401);
   return{user:req.user||user}},
  environmentFromRequest(req){return req.headers.host.includes('-testservice.')?'testservice':'production'},
  async clientsForEnvironment(env){calls.team++;return{team:{env}}},
  async readJson(){return{value:{state:{tasks:[{id:'TASK-UK'}],shipments:[{id:'ID-REF-A',reference:'REF-A'}]}}}},
  emptyTeam(){return{state:{}}}
 };
 const rights={
  canReadAny(u,modules){return modules.some(k=>['view','edit'].includes(u.rights?.[k]?.level))},
  canEditAny(u,modules){return modules.some(k=>u.rights?.[k]?.level==='edit')}
 };
 const companies={resolveCompanyContext(req,u){
  const cid=req.headers['x-exporthub-company-id']||u.companyId;
  if(cid!=='essentra')throw auth.error('COMPANY_FORBIDDEN','Forbidden',403);
  return{companyKey:cid};
 }};
 const fixed={resolveEnvironment(req,body){
  const e=req.headers.host.includes('-testservice.')?'testservice':'production';
  if(body.environment&&body.environment!==e)
   throw auth.error('ENVIRONMENT_MISMATCH','Wrong environment',409);
  return e;
 }};
 const service={async reconcile(args){calls.runs.push(args);
  if(options.fail)throw options.fail;
  return{pickupDate:args.pickupDate,verifiedTransports:1,
   added:args.pickupDate==='2026-11-09'?['REF-A','REF-B']:['REF-C'],conflicts:[]};
 }};
 const stub={
  '../shared/auth-store':auth,'../shared/fast-auth-store':{isSource:()=>true,validateSession:auth.validateSession},
  '../shared/company-context':companies,'../shared/state-write-guard':rights,
  '../shared/fixed-pickup-store':fixed,
  '../shared/public-access-store':{},'../shared/pickup-store':{},
  '../shared/pickup-transport-binding-store':{},'../shared/pickup-transport-link-store':{},
  '../shared/pickup-transport-registration-proof':{},'../shared/pickup-transport-reconcile':service,
  '../shared/i18n':{t:()=>'Cannot reconcile pickups'}
 };
 const old=Module._load;
 Module._load=function(name,parent,isMain){if(parent?.filename===source&&Object.hasOwn(stub,name))return stub[name];
  return old.call(this,name,parent,isMain)};
 delete require.cache[source];let handler;
 try{handler=require(source)}finally{Module._load=old}
 const request=(overrides={})=>({method:'POST',headers:{
  host:'warehouse-testservice.westeurope.6.azurestaticapps.net',authorization:'Bearer valid'
 },body:{pickupDate:'2026-11-09'},user,...overrides});
 const invoke=async req=>{const ctx={};await handler(ctx,req);return{status:ctx.res.status,data:JSON.parse(ctx.res.body),body:ctx.res.body}};
 return{request,invoke,calls,user};
}
test('authenticated planning editor can reconcile a date with server-only sources',async()=>{
 const {request,invoke,calls}=fixture();
 const r=await invoke(request());
 assert.equal(r.status,200);assert.equal(r.data.totalAdded,2);
 assert.equal(calls.team,1);assert.equal(calls.runs.length,1);
 assert.equal(calls.runs[0].companyKey,'essentra');
 assert.equal(calls.runs[0].environment,'testservice');
 assert.equal(calls.runs[0].actor,'PLANNER-1');
 assert.equal(calls.runs[0].team.state.shipments[0].id,'ID-REF-A');
});
test('up to five unique dates are processed after one authoritative team read',async()=>{
 const {request,invoke,calls}=fixture();
 const r=await invoke(request({body:{dates:['2026-11-09','2026-11-16','2026-11-09']}}));
 assert.equal(r.status,200);assert.equal(r.data.reports.length,2);
 assert.equal(r.data.totalAdded,3);assert.equal(calls.team,1);assert.equal(calls.runs.length,2);
});
test('requests with too many dates, non-ISO or invalid date types fail before reading data',async()=>{
 const {request,invoke,calls}=fixture();
 for(const body of [
  {dates:[]},{dates:['2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-13','2026-11-16']},
  {dates:['invalid']},{dates:[null]},{pickupDate:5}
 ]){
  const r=await invoke(request({body}));assert.equal(r.status,400);
 }
 assert.equal(calls.team,0);assert.equal(calls.runs.length,0);
});
test('anonymous browser does not access team or reconciliation',async()=>{
 const {request,invoke,calls}=fixture();
 const r=await invoke(request({headers:{host:'warehouse-testservice.westeurope.6.azurestaticapps.net'}}));
 assert.equal(r.status,401);assert.equal(calls.runs.length,0);assert.equal(calls.team,0);
});
test('view-only calendar user cannot write automatic associations',async()=>{
 const {request,invoke,calls,user}=fixture();
 const readOnly={...user,rights:{pickupcalendar:{level:'view'},planning:{level:'view'},
   shipment:{level:'view'}}};
 const r=await invoke(request({user:readOnly}));
 assert.equal(r.status,403);assert.equal(calls.runs.length,0);
});
test('shipment read and calendar view are both necessary for reconciliation',async()=>{
 const {request,invoke,calls,user}=fixture();
 for(const rights of [
  {pickupcalendar:{level:'none'},planning:{level:'edit'},shipment:{level:'view'}},
  {pickupcalendar:{level:'view'},planning:{level:'edit'},shipment:{level:'none'}}
 ]){
  const r=await invoke(request({user:{...user,rights}}));assert.equal(r.status,403);
 }
 assert.equal(calls.team,0);assert.equal(calls.runs.length,0);
});
test('cross-tenant and TESTSERVICE-to-production request hacks are blocked',async()=>{
 const {request,invoke,calls}=fixture();
 const tenant=await invoke(request({headers:{
  host:'warehouse-testservice.westeurope.6.azurestaticapps.net',authorization:'Bearer valid',
  'x-exporthub-company-id':'foreign'
 }}));
 assert.equal(tenant.status,403);
 const env=await invoke(request({body:{pickupDate:'2026-11-09',environment:'production'}}));
 assert.equal(env.status,409);assert.equal(calls.runs.length,0);
});
test('unexpected Azure and backend failures never leak sensitive paths or keys',async()=>{
 const e=Object.assign(new Error('AccountKey=PRIVATE_SECRET /srv/azure/internal'),
   {code:'AZURE_BLOB_AUTH',statusCode:500});
 const {request,invoke}=fixture({fail:e});
 const r=await invoke(request());
 assert.equal(r.status,500);assert.equal(r.data.code,'PICKUP_TRANSPORT_RECONCILE_FAILED');
 assert.doesNotMatch(r.body,/AccountKey|PRIVATE_SECRET|\/srv|AZURE_BLOB_AUTH/i);
});
test('unknown methods do not change any team or link state',async()=>{
 const {request,invoke,calls}=fixture();
 assert.equal((await invoke(request({method:'GET'}))).status,405);
 assert.equal((await invoke(request({method:'DELETE'}))).status,405);
 assert.equal((await invoke(request({method:'OPTIONS'}))).status,204);
 assert.equal(calls.team,0);assert.equal(calls.runs.length,0);
});
test('caller-provided fake REF and transport data cannot replace trusted state',async()=>{
 const {request,invoke,calls}=fixture();
 const r=await invoke(request({body:{pickupDate:'2026-11-09',
  transports:[{registered:true,id:'FAKE'}],shipments:[{reference:'FAKE'}],tasks:[]}}));
 assert.equal(r.status,200);
 assert.equal(calls.runs[0].team.state.shipments[0].reference,'REF-A');
 assert.equal(calls.runs[0].shipments,undefined);
});
