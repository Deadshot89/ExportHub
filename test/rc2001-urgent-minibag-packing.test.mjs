import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const packing=require('../api/shared/urgent-packing.js');
const model=require('../api/shared/urgent-orders.js');
const data='Item number\tNet weight\tPacking quantity\n50607055\t0,00120\t1.000,00\n10000021\t0,00180\t100,00\n99999999\t0,00000\t0,00\n';
const catalog=packing.parseCatalog(data);
const line=(quantity,minibag=false,reviewed=false)=>({line:'10',article:'50607055',quantity,minibag,minibagReviewed:reviewed,pickableStock:true,holdsClear:true,minibagLeadtime:minibag?true:null});
const base=items=>({orderNumber:'SO20261111',delivery:'DRP',priority:'P2',email:'cs@example.org',requestedDispatchDate:'2026-11-12',items});
const actor={id:'test-user',name:'Test User'},now='2026-11-11T11:00:00Z';
test('private catalog parser respects actual pack sizes; zero is unknown',()=>{
 assert.equal(catalog.count,2);
 assert.equal(catalog.unknownPackSize,1);
 assert.equal(catalog.quantities['50607055'],1000);
 assert.equal(catalog.quantities['10000021'],100);
 assert.equal(catalog.quantities['99999999'],undefined);
 assert.equal(packing.evaluate('99999999',900,false,catalog),null);
 assert.equal(packing.evaluate('50607055',1000,false,catalog),null);
 assert.equal(packing.evaluate('50607055',2000,false,catalog),null);
 assert.equal(packing.evaluate('50607055',500,false,catalog).remainder,500);
 assert.equal(packing.evaluate('50607055',900,false,catalog).remainder,900);
 assert.equal(packing.evaluate('50607055',1100,false,catalog).remainder,100);
 assert.equal(packing.evaluate('50607055',900,true,catalog),null);
});
test('non-whole packs require an explicit confirmation and persist review evidence',()=>{
 for(const quantity of [500,900,1100,2500]){
  assert.throws(()=>model.createOrder(base([line(quantity)]),actor,now,catalog),e=>e.code==='URGENT_MINIBAG_CONFIRM_REQUIRED'&&e.status===409&&e.minibagArticles.includes('50607055'));
  const reviewed=model.createOrder(base([line(quantity,false,true)]),actor,now,catalog);
  assert.equal(reviewed.items[0].minibagReview.confirmedWithoutMinibag,true);
  assert.equal(reviewed.items[0].minibagReview.packingQuantity,1000);
 }
 for(const quantity of [1000,2000]){
  const order=model.createOrder(base([line(quantity)]),actor,now,catalog);
  assert.equal(order.items[0].minibagReview,undefined);
 }
});
test('Minibag tick skips warning but keeps required ten-day leadtime check',()=>{
 const minibag=model.createOrder(base([line(900,true)]),actor,now,catalog);
 assert.equal(minibag.items[0].minibag,true);
 assert.throws(()=>model.createOrder(base([{...line(900,true),minibagLeadtime:null}]),actor,now,catalog),e=>e.code==='URGENT_CHECK_REQUIRED');
});
test('all-lines requests and absent catalog never invent a packaging warning',()=>{
 const noCatalog=model.createOrder(base([line(900)]),actor,now);
 assert.equal(noCatalog.items[0].minibagReview,undefined);
 const whole=model.createOrder({...base([]),allLines:true,orderChecks:{holdsClear:true,pickableStock:true}},actor,now,catalog);
 assert.equal(whole.allLines,true);
});
test('malformed or duplicate catalog data rejected atomically',()=>{
 assert.throws(()=>packing.parseCatalog('Item\tQuantity\n50607055\t1000'),e=>e.code==='URGENT_PACKING_HEADER_INVALID');
 assert.throws(()=>packing.parseCatalog('Item number\tPacking quantity\n50607055\t100\n50607055\t200'),e=>e.code==='URGENT_PACKING_DUPLICATE');
 assert.throws(()=>packing.parseCatalog('Item number\tPacking quantity\n50607055\t1.2'),e=>e.code==='URGENT_PACKING_ROW_INVALID');
});
