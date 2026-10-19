import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(file,root={}){
  const context=vm.createContext({window:root,globalThis:root,console,Date,Intl,setTimeout,clearTimeout});
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  return root;
}
function loadInternal(){return load('assets/pack-notification-internal.js').ExportHUBPackNotifications;}

function state(){return{
  packNotifications:[{
    id:'pn-1',reference:'PK-20261008ABCDEF',customer:'BSH Hausgeräte',customerId:'C-1',packStationName:'Packtisch 01',deliveryNoteReference:'DNC3019222063',packageType:'Europalette',packageCount:2,totalWeight:680,
    packages:[{packageNo:1,length:120,width:80,height:145,unit:'cm',packagingType:'Europalette'},{packageNo:2,length:120,width:80,height:130,unit:'cm',packagingType:'Europalette'}],
    documents:[{id:'doc-1',name:'DNC3019222063.pdf'}],note:'',status:'in_review',shipmentId:'',createdAt:'2026-10-08T10:42:00.000Z'
  }],
  tasks:[{id:'task:pack:pn-1',sourceType:'pack_notification',sourceId:'pn-1',sourceRef:'PK-20261008ABCDEF',status:'open',unread:true}]
};}
const AT='2026-10-19T12:00:00.000Z';

test('detail shows delivery note reference and offers edit and cancel while open',()=>{
  const internal=loadInternal(),s=state();
  const model=internal.detailModel(s,s.tasks[0]);
  assert.equal(model.deliveryNoteReference,'DNC3019222063');
  const html=internal.detailHtml(model);
  assert.match(html,/pack\.internal\.deliveryNoteReference/);
  assert.match(html,/DNC3019222063/);
  assert.match(html,/data-pack-action="edit"/);
  assert.match(html,/data-pack-action="cancel"/);
  assert.match(html,/data-pack-action="shipment"/);
});

test('edit updates reference, weight, note and rebuilds package rows from count',()=>{
  const internal=loadInternal(),s=state();
  const result=internal.applyEdit(s,'pn-1',{deliveryNoteReference:' SIDE250071282 ',packageCount:'3',totalWeight:'712,5',note:'Ecke beschädigt',packages:[{length:120,width:80,height:150},{length:120,width:80,height:130},{length:60,width:40,height:'40'}]},AT);
  assert.equal(result.ok,true);
  const n=s.packNotifications[0];
  assert.equal(n.deliveryNoteReference,'SIDE250071282');
  assert.equal(n.packageCount,3);
  assert.equal(n.totalWeight,712.5);
  assert.equal(n.note,'Ecke beschädigt');
  assert.deepEqual(JSON.parse(JSON.stringify(n.packages.map(p=>[p.packageNo,p.length,p.width,p.height,p.unit]))),[[1,120,80,150,'cm'],[2,120,80,130,'cm'],[3,60,40,40,'cm']]);
  assert.equal(n.packages[2].packagingType,'Europalette','new rows inherit the packaging type of the last existing row');
  assert.equal(n.editedAt,AT);
  assert.equal(n.status,'in_review','editing does not change the workflow status');
  assert.equal(n.customer,'BSH Hausgeräte','customer identity is not editable here');
});

test('edit rejects missing dimensions, invalid count and weight without touching data',()=>{
  const internal=loadInternal(),s=state(),before=JSON.stringify(s);
  assert.deepEqual({...internal.applyEdit(s,'pn-1',{packageCount:2,totalWeight:10,packages:[{length:1,width:1,height:1},{length:1,width:'',height:1}]},AT)},{ok:false,code:'dimensions',packageNo:2});
  assert.equal(internal.applyEdit(s,'pn-1',{packageCount:0,totalWeight:10,packages:[]},AT).code,'packageCount');
  assert.equal(internal.applyEdit(s,'pn-1',{packageCount:1,totalWeight:0,packages:[{length:1,width:1,height:1}]},AT).code,'totalWeight');
  assert.equal(JSON.stringify(s),before);
});

test('cancel marks notification and its task cancelled and clears unread',()=>{
  const internal=loadInternal(),s=state();
  assert.equal(internal.cancelNotification(s,'pn-1',AT).ok,true);
  assert.equal(s.packNotifications[0].status,'cancelled');
  assert.equal(s.packNotifications[0].cancelledAt,AT);
  assert.equal(s.tasks[0].status,'cancelled');
  assert.equal(s.tasks[0].unread,false);
  assert.equal(internal.unreadCount(s),0);
  const html=internal.detailHtml(internal.detailModel(s,s.tasks[0]));
  assert.doesNotMatch(html,/data-pack-action="(edit|cancel|shipment)"/);
  assert.match(html,/pack\.internal\.cancelledHint/);
});

test('notifications with a linked shipment or already cancelled are locked',()=>{
  const internal=loadInternal(),s=state();
  s.packNotifications[0].shipmentId='SH-1';s.packNotifications[0].status='shipment_created';
  assert.equal(internal.isLocked(s.packNotifications[0]),true);
  assert.equal(internal.applyEdit(s,'pn-1',{packageCount:1,totalWeight:1,packages:[{length:1,width:1,height:1}]},AT).code,'locked');
  assert.equal(internal.cancelNotification(s,'pn-1',AT).code,'locked');
  const html=internal.detailHtml(internal.detailModel(s,s.tasks[0]));
  assert.doesNotMatch(html,/data-pack-action="(edit|cancel)"/);
  assert.match(html,/data-pack-action="shipment"/);
});

test('edit form escapes values and renders one dimension row per package',()=>{
  const internal=loadInternal(),s=state();
  s.packNotifications[0].note='<script>x</script>';
  const html=internal.editHtml(internal.detailModel(s,s.tasks[0]));
  assert.equal((html.match(/data-pack-edit-package=/g)||[]).length,2);
  assert.doesNotMatch(html,/<script>x/);
  assert.match(html,/data-pack-action="edit-save"/);
});

test('create shipment is refused for a cancelled notification',()=>{
  const s=state();s.packNotifications[0].status='cancelled';
  const root={__EXPORTHUB_STATE__:s,addEventListener(){}};
  const bridge=load('assets/pack-notification-shipment.js',root).ExportHUBPackShipment;
  assert.equal(bridge.begin('pn-1'),false);
  assert.equal(root.__EXPORTHUB_PACK_SHIPMENT_PREFILL__,undefined);
});

test('new pack internal texts exist in every supported language',()=>{
  const root=load('assets/i18n/pack-notification.js');
  const packs=root.ExportHUBPackI18n.packs;
  const keys=['pack.internal.deliveryNoteReference','pack.internal.edit','pack.internal.cancel','pack.internal.cancelConfirm','pack.internal.cancelledHint','pack.internal.backToDetail','pack.internal.editTitle','pack.internal.discard','pack.internal.save','pack.internal.saveFailed','pack.internal.editError.dimensions','pack.internal.editError.packageCount','pack.internal.editError.totalWeight','pack.internal.editError.locked','pack.internal.editError.notFound'];
  for(const lang of ['de','en','pl','es','fr','it'])for(const key of keys)assert.ok(packs[lang][key],`${lang}:${key}`);
});
