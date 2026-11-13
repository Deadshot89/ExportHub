import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const model=require('../api/shared/urgent-orders.js');

test('Urgent Order requires exactly SO3002 followed by eight digits',()=>{
 assert.equal(model.orderNumber('SO300200214125'),'SO300200214125');
 assert.equal(model.orderNumber('SO300200000000'),'SO300200000000');
 const rejected=[
  'SO3002','SO30020021412','SO3002002141250',
  'SO300300214125','SO30020021412A','SO3002-0214125',
  'SO3002 0214125','SO30020021412-','300200214125'
 ];
 for(const value of rejected){
  assert.throws(()=>model.orderNumber(value),error=>error.code==='URGENT_SO_INVALID',value);
 }
});

test('Both Urgent Order forms enforce 14 characters and the SO3002 pattern before sending',()=>{
 for(const path of ['assets/urgent-orders.html','assets/urgent-order-report.html']){
  const html=fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
  const match=html.match(/<input\b[^>]*name="orderNumber"[^>]*>/);
  assert.ok(match,'Order number field exists in '+path);
  for(const attribute of ['minlength="14"','maxlength="14"','pattern="SO3002[0-9]{8}"']){
   assert.ok(match[0].includes(attribute),path+' missing '+attribute);
  }
  assert.match(match[0],/SO300200214125/);
 }
});
