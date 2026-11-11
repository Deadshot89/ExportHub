import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const model=require('../api/shared/urgent-orders.js');
const internal=require('../api/urgent-orders/index.js');
const publicApi=require('../api/urgent-order-public/index.js');

const creator={id:'CS-1982',name:'CS'};
const worker={id:'OPS-1982',name:'Logistik',rights:{shipmentoverview:{edit:true}}};
const another={id:'OPS-OTHER',name:'Anderer Bearbeiter',rights:{shipmentoverview:{edit:true}}};
const date='2026-11-11T09:00:00.000Z';
const payload={orderNumber:'SO198201',delivery:'DRP',priority:'P2',email:'cs@example.org',
  requestedDispatchDate:'2026-11-12',items:[{line:'10',article:'A-1982',quantity:1,pickableStock:true,holdsClear:true}]};
function make(number='SO198201'){return model.createOrder({...payload,orderNumber:number},creator,date);}
function error(code){return e=>e.code===code;}
function publicReq(body){return {headers:{'x-forwarded-for':'192.0.2.28'},body};}

test('RC1982: unworked Urgent Order is hidden immediately, but audited and never deletes shipment files',()=>{
 const o=make();
 assert.equal(model.workStarted(o),false);
 const result=model.requestDeletion(o,creator,'2026-11-11T09:01:00Z');
 assert.equal(result.state,'deleted');
 assert.equal(o.deletedAt,'2026-11-11T09:01:00Z');
 assert.equal(o.deletedBy.id,creator.id);
 assert.equal(o.history.at(-1).event,'deletion_immediate');
 assert.equal(model.activeOrder(o),false);
 assert.equal(o.items.length,1,'item data retained for historical evidence');
 assert.throws(()=>model.requestDeletion(o,creator),error('URGENT_ALREADY_DELETED'));
});

test('RC1982: status change starts processing permanently; only handler can accept pending delete',()=>{
 const o=make();
 model.setItemStatus(o,o.items[0].id,'Waved',worker,date);
 model.setItemStatus(o,o.items[0].id,'Open',worker,date);
 assert.equal(model.workStarted(o),true,'return to Open must not remove processing history');
 const request=model.requestDeletion(o,creator,'2026-11-11T09:02:00Z');
 assert.equal(request.state,'pending');
 assert.equal(o.deletedAt,undefined);
 assert.equal(o.deletion.requestedBy.id,creator.id);
 assert.equal(model.requestDeletion(o,creator).state,'pending','duplicate request remains pending');
 assert.throws(()=>model.resolveDeletion(o,another,true),error('URGENT_DELETE_NOT_HANDLER'));
 assert.throws(()=>model.setItemStatus(o,o.items[0].id,'In Progress',another),error('URGENT_DELETE_PENDING'),'another employee must not take over by changing status while pending');
 assert.equal(model.processingOwner(o).id,worker.id);
 assert.throws(()=>model.recordMailHandoff(o,{kind:'problem',to:o.email,subject:'Problem',body:'A possible shipment issue'},another),error('URGENT_DELETE_PENDING'),'mail activity must not silently change the assigned handler');

 assert.throws(()=>model.resolveDeletion(o,creator,true),error('URGENT_FORBIDDEN'));
 const approval=model.resolveDeletion(o,worker,true,'2026-11-11T09:03:00Z');
 assert.equal(approval.state,'deleted');
 assert.equal(o.deletedBy.id,worker.id);
 assert.equal(o.history.at(-1).event,'deletion_approved');
 assert.throws(()=>model.resolveDeletion(o,worker,true),error('URGENT_DELETE_NOT_PENDING'));
});

test('RC1982: responsible employee may refuse; order remains and requester may try again',()=>{
 const o=make();
 model.setItemStatus(o,o.items[0].id,'In Progress',worker,date);
 model.requestDeletion(o,creator);
 const rejected=model.resolveDeletion(o,worker,false);
 assert.equal(rejected.state,'rejected');
 assert.equal(model.activeOrder(o),true);
 assert.equal(o.history.at(-1).event,'deletion_rejected');
 assert.equal(model.requestDeletion(o,creator).state,'pending');
 assert.throws(()=>model.requestDeletion(o,{id:'DIFFERENT-REQUESTER'}),error('URGENT_FORBIDDEN'));
});

test('RC1982: shipments already shipped or invoiced can never be deleted',()=>{
 for(const status of ['Shipped','Invoiced']){
  const o=make('SO1982'+(status==='Shipped'?'15':'16'));
  model.setItemStatus(o,o.items[0].id,status,worker,date);
  assert.throws(()=>model.requestDeletion(o,creator),error('URGENT_DELETE_DISPATCHED'));
  assert.equal(model.activeOrder(o),true);
 }
 const order=make('SO198217');
 model.setItemStatus(order,order.items[0].id,'In Progress',worker,date);
 model.requestDeletion(order,creator);
 assert.throws(()=>model.setItemStatus(order,order.items[0].id,'Shipped',worker,date),error('URGENT_DELETE_PENDING'),'the pending decision freezes status changes');
 // Simulate a delayed external state import that marks the order as shipped.
 // The approval must revalidate dispatch status before any deletion.
 order.items[0].status='Shipped';
 assert.throws(()=>model.resolveDeletion(order,worker,true),error('URGENT_DELETE_DISPATCHED'),'out-of-band dispatch prevents deletion after request');
});

