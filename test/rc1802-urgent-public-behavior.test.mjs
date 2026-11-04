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
  assert.deepEqual((await publicApi.publicAction(req({action:'list',accessToken:first.accessToken}),refs)).orders.map(x=>x.orderNumber),['SO3004','SO3002']);
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
  model.setItemStatus(row,row.items[0].id,'Problem',logistics);
  const current=await publicApi.publicAction(req({action:'list',accessToken:first.accessToken}),refs);
  assert.equal(current.orders.find(x=>x.orderNumber==='SO3002').items[0].status,'Problem');
 }finally{internal.write=originals.write;internal.readDocument=originals.readDocument;}
});
