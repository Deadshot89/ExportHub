import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const api=require('../api/sop-documents/index.js');
const service=require('../api/shared/sop-service.js');
const {verifyChain}=require('../api/shared/hash-chain.js');

const NOW='2026-11-13T12:00:00.000Z';
const writer=(name='Anna')=>({user:name,active:true,rights:{sop:{level:'edit'}}});
const reader=(name='Rita')=>({user:name,active:true,rights:{sop:{level:'view'}}});
const fields={id:'SOP-EH-020',title:'Shipment check',area:'Versand',functionId:'shipping'};
function completeContent(){
 return {de:{purpose:'Prüfen',scope:'Warenausgang',responsibilities:['Versand'],checks:['Test'],records:['Prüfliste']},
 en:{purpose:'Check',scope:'Dispatch',responsibilities:['Shipping'],checks:['Verify'],records:['Checklist']},
 steps:[{id:'load-1',de:'Laden',en:'Load'}]};
}
function fake() {
 const data=new Map(),calls=[];
 const auth={
   async validateSession(req) {
     if (!req.fakeSession) throw Object.assign(new Error('Not logged in'),{code:'AUTH_REQUIRED',status:401});
     return {user:req.fakeSession};
   },
   environmentFromRequest(req){return req.fakeEnvironment||'production';}
 };
 const store={
   async listDocs(environment){return [...data.entries()].filter(([key])=>key.startsWith(environment+'/')).map(([,doc])=>structuredClone(doc));},
   async getDoc(environment,id){return structuredClone(data.get(environment+'/'+id)||null);},
   async mutateDoc(environment,id,updater,options={}) {
     calls.push({environment,id,options});
     const key=environment+'/'+id,current=data.get(key)||null;
     if(options.create&&current)throw Object.assign(new Error('exists'),{code:'SOP_EXISTS',status:409});
     if(!options.create&&!current)throw Object.assign(new Error('missing'),{code:'SOP_NOT_FOUND',status:404});
     const output=await updater(structuredClone(current));
     data.set(key,structuredClone(output));
     return structuredClone(output);
   }
 };
 async function call(action,user=writer(),payload={},options={}) {
   const context={log:{warn(){}}};
   const req={method:options.method||'POST',body:options.body===undefined?{action,...payload}:options.body,
     fakeSession:user,fakeEnvironment:options.environment||'production'};
   await api._test.handle(context,req,{store,auth,now:()=>NOW,featureEnabled:true});
   return {...context.res,json:context.res.body?JSON.parse(context.res.body):null};
 }
 return {call,data,calls,store,auth};
}
async function create(f,user=writer(),extra={}) {
 return f.call('create',user,{...fields,content:completeContent(),...extra});
}
function code(expected,status){return result=>{assert.equal(result.status,status);assert.equal(result.json?.code,expected);};}

