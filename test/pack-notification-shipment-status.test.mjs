import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadBridge(root={}){
  root.addEventListener=root.addEventListener||(()=>{});
  const context=vm.createContext({window:root,globalThis:root,console,Date});
  vm.runInContext(fs.readFileSync('assets/pack-notification-shipment.js','utf8'),context,{filename:'pack-notification-shipment.js'});
  return root.ExportHUBPackShipment;
}
function state(shipment,status='shipment_created'){return{
  packNotifications:[{id:'pn-1',reference:'PK-1',status,shipmentId:'SH-1',updatedAt:'2026-10-10T08:00:00.000Z'}],
  shipments:[Object.assign({id:'SH-1',ref:'SH-1',packNotificationId:'pn-1'},shipment)],
  tasks:[{id:'task:pack:pn-1',sourceType:'pack_notification',sourceId:'pn-1',status:'in_progress',unread:false},{id:'other',sourceType:'manual',sourceId:'pn-1',status:'open'}]
};}
const AT='2026-10-19T12:00:00.000Z';

test('fully picked up shipment completes the pack notification and its task',()=>{
  const bridge=loadBridge(),s=state({status:'Abgeholt'});
  const changes=bridge.syncStatuses(s,AT);
  assert.equal(changes.length,1);
  assert.equal(s.packNotifications[0].status,'completed');
  assert.equal(s.packNotifications[0].closedAt,AT);
  assert.equal(s.tasks[0].status,'done');
  assert.equal(s.tasks[1].status,'open','tasks of other sources stay untouched');
});

test('remaining colli keep the pack notification open, zero remaining completes it',()=>{
  const bridge=loadBridge(),s=state({expectedColliCount:4,collectedPickupCollis:2,status:'Teilweise abgeholt'});
  assert.equal(bridge.syncStatuses(s,AT).length,0);
  assert.equal(s.packNotifications[0].status,'shipment_created');
  s.shipments[0].pickupConfirmedAt=AT;
  assert.equal(bridge.syncStatuses(s,AT).length,1);
  assert.equal(s.packNotifications[0].status,'completed');
});

test('cancelled shipment cancels the pack notification',()=>{
  const bridge=loadBridge(),s=state({status:'Storniert'});
  bridge.syncStatuses(s,AT);
  assert.equal(s.packNotifications[0].status,'cancelled');
  assert.equal(s.tasks[0].status,'cancelled');
});

test('open shipments, notifications without shipment and closed notifications are not changed',()=>{
  const bridge=loadBridge();
  const open=state({status:'Angemeldet'});
  assert.equal(bridge.syncStatuses(open,AT).length,0);
  const unlinked=state({status:'Abgeholt'},'in_review');unlinked.packNotifications[0].shipmentId='';
  assert.equal(bridge.syncStatuses(unlinked,AT).length,0);
  const done=state({status:'Storniert'},'completed');
  assert.equal(bridge.syncStatuses(done,AT).length,0);
  assert.equal(done.packNotifications[0].status,'completed');
});

test('sync is idempotent',()=>{
  const bridge=loadBridge(),s=state({status:'POD vorhanden'});
  assert.equal(bridge.syncStatuses(s,AT).length,1);
  assert.equal(bridge.syncStatuses(s,'2026-10-20T00:00:00.000Z').length,0);
  assert.equal(s.packNotifications[0].updatedAt,AT);
});

test('bridge re-checks pack status after shipment events',()=>{
  const source=fs.readFileSync('assets/pack-notification-shipment.js','utf8');
  assert.match(source,/onShipmentSaved\(event\)\{\s*scheduleSync\(\)/);
  for(const name of ['exporthub:shipment-updated','exporthub:state-loaded','exporthub:sync'])assert.ok(source.includes(`'${name}'`),name);
  assert.match(source,/revertSync\(changes\)/,'failed persistence must roll the status change back');
});