test('RC1982: email handoff counts as started work; legacy ownerless processing requires takeover',()=>{
 const o=make();
 model.recordMailHandoff(o,{kind:'problem',to:o.email,subject:'Problem',body:'Auftrag überprüfen'},worker,date);
 assert.equal(model.workStarted(o),true);
 assert.equal(model.processingOwner(o).id,worker.id);
 assert.equal(model.requestDeletion(o,creator).state,'pending');
 const old=make('SO198218');
 old.items[0].status='Waved';
 assert.equal(model.workStarted(old),true);
 model.requestDeletion(old,creator);
 assert.throws(()=>model.resolveDeletion(old,worker,true),error('URGENT_DELETE_HANDLER_UNASSIGNED'));
 assert.equal(model.claimDeletionHandler(old,worker).handler.id,worker.id);
 assert.throws(()=>model.claimDeletionHandler(old,another),error('URGENT_DELETE_HANDLER_EXISTS'));
 assert.equal(model.resolveDeletion(old,worker,true).state,'deleted');
});

test('RC1982: public token can delete only own group and never approve another workers deletion',async()=>{
 const original={write:internal.write,readDocument:internal.readDocument};
 const state={orders:[],profiles:{},reporterGroups:[]},refs={environment:'testservice'};
 internal.write=async(_ref,mutator)=>mutator(state);
 internal.readDocument=async()=>state;
 try{
  const first=await publicApi.publicAction(publicReq({action:'create',...payload,orderNumber:'SO198211'}),refs);
  const second=await publicApi.publicAction(publicReq({action:'create',...payload,orderNumber:'SO198212',email:'other@example.org'}),refs);
  const firstId=first.order.id,secondId=second.order.id;
  await assert.rejects(publicApi.publicAction(publicReq({action:'request-delete',id:secondId,accessToken:first.accessToken}),refs),error('URGENT_NOT_FOUND'));
  await assert.rejects(publicApi.publicAction(publicReq({action:'request-delete',id:firstId,accessToken:second.accessToken}),refs),error('URGENT_NOT_FOUND'));
  const deleted=await publicApi.publicAction(publicReq({action:'request-delete',id:firstId,accessToken:first.accessToken}),refs);
  assert.equal(deleted.deleted,true);
  assert.equal(state.orders[0].deletedAt!=null,true);
  assert.equal((await publicApi.publicAction(publicReq({action:'list',accessToken:first.accessToken}),refs)).orders.length,0);
  model.setItemStatus(state.orders[1],state.orders[1].items[0].id,'In Progress',worker,date);
  const request=await publicApi.publicAction(publicReq({action:'request-delete',id:secondId,accessToken:second.accessToken}),refs);
  assert.equal(request.deleted,false);
  assert.equal(request.deletion.state,'pending');
  const reporterView=(await publicApi.publicAction(publicReq({action:'list',accessToken:second.accessToken}),refs)).orders[0];
  assert.equal(reporterView.deletion.state,'pending');
  assert.equal(JSON.stringify(reporterView).includes('OPS-1982'),false,'do not leak processor identity in public read');
  await assert.rejects(publicApi.publicAction(publicReq({action:'respond-delete',id:secondId,accessToken:second.accessToken,approve:true}),refs),error('URGENT_ACTION_UNKNOWN'));
  assert.equal(model.activeOrder(state.orders[1]),true);
 }finally{internal.write=original.write;internal.readDocument=original.readDocument;}
});

test('RC1982: both inline UIs compile and expose the exact approval/delete API actions',()=>{
 for(const path of ['assets/urgent-orders.html','assets/urgent-order-report.html']){
  const html=fs.readFileSync(path,'utf8');
  for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))
   assert.doesNotThrow(()=>new vm.Script(match[1]),path+' inline JavaScript');
  assert.match(html,/data-delete-order|data-delete-action/);
  assert.match(html,/request-delete/);
 }
 const internalHtml=fs.readFileSync('assets/urgent-orders.html','utf8');
 assert.match(internalHtml,/claim-delete-handler/);
 assert.match(internalHtml,/respond-delete/);
 assert.match(internalHtml,/data-urgent-deletion/);
 assert.match(internalHtml,/ownerId===viewerId/,'approval buttons must be visible only to the handler');
 assert.match(fs.readFileSync('api/urgent-orders/index.js','utf8'),/currentUserId:model\.text\(user&&user\.id/);
 assert.match(fs.readFileSync('api/urgent-orders/index.js','utf8'),/model\.resolveDeletion/);
 assert.match(fs.readFileSync('api/urgent-order-public/index.js','utf8'),/groupByToken\(doc,accessToken\)/);
});
