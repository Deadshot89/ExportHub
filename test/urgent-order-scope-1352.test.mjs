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
const payload={orderNumber:'SO300200051352',delivery:'DRP',priority:'P1',email:'cs@example.com',language:'de',requestedDispatchDate:'2026-11-11',items:[item]};
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

test('internal P1 details show the recorded confirmer and time, never fabricate old approvals',()=>{
 const html=fs.readFileSync(new URL('../assets/urgent-orders.html',import.meta.url),'utf8');
 const begin=html.indexOf('function approvalDetailMarkup(order)');
 const end=html.indexOf('function render(){',begin);
 assert.ok(begin>=0&&end>begin,'P1 evidence renderer is defined');
 assert.match(html,/\+approvalDetailMarkup\(order\)\+freightHtml/,'order details must include confirmation evidence');
 const snippet=html.slice(begin,end);
 const context={
  txt:v=>String(v==null?'':v),
  mailDate:iso=>String(iso),
  localeV2:(_key,fallback)=>fallback,
  escapeHtml:v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
 };
 const render=vm.runInNewContext(snippet+';approvalDetailMarkup',context);
 const confirmed=render({priority:'P1',transportCostsApproval:{confirmedBy:{id:'CS-17',name:'CS <script>'},confirmedAt:at}});
 assert.match(confirmed,/data-p1-approval="recorded"/);
 assert.match(confirmed,/CS &lt;script&gt;/);
 assert.match(confirmed,/2026-11-10T11:30:00/);
 assert.doesNotMatch(confirmed,/<script>/);
 assert.match(render({priority:'P1'}),/data-p1-approval="missing"/);
 assert.equal(render({priority:'P2'}),'');
 for(const lang of ['de','en','pl','es','fr','it']){
  const dict=JSON.parse(fs.readFileSync(new URL('../assets/i18n/'+lang+'.json',import.meta.url),'utf8'));
  for(const key of ['urgentOrderV2.p1ApprovalDetailLabel','urgentOrderV2.p1ApprovalDetailBy','urgentOrderV2.p1ApprovalDetailMissing'])assert.ok(dict[key],lang+' missing '+key);
 }
});

test('whole-order checks remain available and are stored separately from unverified item lines',()=>{
 const base={...payload,priority:'P3',allLines:true,items:[]};
 const unchecked=model.createOrder(base,actor,at);
 assert.deepEqual([unchecked.orderChecks.pickableStock,unchecked.orderChecks.holdsClear,unchecked.orderChecks.checkResult],[null,null,'not_checked']);
 assert.equal(unchecked.items[0].checks,null);
 assert.equal(unchecked.items[0].checkedAt,null);
 const verified=model.createOrder({...base,orderChecks:{pickableStock:true,holdsClear:true}},actor,at);
 assert.equal(verified.orderChecks.checkResult,'passed');
 assert.equal(verified.orderChecks.checkedAt,at);
 assert.equal(verified.items[0].checkResult,'not_checked','whole-order checks are not per-line evidence');
 const failed=model.createOrder({...base,orderChecks:{pickableStock:false,holdsClear:true,exceptionReason:'Der Lagerbestand ist unvollständig.'}},actor,at);
 assert.equal(failed.orderChecks.checkResult,'exception');
 assert.equal(failed.orderChecks.exceptionReason,'Der Lagerbestand ist unvollständig.');
 assert.equal(failed.items[0].checkResult,'not_checked');
 assert.throws(()=>model.createOrder({...base,orderChecks:{pickableStock:false,holdsClear:true}},actor,at),e=>e.code==='URGENT_EXCEPTION_REASON_REQUIRED');
 assert.throws(()=>model.createOrder({...base,orderChecks:{pickableStock:'true',holdsClear:true}},actor,at),e=>e.code==='URGENT_ORDER_CHECK_INVALID');
 const direct=model.createOrder({...base,orderType:'DIRECT_OUTBOUND',directOutbound:{arrivalAt:'2026-11-11T08:00',arrivalMode:'TRUCK',arrivalProvider:'Test Carrier',dispatchMethod:'EXPRESS',deliveryNotePresent:true,asnWorking:true,holdsClear:true},orderChecks:{pickableStock:false,holdsClear:true}},actor,at);
 assert.equal(direct.orderChecks.pickableStock,null,'stock pickability does not apply to direct outbound');
 assert.equal(direct.orderChecks.checkResult,'passed');
 const single=model.createOrder({...payload,priority:'P3'},actor,at);
 assert.equal(single.orderChecks,null);
});