test('OPTIONS is unauthenticated and returns no data',async()=>{
 const f=fake();const result=await f.call('',null,{}, {method:'OPTIONS'});
 assert.equal(result.status,204);assert.equal(result.body,'');
 assert.equal(f.calls.length,0);
});
test('anonymous requests are rejected for both list and create',async()=>{
 const f=fake();code('AUTH_REQUIRED',401)(await f.call('list',null));
 code('AUTH_REQUIRED',401)(await f.call('create',null,fields));
 assert.equal(f.calls.length,0);
});
test('authenticated reader may list/get documents but not modify them',async()=>{
 const f=fake();const created=await create(f);assert.equal(created.status,200);
 const list=await f.call('list',reader());
 assert.equal(list.status,200);assert.equal(list.json.items.length,1);
 assert.deepEqual(list.json.items[0].historyIntegrity,{ok:true,brokenAt:0});
 const get=await f.call('get',reader(),{id:fields.id});
 assert.equal(get.status,200);assert.deepEqual(get.json.item.historyIntegrity,{ok:true,brokenAt:0});
 code('SOP_EDIT_FORBIDDEN',403)(await f.call('update',reader(),{id:fields.id,revision:1,version:'1.0',title:'Changed'}));
});
test('create ignores spoofed authors, approval metadata and actor identity',async()=>{
 const f=fake();const result=await create(f,writer('Anna'),{author:'Mallory',approvedBy:'Mallory',status:'approved',revision:99});
 assert.equal(result.status,200);assert.equal(result.json.item.versions[0].author,'anna');
 assert.equal(result.json.item.versions[0].approvedBy,undefined);
 assert.equal(result.json.item.versions[0].status,'draft');
 assert.equal(result.json.item.revision,1);
 assert.equal(result.json.item.events[0].actor,'anna');
});
test('two authenticated users complete submission and approval; browser approvedBy is ignored',async()=>{
 const f=fake();assert.equal((await create(f)).status,200);
 const submitted=await f.call('submit',writer('Anna'),{id:fields.id,revision:1,version:'1.0'});
 assert.equal(submitted.status,200);assert.equal(submitted.json.item.versions[0].status,'review');
 code('FOUR_EYES',403)(await f.call('approve',writer('Anna'),{id:fields.id,revision:2,version:'1.0'}));
 const signed=await f.call('approve',writer('Lena'),{id:fields.id,revision:2,version:'1.0',approvedBy:'Mallory',approvedAt:'2099-01-01T00:00:00.000Z'});
 assert.equal(signed.status,200);
 assert.equal(signed.json.item.versions[0].approvedBy,'lena');
 assert.equal(signed.json.item.versions[0].approvedAt,NOW);
 assert.equal(signed.json.item.versions[0].status,'approved');
 assert.equal(verifyChain(signed.json.item.events).ok,true);
 assert.equal(signed.json.item.historyIntegrity.ok,true);
});
test('rejection validates reason and allows only independent SOP editors',async()=>{
 const f=fake();await create(f);await f.call('submit',writer('Anna'),{id:fields.id,revision:1,version:'1.0'});
 code('REASON_REQUIRED',422)(await f.call('reject',writer('Lena'),{id:fields.id,revision:2,version:'1.0',reason:'bad'}));
 code('FOUR_EYES',403)(await f.call('reject',writer('Anna'),{id:fields.id,revision:2,version:'1.0',reason:'Needs rework'}));
 const next=await f.call('reject',writer('Lena'),{id:fields.id,revision:2,version:'1.0',reason:'Needs rework'});
 assert.equal(next.status,200);assert.equal(next.json.item.versions[0].status,'draft');
 assert.equal(next.json.item.events.at(-1).data.reason,'Needs rework');
});
test('archive requires independent SOP editor and valid revision',async()=>{
 const f=fake();await create(f);await f.call('submit',writer('Anna'),{id:fields.id,revision:1,version:'1.0'});
 await f.call('approve',writer('Lena'),{id:fields.id,revision:2,version:'1.0'});
 code('REVISION_CONFLICT',409)(await f.call('archive',writer('Sven'),{id:fields.id,revision:2}));
 code('FOUR_EYES',403)(await f.call('archive',writer('Anna'),{id:fields.id,revision:3}));
 const archived=await f.call('archive',writer('Sven'),{id:fields.id,revision:3,archivedBy:'Mallory'});
 assert.equal(archived.status,200);
 assert.equal(archived.json.item.versions[0].archivedBy,'sven');
 assert.equal(archived.json.item.versions[0].status,'archived');
});
test('new-version action creates next draft without changing approved version',async()=>{
 const f=fake();await create(f);await f.call('submit',writer('Anna'),{id:fields.id,revision:1,version:'1.0'});
 await f.call('approve',writer('Lena'),{id:fields.id,revision:2,version:'1.0'});
 const newer=await f.call('new-version',writer('Mira'),{id:fields.id,revision:3});
 assert.equal(newer.status,200);
 assert.deepEqual(newer.json.item.versions.map(v=>v.status),['approved','draft']);
 assert.equal(newer.json.item.versions[1].version,'1.1');
});
test('blank English content produces 422 structured errors',async()=>{
 const f=fake();const c=completeContent();c.en.purpose='';
 await f.call('create',writer(),{...fields,content:c});
 const submit=await f.call('submit',writer(),{id:fields.id,revision:1,version:'1.0'});
 code('CONTENT_INCOMPLETE',422)(submit);
 assert.ok(submit.json.errors.some(e=>e.part==='purpose'&&e.lang==='en'));
});
test('unknown action, malformed JSON, invalid ID and unsupported method fail closed',async()=>{
 const f=fake();
 code('INVALID_ACTION',400)(await f.call('unknown'));
 code('INVALID_JSON',400)(await f.call('create',writer(),{},{body:'{broken'}));
 code('INVALID_SOP_ID',400)(await f.call('get',writer(),{id:'../foo'}));
 code('METHOD_NOT_ALLOWED',405)(await f.call('get',writer(),{},{method:'GET'}));
});
test('failed auth and malformed JSON cannot write a document',async()=>{
 const f=fake();await f.call('create',null,fields);
 await f.call('create',writer(),{},{body:'[]'});
 assert.equal(f.data.size,0);assert.equal(f.calls.length,0);
});
test('production and testservice resolve to independent stores',async()=>{
 const f=fake();
 const a=await f.call('create',writer(),{...fields,content:completeContent()},{environment:'testservice'});
 assert.equal(a.status,200);
 assert.equal((await f.call('list',reader())).json.items.length,0);
 assert.equal((await f.call('list',reader(),{},{environment:'testservice'})).json.items.length,1);
 assert.deepEqual(f.calls.map(x=>x.environment),['testservice']);
});
test('read attempts detect altered state, rather than falsely declaring integrity',async()=>{
 const f=fake();await create(f);
 f.data.get('production/'+fields.id).title='Tampered';
 const get=await f.call('get',reader(),{id:fields.id});
 code('HISTORY_BROKEN',409)(get);
 const list=await f.call('list',reader());
 code('HISTORY_BROKEN',409)(list);
});
test('request body cannot select its own environment or assign its own user',async()=>{
 const f=fake();
 await f.call('create',writer('Anna'),{...fields,content:completeContent(),environment:'testservice',user:'Mallory'});
 assert.equal(f.data.has('production/'+fields.id),true);
 assert.equal(f.data.has('testservice/'+fields.id),false);
 assert.equal(f.data.get('production/'+fields.id).versions[0].author,'anna');
});
test('500 server errors are sanitized and do not leak secrets',async()=>{
 const f=fake();f.store.listDocs=async()=>{throw new Error('AzureAccountKey=SUPERSECRET');};
 const x=await f.call('list',reader());
 code('SERVER_ERROR',500)(x);
 assert.equal(x.body.includes('SUPERSECRET'),false);
});
