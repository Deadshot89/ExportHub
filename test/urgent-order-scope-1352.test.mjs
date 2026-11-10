import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const model=require('../api/shared/urgent-orders.js');
const actor={id:'CS-17',name:'Customer Service'};
const logistics={id:'OPS-1',rights:{shipmentoverview:{edit:true}}};
const item={line:'10',article:'ART-10',quantity:2,pickableStock:true,holdsClear:true};
const payload={orderNumber:'SO51352',delivery:'DRP',priority:'P1',email:'cs@example.com',language:'de',requestedDispatchDate:'2026-11-11',items:[item]};
const at='2026-11-10T11:30:00.000Z';

test('P1 requires explicit creator acknowledgement; other priorities do not',()=>{
 assert.throws(()=>model.createOrder(payload,actor,at),e=>e.code==='URGENT_P1_APPROVAL_REQUIRED');
 assert.throws(()=>model.createOrder({...payload,transportCostsApproved:'true'},actor,at),e=>e.code==='URGENT_P1_APPROVAL_REQUIRED');
 const o=model.createOrder({...payload,transportCostsApproved:true},actor,at);
 assert.equal(o.transportCostsApproval.confirmedBy.id,actor.id);
 assert.equal(o.transportCostsApproval.confirmedAt,at);
 assert.equal(model.createOrder({...payload,priority:'P2'},actor,at).transportCostsApproval,null);
});

test('whole-order scope stores no invented product line or quantity',()=>{
 const o=model.createOrder({...payload,transportCostsApproved:true,allLines:true,items:[]},actor,at);
 assert.equal(o.allLines,true);
 assert.equal(o.items.length,1);
 assert.equal(o.items[0].scope,'ALL_LINES');
 assert.equal(o.items[0].article,'');
 assert.equal(o.items[0].line,'');
 assert.equal(o.items[0].quantity,null);
 assert.equal(o.items[0].checkResult,'not_checked');
 assert.match(model.draftMail(o,'problem','de','Bitte den gesamten Auftrag prüfen.',actor).body,/Kompletter Auftrag \(alle Positionen\)/);
 assert.match(model.draftMail(o,'problem','en','Please review the entire order.',actor).body,/Entire order \(all lines\)/);
 model.setItemStatus(o,o.items[0].id,'Shipped',logistics,at);
 assert.equal(model.summaryStatus(o),'Shipped');
 assert.throws(()=>model.createOrder({...payload,transportCostsApproved:true,allLines:true,items:[item]},actor,at),e=>e.code==='URGENT_SCOPE_CONFLICT');
});

test('single-item mode keeps existing validation',()=>{
 assert.throws(()=>model.createOrder({...payload,priority:'P3',items:[]},actor,at),e=>e.code==='URGENT_LINES_REQUIRED');
 assert.equal(model.createOrder({...payload,priority:'P3'},actor,at).items[0].quantity,2);
});

test('internal and public forms include confirmation, all-lines scope and valid inline JS',()=>{
 for(const filename of ['urgent-orders.html','urgent-order-report.html']){
  const html=fs.readFileSync(new URL('../assets/'+filename,import.meta.url),'utf8');
  assert.match(html,/id="p1CostApproved"/);
  assert.match(html,/name="lineScope" value="all"/);
  assert.match(html,/transportCostsApproved:/);
  assert.match(html,/allLines:/);
  assert.match(html,/function syncScope/);
  for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)){
   assert.doesNotThrow(()=>new vm.Script(match[1]),filename+' inline JavaScript');
  }
 }
});