test('whole-order checks appear in both creation forms, not in fabricated line details',()=>{
 for(const filename of ['urgent-orders.html','urgent-order-report.html']){
  const html=fs.readFileSync(new URL('../assets/'+filename,import.meta.url),'utf8');
  assert.match(html,/wholeOrderChecksTitle/);
  assert.match(html,/wholeOrderStock/);
  assert.match(html,/wholeOrderHolds/);
  assert.match(html,/wholeOrderNotChecked/);
  assert.match(html,/wholeOrderReason/);
  assert.match(html,/orderChecks:isAllLines\(\)\?wholeOrderChecks\(\):null/);
  assert.match(html,/function wholeOrderChecksMarkup|function wholeChecksMarkup/);
  assert.match(html,/data-whole-order-checks=/);
  for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new vm.Script(match[1]));
 }
 for(const lang of ['de','en','pl','es','fr','it']){
  const dict=JSON.parse(fs.readFileSync(new URL('../assets/i18n/'+lang+'.json',import.meta.url),'utf8'));
  for(const key of ['wholeOrderChecksTitle','wholeOrderChecksHelp','wholeOrderStock','wholeOrderHolds','wholeOrderNotChecked','wholeOrderReason','wholeOrderReasonRequired']){
   assert.ok(String(dict['urgentOrderV2.'+key]||'').trim(),lang+' missing '+key);
  }
 }
});

test('clicking whole-order scope hides only line inputs and keeps real whole-order checks usable',()=>{
 for(const [file,publicView] of [['urgent-order-report.html',true],['urgent-orders.html',false]]){
  const html=fs.readFileSync(new URL('../assets/'+file,import.meta.url),'utf8');
  const start=html.indexOf('function syncScope(){'),end=html.indexOf('function wholeOrderChecks(){',start);
  assert.ok(start>=0&&end>start,'scope controller exists for '+file);
  const controls={lines:[{disabled:false}],allChecks:[{id:'stock',disabled:true},{id:'holds',disabled:true}]};
  const ids=publicView?
   {lines:'lines',add:'addLine',check:'wholeOrderChecks',header:'urgentStepTwoHeading',stock:'wholeOrderPickableRow'}:
   {lines:'lineFields',add:'addLine',check:'internalWholeOrderChecks',header:'internalStepTwoHeading'};
  const nodes={};for(const id of Object.values(ids))nodes[id]={hidden:false,textContent:'',querySelectorAll:()=>id===ids.lines?controls.lines:controls.allChecks};
  if(publicView){nodes.orderType={value:'STANDARD'};controls.allChecks[0].id='wholeOrderPickable';}
  let all=true;
  const context={$:id=>nodes[id],isAllLines:()=>all,localeV2:(_key,fallback)=>fallback};
  const sync=vm.runInNewContext(html.slice(start,end)+';syncScope',context);
  sync();
  assert.equal(nodes[ids.lines].hidden,true,file+' must hide per-line entry');
  assert.equal(nodes[ids.check].hidden,false,file+' must show whole-order checks');
  assert.equal(controls.lines[0].disabled,true);
  assert.equal(controls.allChecks[1].disabled,false);
  all=false;sync();
  assert.equal(nodes[ids.lines].hidden,false);
  assert.equal(nodes[ids.check].hidden,true);
  assert.equal(controls.lines[0].disabled,false);
  assert.equal(controls.allChecks[1].disabled,true);
 }
});
