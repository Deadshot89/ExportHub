import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const baseUser={id:'OP1',role:'user',companyId:'essentra',rights:{pickupcalendar:{level:'view',read:true}}};
function setup(options={}){
 const reads=[],proofCalls=[],source=require.resolve('../api/pickup-transport-links/index.js');
 const auth={
   json(status,payload,headers={}){return{status,headers:{'Cache-Control':'no-store',...headers},body:JSON.stringify(payload)}},
   error(code,message,status){return Object.assign(new Error(message),{code,status})},
   async validateSession(req){if(!req.headers||req.headers.authorization!=='Bearer valid')throw auth.error('AUTH_REQUIRED','Login fehlt',401);return{user:req.user||baseUser,team:{state:{shipments:[{id:'MAIN-UK',reference:'UK-REF'}]}}}}
 };
 auth.clientsForEnvironment=async environment=>({team:{environment}});
 auth.readJson=async()=>({value:{state:{shipments:[{id:'MAIN-UK',reference:'UK-REF'}]}}});
 auth.emptyTeam=()=>({state:{}});
 const fast={isSource:()=>true,validateSession:auth.validateSession};
 const ledger={async read(scope,readOptions){reads.push({scope,options:readOptions});if(options.storageError)throw options.storageError;return{
   environment:scope.environment,companyKey:scope.companyKey,revision:4,
   links:[{ref:'REF-A',pickupDate:'2026-11-09',transportId:'TRANSPORT-UK',active:true}],
   manualExclusions:[],...(readOptions.includeAudit?{audit:[{action:'manual-link',by:'Operator'}]}:{})
 }}};
 const registrationProof={async inspect(args){proofCalls.push(args);
     if(options.verifyError)throw options.verifyError;
     return {id:'MAIN-UK',shipmentId:'MAIN-UK',pickupTargetId:'FIX-UK',
       pickupDate:'2026-11-09',reference:'UK-REF',companyKey:args.companyKey,
       environment:args.environment,registered:true};
   }};
 const pickupAccess={};const pickupStore={};const bindingStore={};
 const original=Module._load;
 Module._load=function(request,parent,isMain){
   if(parent&&parent.filename===source){
     if(request==='../shared/auth-store')return auth;
     if(request==='../shared/fast-auth-store')return fast;
     if(request==='../shared/pickup-transport-link-store')return ledger;
     if(request==='../shared/pickup-transport-registration-proof')return registrationProof;
     if(request==='../shared/public-access-store')return pickupAccess;
     if(request==='../shared/pickup-store')return pickupStore;
     if(request==='../shared/pickup-transport-binding-store')return bindingStore;
   }
   return original.call(this,request,parent,isMain);
 };
 delete require.cache[source];
 let handler;
 try{handler=require(source)}finally{Module._load=original}
 const request=(overrides={})=>({
   method:'GET',headers:{authorization:'Bearer valid',host:'ashy-grass-testservice.westeurope.6.azurestaticapps.net'},
   query:{},user:baseUser,...overrides
 });
 const invoke=async req=>{const ctx={};await handler(ctx,req);return {...ctx.res,data:JSON.parse(ctx.res.body)}};
 return{reads,request,invoke,proofCalls,pickupAccess,pickupStore,bindingStore};
}
test('GET reads only own testservice tenant and no-store response',async()=>{
 const {reads,request,invoke}=setup(),r=await invoke(request());
 assert.equal(r.status,200);assert.equal(r.headers['Cache-Control'],'no-store');
 assert.equal(r.data.revision,4);assert.equal(r.data.links[0].ref,'REF-A');
 assert.equal(r.data.canEdit,false);assert.equal(r.data.audit,undefined);
 assert.deepEqual(reads,[{scope:{companyKey:'essentra',environment:'testservice'},options:{includeAudit:false}}]);
});
test('unauthenticated request fails before ledger access',async()=>{
 const {reads,request,invoke}=setup(),r=await invoke(request({headers:{host:'ashy-grass-testservice.westeurope.6.azurestaticapps.net'}}));
 assert.equal(r.status,401);assert.equal(r.data.code,'AUTH_REQUIRED');assert.equal(reads.length,0);
});
test('calendar read rights are required',async()=>{
 const {reads,request,invoke}=setup(),r=await invoke(request({user:{...baseUser,rights:{pickupcalendar:{level:'none'}}}}));
 assert.equal(r.status,403);assert.equal(r.data.code,'PICKUP_LINK_READ_FORBIDDEN');assert.equal(reads.length,0);
});
test('cross-tenant query is rejected before blob access',async()=>{
 const {reads,request,invoke}=setup(),r=await invoke(request({headers:{authorization:'Bearer valid',
   host:'ashy-grass-testservice.westeurope.6.azurestaticapps.net','x-exporthub-company-id':'foreign-company'}}));
 assert.equal(r.status,403);assert.equal(r.data.code,'COMPANY_FORBIDDEN');assert.equal(reads.length,0);
});
test('testservice host cannot be redirected to production by header',async()=>{
 const {reads,request,invoke}=setup(),r=await invoke(request({headers:{authorization:'Bearer valid',
   host:'ashy-grass-testservice.westeurope.6.azurestaticapps.net','x-exporthub-environment':'production'}}));
 assert.equal(r.status,409);assert.equal(r.data.code,'ENVIRONMENT_MISMATCH');assert.equal(reads.length,0);
});
test('reader cannot request audit details but an editor can',async()=>{
 const {reads,request,invoke}=setup();
 const reader=await invoke(request({query:{includeAudit:'1'}}));
 assert.equal(reader.status,200);assert.equal(reader.data.audit,undefined);assert.equal(reads[0].options.includeAudit,false);
 const editor=await invoke(request({query:{includeAudit:'1'},user:{...baseUser,rights:{pickupcalendar:{level:'edit'}}}}));
 assert.equal(editor.status,200);assert.equal(editor.data.canEdit,true);
 assert.deepEqual(editor.data.audit,[{action:'manual-link',by:'Operator'}]);
 assert.equal(reads[1].options.includeAudit,true);
});
test('write methods are explicitly blocked before authentication and storage',async()=>{
 const {reads,request,invoke}=setup(),r=await invoke(request({method:'POST',headers:{}}));
 assert.equal(r.status,405);assert.equal(r.data.code,'METHOD_NOT_ALLOWED');assert.equal(reads.length,0);
 const options=await invoke(request({method:'OPTIONS',headers:{}}));
 assert.equal(options.status,204);assert.equal(reads.length,0);
});
test('unexpected storage failures never expose secrets or internal paths',async()=>{
 const injected=Object.assign(new Error('AccountKey=private-secret account/blob/internal'),{code:'AuthorizationFailure',statusCode:403});
 const {request,invoke}=setup({storageError:injected});
 const r=await invoke(request());
 assert.equal(r.status,403);
 assert.equal(r.data.code,'PICKUP_TRANSPORT_LINK_READ_FAILED');
 assert.doesNotMatch(r.body,/AccountKey|private-secret|internal|AuthorizationFailure/i);
});
test('internal server errors are localized and do not disclose stack traces',async()=>{
 const injected=Object.assign(new Error('DATABASE_URL=secret; /srv/root/index.js'),{code:'STORAGE_INTERNAL',statusCode:500});
 const {request,invoke}=setup({storageError:injected});
 const r=await invoke(request());
 assert.equal(r.status,500);
 assert.equal(r.data.code,'PICKUP_TRANSPORT_LINK_READ_FAILED');
 assert.doesNotMatch(r.body,/DATABASE_URL|secret|\/srv\/|STORAGE_INTERNAL/i);
});
test('read-only verification consults authoritative server evidence without exposing token keys',async()=>{
 const {request,invoke,reads,proofCalls,pickupAccess,pickupStore}=setup();
 const r=await invoke(request({query:{verifyShipmentId:'MAIN-UK',pickupTargetId:'FIX-UK',pickupDate:'2026-11-09'}}));
 assert.equal(r.status,200);assert.equal(r.data.verified,true);
 assert.equal(r.data.transport.id,'MAIN-UK');assert.equal(r.data.transport.registered,true);
 assert.equal(JSON.stringify(r.data).includes('resourceKey'),false);
 assert.equal(reads.length,0);assert.equal(proofCalls.length,1);
 assert.equal(proofCalls[0].environment,'testservice');
 assert.equal(proofCalls[0].companyKey,'essentra');
 assert.equal(proofCalls[0].shipmentId,'MAIN-UK');
 assert.equal(proofCalls[0].team.state.shipments[0].id,'MAIN-UK');
 assert.equal(proofCalls[0].accessStore,pickupAccess);
 assert.equal(proofCalls[0].pickupStore,pickupStore);
 assert.equal(proofCalls[0].bindingStore,bindingStore);
});
test('unverified request requires calendar rights before reading registration',async()=>{
 const {request,invoke,proofCalls}=setup();
 const q={verifyShipmentId:'MAIN-UK',pickupTargetId:'FIX-UK',pickupDate:'2026-11-09'};
 const r=await invoke(request({query:q,user:{...baseUser,rights:{pickupcalendar:{level:'none'}}}}));
 assert.equal(r.status,403);assert.equal(proofCalls.length,0);
});
test('verification rejects missing IDs, dates and unexpected storage disclosure',async()=>{
 const {request,invoke,proofCalls}=setup();
 const bad=await invoke(request({query:{verifyShipmentId:'MAIN-UK',pickupTargetId:'FIX-UK',pickupDate:'invalid'}}));
 assert.equal(bad.status,400);assert.equal(proofCalls.length,0);
 const {request:another,invoke:check}=setup({verifyError:Object.assign(
   new Error('AccountKey=private-secret /azure/internal'),{code:'BlobAuthFailed',statusCode:403})});
 const err=await check(another({query:{verifyShipmentId:'MAIN-UK',pickupTargetId:'FIX-UK',pickupDate:'2026-11-09'}}));
 assert.equal(err.status,403);
 assert.equal(err.data.code,'PICKUP_TRANSPORT_LINK_READ_FAILED');
 assert.doesNotMatch(err.body,/AccountKey|private-secret|internal|BlobAuthFailed/i);
});
