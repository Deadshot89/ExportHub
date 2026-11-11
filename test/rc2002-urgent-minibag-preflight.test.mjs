import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const packing=require('../api/shared/urgent-packing.js');
const internal=require('../api/urgent-orders/index.js');
const publicApi=require('../api/urgent-order-public/index.js');
const catalog=packing.parseCatalog('Item number\tPacking quantity\n10000144\t1.000,00\n10000145\t100,00\n10000146\t0,00\n');
const row=(article,quantity,minibag=false,minibagReviewed=false)=>({article,quantity,minibag,minibagReviewed});

test('RC2002 preflight reports exact partial-pack positions and cannot disclose master pack sizes',()=>{
 const items=[row('10000144',1000),row('10000144',900),row('10000145',200),row('10000145',150),row('10000146',1),row('99999999',1)];
 const result=packing.preflight(items,catalog);
 assert.equal(result.ready,true);
 assert.equal(result.checkedCount,4);
 assert.deepEqual(result.reviewIndices,[1,3]);
 assert.deepEqual(result.unknownIndices,[4,5]);
 assert.deepEqual(Object.keys(result).sort(),['checkedCount','ready','reviewIndices','unknownIndices']);
 assert.equal(JSON.stringify(result).includes('1000'),false,'private packing quantities must never be exposed');
});

test('RC2002 Minibag and prior matching confirmation skip the question; unknown checked Minibags are not reported as missing',()=>{
 const result=packing.preflight([row('10000144',900,true),row('10000144',900,false,true),row('99999999',1,true)],catalog);
 assert.deepEqual(result.reviewIndices,[]);
 assert.deepEqual(result.unknownIndices,[]);
 assert.equal(result.checkedCount,2);
});

test('RC2002 missing catalog is explicitly unverified, not a successful check',()=>{
 const result=packing.preflight([row('10000144',900)],{count:0,quantities:{}});
 assert.equal(result.ready,false);
 assert.equal(result.checkedCount,0);
 assert.deepEqual(result.unknownIndices,[0]);
 assert.deepEqual(result.reviewIndices,[]);
});

test('RC2002 preflight rejects invalid quantity and unbounded line lists',()=>{
 assert.throws(()=>packing.preflight([],catalog),e=>e.code==='URGENT_PACKING_CHECK_INVALID');
 assert.throws(()=>packing.preflight([row('10000144',1.5)],catalog),e=>e.code==='URGENT_PACKING_CHECK_INVALID');
 assert.throws(()=>packing.preflight(Array.from({length:101},()=>row('10000144',1)),catalog),e=>e.code==='URGENT_PACKING_CHECK_INVALID');
});

test('RC2002 public preflight is read-only and returns only indices, never master pack quantities',async()=>{
 const originalRead=internal.readPackingCatalog,originalWrite=internal.write;
 let writes=0;
 internal.readPackingCatalog=async()=>catalog;
 internal.write=async()=>{writes++;throw new Error('preflight may not write');};
 try{
  const req={headers:{'x-forwarded-for':'192.0.2.220'},body:{action:'packing-preflight',items:[row('10000144',900),row('10000145',100)]}};
  const result=await publicApi.publicAction(req,{environment:'testservice'});
  assert.deepEqual(result.reviewIndices,[0]);
  assert.deepEqual(result.unknownIndices,[]);
  assert.equal(result.checkedCount,2);
  assert.equal(writes,0);
  assert.equal(result.environment,'testservice');
  assert.equal(JSON.stringify(result).includes('packingQuantity'),false);
  assert.equal(JSON.stringify(result).includes('quantities'),false);
 }finally{
  internal.readPackingCatalog=originalRead;
  internal.write=originalWrite;
 }
});

test('RC2002 both entry pages check on Weiter, keep confirmations tied to the original item and quantity',()=>{
 const publicHtml=fs.readFileSync(new URL('../assets/urgent-order-report.html',import.meta.url),'utf8');
 const internalHtml=fs.readFileSync(new URL('../assets/urgent-orders.html',import.meta.url),'utf8');
 const internalApi=fs.readFileSync(new URL('../api/urgent-orders/index.js',import.meta.url),'utf8');
 for(const source of [publicHtml,internalHtml]){
  assert.match(source,/api\('packing-preflight',\{items:data\}\)/);
  assert.match(source,/dataset\.packingReviewed/);
  assert.match(source,/minibagReviewed:/);
  assert.match(source,/packingPreflightUnknownConfirm/);
  assert.match(source,/packingPreflightRunning/);
  assert.match(source,/packingPreflightConfirmed/);
  assert.match(source,/cutoffText\(\)/);
 }
 assert.match(internalApi,/if\(action==='packing-preflight'\)/);
 assert.match(internalApi,/packing\.preflight\(p\.items,catalog\)/);
});

test('RC2002 all six languages provide a human cutoff text and preflight feedback',()=>{
 for(const lang of ['de','en','pl','fr','es','it']){
  const dict=JSON.parse(fs.readFileSync(new URL('../assets/i18n/'+lang+'.json',import.meta.url),'utf8'));
  assert.match(dict['urgentOrderV2.cutoffLateWarning'],/15:15|3:15|15 h 15/);
  for(const key of ['packingPreflightRunning','packingPreflightOk','packingPreflightMissing','packingPreflightUnknown','packingPreflightUnknownConfirm','packingPreflightConfirmed','packingPreflightRetry'])
   assert.equal(typeof dict['urgentOrderV2.'+key],'string');
 }
 assert.equal(JSON.parse(fs.readFileSync(new URL('../assets/i18n/de.json',import.meta.url)))['urgentOrderV2.cutoffHeading'],'Heute noch versenden?');
});
