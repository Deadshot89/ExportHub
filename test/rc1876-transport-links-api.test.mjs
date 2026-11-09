import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const baseUser={id:'OP1',role:'user',companyId:'essentra',rights:{pickupcalendar:{level:'view',read:true}}};
function setup(){
 const reads=[],source=require.resolve('../api/pickup-transport-links/index.js');
 const auth={
   json(status,payload,headers={}){return{status,headers:{'Cache-Control':'no-store',...headers},body:JSON.stringify(payload)}},
   error(code,message,status){return Object.assign(new Error(message),{code,status})},
   async validateSession(req){if(!req.headers||req.headers.authorization!=='Bearer valid')throw auth.error('AUTH_REQUIRED','Login fehlt',401);return{user:req.user||baseUser}}
 };
 const fast={isSource:()=>true,validateSession:auth.validateSession};
 const ledger={async read(scope,options){reads.push({scope,options});return{
   environment:scope.environment,companyKey:scope.companyKey,revision:4,
   links:[{ref:'REF-A',pickupDate:'2026-11-09',transportId:'TRANSPORT-UK',active:true}],
   manualExclusions:[],...(options.includeAudit?{audit:[{action:'manual-link',by:'Operator'}]}:{})
 }}};
 const original=Module._load;
 Module._load=function(request,parent,isMain){
   if(parent&&parent.filename===source){
     if(request==='../shared/auth-store')return auth;
     if(request==='../shared/fast-auth-store')return fast;
     if(request==='../shared/pickup-transport-link-store')return ledger;
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
 return{reads,request,invoke};
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
