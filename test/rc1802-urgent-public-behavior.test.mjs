import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const publicApi=require('../api/urgent-order-public/index.js');
const internal=require('../api/urgent-orders/index.js');
const model=require('../api/shared/urgent-orders.js');
const required={
 orderNumber:'SO3002',delivery:'DRP',priority:'P1',email:'cs@example.org',
 orderType:'DIRECT_OUTBOUND',
 directOutbound:{arrivalAt:'2026-11-10T08:30',arrivalMode:'TRUCK',arrivalProvider:'Sample Freight',dispatchMethod:'EXPRESS',deliveryNotePresent:true,asnWorking:true,holdsClear:true},
 items:[{line:'10',article:'A-11',quantity:2,holdsClear:true,newArticle:true,articleDataCorrect:true,processCompliant:true}]
};
function req(p){return{headers:{'x-forwarded-for':'192.0.2.1'},body:p};}
test('public reporter create/list is capability-scoped across users; only token holder sees own orders',async()=>{
 const originals={write:internal.write,readDocument:internal.readDocument};
 const state={orders:[],profiles:{},reporterGroups:[]};
 internal.write=async(_refs,mutator)=>mutator(state);
 internal.readDocument=async()=>state;
 try{
  const refs={environment:'testservice'};
  const first=await publicApi.publicAction(req({action:'create',...required}),refs);
  assert.match(first.accessToken,/^uro_[A-Za-z0-9_-]{43}$/);
  assert.equal(first.isNewLink,true);
  assert.equal(first.order.directOutbound.dispatchMethod,'EXPRESS');
  const row=state.orders[0],reporter=state.reporterGroups[0];
  assert.ok(reporter.tokenHash);
  assert.notEqual(reporter.tokenHash,first.accessToken);
  assert.equal(row.reporterId,reporter.id);
  assert.equal(JSON.stringify(state).includes(first.accessToken),false,'raw tracking link must never be persisted');
  assert.deepEqual((await publicApi.publicAction(req({action:'list',accessToken:first.accessToken}),refs)).orders.map(x=>x.orderNumber),['SO3002']);
  const another=await publicApi.publicAction(req({action:'create',...required,orderNumber:'SO3003',email:'second@example.org'}),refs);
  assert.notEqual(another.accessToken,first.accessToken);
  assert.deepEqual((await publicApi.publicAction(req({action:'list',accessToken:another.accessToken}),refs)).orders.map(x=>x.orderNumber),['SO3003']);
  const more=await publicApi.publicAction(req({action:'create',...required,orderNumber:'SO3004',accessToken:first.accessToken}),refs);
  assert.equal(more.accessToken,first.accessToken);
  assert.equal(more.isNewLink,false);
  assert.deepEqual((await publicApi.publicAction(req({action:'list',accessToken:first.accessToken}),refs)).orders.map(x=>x.orderNumber).sort(),['SO3002','SO3004']);
  await assert.rejects(publicApi.publicAction(req({action:'list'}),refs),e=>e.code==='URGENT_REPORTER_ACCESS_DENIED'&&e.status===403);
  await assert.rejects(publicApi.publicAction(req({action:'list',accessToken:'uro_'+('A'.repeat(43))}),refs),e=>e.code==='URGENT_REPORTER_ACCESS_DENIED');
  await assert.rejects(publicApi.publicAction(req({action:'create',...required,orderNumber:'SO3005',accessToken:first.accessToken,email:'spoof@example.org'}),refs),e=>e.code==='URGENT_REPORTER_EMAIL_MISMATCH');
  await assert.rejects(publicApi.publicAction(req({action:'create',...required,orderNumber:'SO3003',accessToken:first.accessToken}),refs),e=>e.code==='URGENT_ORDER_EXISTS');
  await assert.rejects(publicApi.publicAction(req({action:'update-status',id:row.id,itemId:row.items[0].id,status:'Shipped',accessToken:first.accessToken}),refs),e=>e.code==='URGENT_ACTION_UNKNOWN');
  assert.equal(row.items[0].status,'Open');
  // Internal logistics roles can read the same order and change item state.
  const logistics={id:'OPS-1',rights:{shipmentoverview:{edit:true}}};
  assert.equal(model.canRead(row,logistics),true);
  assert.equal(model.canRead(row,{id:'SOMEONE-ELSE'}),false);
  model.setItemStatus(row,row.items[0].id,'Problem',logistics,undefined,'Der angekündigte Lkw ist nicht angekommen.');
  const current=await publicApi.publicAction(req({action:'list',accessToken:first.accessToken}),refs);
  assert.equal(current.orders.find(x=>x.orderNumber==='SO3002').items[0].status,'Problem');
  assert.match(current.orders.find(x=>x.orderNumber==='SO3002').items[0].problemNote,/Lkw ist nicht angekommen/);
  assert.equal(state.publicDaily.count,3,'all anonymous creates share a durable daily counter');
  state.publicDaily.count=200;
  await assert.rejects(publicApi.publicAction(req({action:'create',...required,orderNumber:'SO3006',accessToken:first.accessToken}),refs),e=>e.code==='URGENT_PUBLIC_DAILY_LIMIT'&&e.status===429);
  assert.equal(state.orders.length,3,'limit must reject without inserting an order');
 }finally{internal.write=originals.write;internal.readDocument=originals.readDocument;}
});

