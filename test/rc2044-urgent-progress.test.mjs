import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import progress from '../api/shared/urgent-progress.js';

const now='2026-11-12T12:00:00.000Z';
const reporter={id:'REPORTER:abc',name:'Customer Service'};
const manager={id:'warehouse-1',name:'Logistics'};
function order(orderType='DIRECT_OUTBOUND'){
 return {
  id:'order-a',createdAt:'2026-11-11T10:00:00.000Z',updatedAt:now,orderType,
  items:[{id:'item',status:'Open',article:'A',quantity:5}],history:[{event:'created',at:now}],
  createdBy:reporter
 };
}
function err(code){return e=>e&&e.code===code;}

test('normal Urgent Orders have six stages; later incoming goods require seven',()=>{
 const normal=progress.view(order('STANDARD'));
 const direct=progress.view(order());
 assert.deepEqual(normal.steps.map(s=>s.key),['created','abd','ready','collected','pod','completed']);
 assert.deepEqual(direct.steps.map(s=>s.key),['created','received','abd','ready','collected','pod','completed']);
 assert.equal(normal.processed,1);
 assert.equal(normal.steps[1].state,'pending');
 assert.equal(direct.steps[0].state,'done');
});

test('creator confirms only the optional receipt, leaves D365 item status intact and creates a notice',()=>{
 const o=order(),originalItem=structuredClone(o.items);
 assert.throws(()=>progress.confirm(o,'abd',reporter,now,{canConfirmReceipt:true}),err('URGENT_PROGRESS_FORBIDDEN'));
 assert.throws(()=>progress.confirm(order('STANDARD'),'received',reporter,now,{canConfirmReceipt:true}),err('URGENT_PROGRESS_STEP_INVALID'));
 assert.throws(()=>progress.confirm(o,'received',reporter,now,{}),err('URGENT_PROGRESS_FORBIDDEN'));
 const view=progress.confirm(o,'received',reporter,now,{canConfirmReceipt:true});
 assert.equal(view.steps[1].state,'done');
 assert.deepEqual(o.items,originalItem);
 assert.equal(o.progress.receiptNotice.at,now);
 assert.equal(progress.unreadReceipt(o,'warehouse-1'),true);
 assert.throws(()=>progress.confirm(o,'received',reporter,now,{canConfirmReceipt:true}),err('URGENT_PROGRESS_ALREADY_CONFIRMED'));
 assert.throws(()=>progress.confirm(o,'pod',reporter,now,{canConfirmReceipt:true}),err('URGENT_PROGRESS_FORBIDDEN'));
});

test('skipped steps require explicit exact selection plus a reason',()=>{
 const o=order('STANDARD');
 assert.deepEqual(progress.pendingBefore(o,'collected'),['abd','ready']);
 assert.throws(()=>progress.confirm(o,'collected',manager,now,{canManage:true}),err('URGENT_PROGRESS_SKIP_CONFIRM_REQUIRED'));
 assert.throws(()=>progress.confirm(o,'collected',manager,now,{canManage:true,confirmSkipped:true,skippedSteps:['abd']}),err('URGENT_PROGRESS_SKIP_CONFIRM_REQUIRED'));
 assert.throws(()=>progress.confirm(o,'collected',manager,now,{canManage:true,confirmSkipped:true,skippedSteps:['ready','abd'],skipReason:'Invoice delay'}),err('URGENT_PROGRESS_SKIP_CONFIRM_REQUIRED'));
 assert.throws(()=>progress.confirm(o,'collected',manager,now,{canManage:true,confirmSkipped:true,skippedSteps:['abd','ready'],skipReason:'test'}),err('URGENT_PROGRESS_SKIP_REASON_REQUIRED'));
 assert.equal(o.progress,undefined);
 const view=progress.confirm(o,'collected',manager,now,{canManage:true,confirmSkipped:true,skippedSteps:['abd','ready'],skipReason:'Verified by the logistics coordinator'});
 assert.deepEqual(view.steps.map(s=>s.state),['done','skipped','skipped','done','pending','pending']);
 assert.equal(o.history.filter(x=>x.event==='progress_skipped').length,2);
 assert.equal(o.history.find(x=>x.step==='ready').reason,'Verified by the logistics coordinator');
});

test('the workflow cannot mark the same or skipped stage twice',()=>{
 const o=order();
 progress.confirm(o,'abd',manager,now,{canManage:true,confirmSkipped:true,skippedSteps:['received'],skipReason:'Receipt not applicable after inspection'});
 assert.throws(()=>progress.confirm(o,'received',reporter,now,{canConfirmReceipt:true}),err('URGENT_PROGRESS_ALREADY_CONFIRMED'));
 assert.throws(()=>progress.confirm(o,'abd',manager,now,{canManage:true}),err('URGENT_PROGRESS_ALREADY_CONFIRMED'));
 assert.equal(progress.view(o).completed,false);
});

test('completion must be explicitly confirmed and stays separate from item invoicing',()=>{
 const o=order('STANDARD');
 progress.confirm(o,'completed',manager,now,{canManage:true,confirmSkipped:true,skippedSteps:['abd','ready','collected','pod'],skipReason:'Legacy process verified manually'});
 assert.equal(progress.view(o).completed,true);
 assert.equal(o.items[0].status,'Open');
 assert.equal(o.progress.steps.pod.state,'skipped');
});

test('goods-receipt notifications are acknowledged separately for each authorized internal viewer',()=>{
 const o=order();
 progress.confirm(o,'received',reporter,now,{canConfirmReceipt:true});
 assert.equal(progress.acknowledgeReceipt(o,manager,now),true);
 assert.equal(progress.acknowledgeReceipt(o,manager,now),false);
 assert.equal(progress.unreadReceipt(o,manager.id),false);
 assert.equal(progress.unreadReceipt(o,'warehouse-2'),true);
 assert.equal(progress.unreadReceipt(o,''),false);
 assert.equal(progress.view(o,true).steps[1].actorName,undefined);
 assert.equal(progress.view(o,true).receiptNotice,undefined);
});

test('pending deletion and deleted requests cannot progress',()=>{
 const a=order();a.deletion={state:'pending'};
 assert.throws(()=>progress.confirm(a,'received',reporter,now,{canConfirmReceipt:true}),err('URGENT_DELETE_PENDING'));
 const b=order();b.deletedAt=now;
 assert.throws(()=>progress.confirm(b,'received',reporter,now,{canConfirmReceipt:true}),err('URGENT_NOT_FOUND'));
});

test('both UI surfaces use shared progress markup and dedicated authenticated mutation routes',()=>{
 const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
 const internal=read('../assets/urgent-orders.html');
 const publicPage=read('../assets/urgent-order-report.html');
 const internalApi=read('../api/urgent-orders/index.js');
 const publicApi=read('../api/urgent-order-public/index.js');
 for(const html of [internal,publicPage]){
  assert.match(html,/urgent-progress-ui\.js/);
  assert.match(html,/urgent-progress-ui\.css/);
  assert.match(html,/UrgentProgressUI\.markup/);
 }
 assert.match(internal,/update-progress/);
 assert.match(internal,/acknowledge-receipt/);
 assert.match(publicPage,/confirm-received/);
 assert.match(internalApi,/progress\.confirm/);
 assert.match(publicApi,/groupByToken\(doc,accessToken\)/);
 assert.match(publicApi,/progress\.confirm\(order,'received'/);
});