test('verified deployment release metadata resolves internal Azure worker Host for both environments',()=>{
 const valid={buildId:'a'.repeat(40),environment:'testservice',visibleRelease:'RC1112',technicalBuild:'RC1112',builtAt:'2026-11-04T12:40:00Z'};
 assert.equal(internal.deploymentEnv(valid),'testservice');
 assert.equal(internal.deploymentEnv({...valid,environment:'production'}),'production');
 assert.equal(internal.deploymentEnv({...valid,buildId:'invalid'}),'');
 assert.equal(internal.deploymentEnv({...valid,builtAt:''}),'');
 assert.equal(internal.deploymentEnv({...valid,environment:'preview'}),'');
 assert.equal(internal.resolveStorageEnvironment({headers:{host:'worker.azurewebsites.net'}},'testservice'),'testservice');
 assert.equal(internal.resolveStorageEnvironment({headers:{host:'worker.azurewebsites.net',origin:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'}},'testservice'),'testservice');
 assert.equal(internal.resolveStorageEnvironment({headers:{host:'worker.azurewebsites.net'}},'production'),'production');
 assert.equal(internal.resolveStorageEnvironment({headers:{host:'worker.azurewebsites.net',origin:'https://wonderful-forest-0f315e310.7.azurestaticapps.net'}},'production'),'production');
 assert.throws(()=>internal.resolveStorageEnvironment({headers:{host:'worker.azurewebsites.net'}},''),e=>e.code==='URGENT_HOST_UNTRUSTED');
 assert.throws(()=>internal.resolveStorageEnvironment({headers:{host:'worker.azurewebsites.net',origin:'https://exporthub360.com'}},'testservice'),e=>e.code==='URGENT_ENVIRONMENT_MISMATCH');
 assert.throws(()=>internal.resolveStorageEnvironment({headers:{host:'exporthub360.com'}},'testservice'),e=>e.code==='URGENT_ENVIRONMENT_MISMATCH');
 assert.throws(()=>internal.resolveStorageEnvironment({headers:{host:'worker.azurewebsites.net','x-exporthub-environment':'production'}},'testservice'),e=>e.code==='URGENT_ENVIRONMENT_MISMATCH');
 assert.throws(()=>internal.resolveStorageEnvironment({headers:{host:'worker.azurewebsites.net','x-exporthub-environment':'testservice'}},'production'),e=>e.code==='URGENT_ENVIRONMENT_MISMATCH');
 assert.throws(()=>internal.resolveStorageEnvironment({headers:{host:'worker.azurewebsites.net',origin:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'}},'production'),e=>e.code==='URGENT_ENVIRONMENT_MISMATCH');
 assert.throws(()=>internal.resolveStorageEnvironment({headers:{host:'wonderful-forest-0f315e310.7.azurestaticapps.net'}},'testservice'),e=>e.code==='URGENT_ENVIRONMENT_MISMATCH');
});

test('unknown preview hosts cannot select Urgent Order production storage',()=>{
 const preview='exporthub-pr-1193.westeurope.5.azurestaticapps.net';
 assert.throws(()=>internal.resolveStorageEnvironment({headers:{host:preview}},''),e=>e.code==='URGENT_HOST_UNTRUSTED');
 assert.throws(()=>internal.resolveStorageEnvironment({headers:{host:preview,origin:'https://wonderful-forest-0f315e310.7.azurestaticapps.net'}},''),e=>e.code==='URGENT_HOST_UNTRUSTED');
 assert.equal(internal.resolveStorageEnvironment({headers:{host:'wonderful-forest-0f315e310.7.azurestaticapps.net'}},''),'production');
 assert.throws(()=>internal.resolveStorageEnvironment({headers:{host:preview}},'production'),e=>e.code==='URGENT_HOST_UNTRUSTED');
 assert.throws(()=>internal.resolveStorageEnvironment({headers:{host:preview,'x-forwarded-host':'wonderful-forest-0f315e310.7.azurestaticapps.net'}},'production'),e=>e.code==='URGENT_HOST_UNTRUSTED');
 assert.throws(()=>internal.resolveStorageEnvironment({headers:{host:'worker.azurewebsites.net',origin:'https://'+preview}},'production'),e=>e.code==='URGENT_HOST_UNTRUSTED');
 assert.throws(()=>internal.resolveStorageEnvironment({headers:{host:'wonderful-forest-0f315e310.7.azurestaticapps.net',origin:'https://'+preview}},'production'),e=>e.code==='URGENT_HOST_UNTRUSTED');
});

test('Azure deployment isolation fails closed on unknown or contradictory hosts',()=>{
 const ref='https://exporthub360.com',testHost='sample-testservice.azurestaticapps.net';
 assert.throws(()=>internal.storage({headers:{host:'worker.azurewebsites.net',origin:'https://'+testHost}}),e=>e.code==='URGENT_HOST_UNTRUSTED','forged Origin alone cannot choose test data');
 assert.throws(()=>internal.storage({headers:{host:testHost,origin:ref}}),e=>e.code==='URGENT_ENVIRONMENT_MISMATCH','test host must not select production Origin');
 assert.throws(()=>internal.storage({headers:{host:'exporthub360.com','x-forwarded-host':testHost}}),e=>e.code==='URGENT_ENVIRONMENT_MISMATCH','contradictory trusted hosts are rejected');
 assert.throws(()=>internal.storage({headers:{host:testHost,'x-exporthub-environment':'production'}}),e=>e.code==='ENVIRONMENT_MISMATCH'||e.code==='URGENT_ENVIRONMENT_MISMATCH','spoofed target environment is rejected');
});


test('public endpoint reports safe service codes without leaking Azure SDK error messages',async()=>{
 const storage=internal.storage;
 const invoke=async error=>{
  internal.storage=()=>{throw error;};
  const ctx={res:null,log:{warn(){}}};
  await publicApi(ctx,{method:'POST',headers:{},body:{action:'create'}});
  return{status:ctx.res.status,result:JSON.parse(ctx.res.body)};
 };
 try{
  const missing=await invoke(model.problem('URGENT_STORAGE_MISSING','raw internal secret marker',503));
  assert.equal(missing.status,503);
  assert.equal(missing.result.code,'URGENT_STORAGE_MISSING');
  assert.doesNotMatch(JSON.stringify(missing.result),/raw internal secret marker/);
  assert.match(missing.result.message,/Datenspeicher/);
  const azure=new Error('AccountKey=secret123; container private-exporthub-data');
  azure.statusCode=403;azure.code='AuthorizationFailure';
  const denied=await invoke(azure);
  assert.equal(denied.status,503,'Azure SDK errors are service errors even with 403');
  assert.equal(denied.result.code,'URGENT_PUBLIC_FAILED');
  assert.doesNotMatch(JSON.stringify(denied.result),/AccountKey|secret123|private-exporthub-data/);
  assert.equal(denied.result.retryable,true);
  const validation=await invoke(model.problem('URGENT_EMAIL_INVALID','Bitte eine gültige E-Mail-Adresse angeben.',400));
  assert.equal(validation.status,400);
  assert.equal(validation.result.code,'URGENT_EMAIL_INVALID');
  assert.match(validation.result.message,/E-Mail-Adresse/);
 }finally{internal.storage=storage;}
});
