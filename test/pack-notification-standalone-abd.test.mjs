import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {injectPackAbdOwnership,PACK_ASSETS,injectPackRuntime} from '../.github/packmeldungen/build-three-env.mjs';

function fixture(){
  const state={
    packNotifications:[{id:'PN-1',reference:'PACK-01',status:'in_review',customer:'Acme Export',customerId:'CUS-1',
      customerAccount:'10001',deliveryNoteReference:'SIDE250075003',packageCount:3,totalWeight:75,
      packages:[{packagingType:'Europalette'},{packagingType:'Europalette'},{packagingType:'Karton'}],
      documents:[{name:'SIDE250075003.pdf',blobName:'private-test-blob'}]}],
    abdRequests:[],shipments:[{id:'SHIP-1',ref:'9Z7L82'}]
  };
  const listeners={};
  const calls={views:[],newAbd:0,edit:[],render:0,save:[]};
  const doc={readyState:'complete',addEventListener(){},getElementById(){return null},querySelector(){return null}};
  const root={
    document:doc,
    __EXPORTHUB_GET_STATE__:()=>state,
    addEventListener(name,fn){listeners[name]=fn},
    setView(view){calls.views.push(view);state.view=view},
    ExportHUBClean:{queueSave(reason){calls.save.push(reason);return Promise.resolve(true)}},
    ExportHUBRC626:{
      newAbd(){calls.newAbd++;state.abdDraft={ref:'A1B2C3',source:'manual',rows:[],invoiceFiles:[]}},
      editAbd(id){calls.edit.push(id);state.abdDraft={...state.abdRequests.find(x=>x.id===id)}},
      renderAbd(){calls.render++}
    },
    ExportHUBRC1294ABDAnalysis:{setMode(mode,skip){calls.mode=[mode,skip]}},
    alert(message){calls.alert=message}
  };
  const code=fs.readFileSync('assets/pack-notification-abd.js','utf8');
  vm.runInNewContext(code,{window:root,globalThis:root,console,Promise,Number,String,Array,Math},{filename:'pack-notification-abd.js'});
  return {root,state,calls,listeners,api:root.ExportHUBPackAbd};
}

test('Pack -> manual ABD prefill keeps no shipment and does not save an ABD request on opening',()=>{
  const {state,calls,api}=fixture();
  assert.equal(api.begin('PN-1'),true);
  assert.deepEqual(calls.views,['abd']);
  assert.equal(calls.newAbd,1);
  assert.equal(state.abdDraft.source,'manual');
  assert.equal(state.abdDraft.linkedShipmentId,'');
  assert.equal(state.abdDraft.packNotificationId,'PN-1');
  assert.equal(state.abdDraft.packNotificationRef,'PACK-01');
  assert.equal(state.abdDraft.customerName,'Acme Export');
  assert.equal(state.abdDraft.deliveryNotes,'SIDE250075003');
  assert.equal(state.abdDraft.country,undefined,'no inferred country');
  assert.deepEqual(Array.from(state.abdDraft.invoiceFiles),[],'private Pack documents are viewed by reference, not copied into invoice files');
  assert.equal(state.abdRequests.length,0,'opening must not claim an ABD was saved');
  assert.equal(state.shipments.length,1,'no shipment created');
  assert.equal(calls.mode[0],'manual');
  assert.deepEqual(Array.from(state.abdDraft.rows,r=>[r.type,r.count,r.weight]),[
    ['Europalette','2','50'],['Karton','1','25']
  ]);
});
test('repeated Pack ABD click resumes the same draft and does not generate a second reference',()=>{
  const {state,calls,api}=fixture();
  api.begin('PN-1');
  const ref=state.abdDraft.ref;
  api.begin('PN-1');
  assert.equal(calls.newAbd,1);
  assert.equal(state.abdDraft.ref,ref);
});
test('saved Pack ABD reopens by its own ID even when a shipment exists',()=>{
  const {state,calls,api}=fixture();
  state.abdRequests.push({id:'ABD-1',ref:'A1B2C3',source:'manual',linkedShipmentId:'',
    packNotificationId:'PN-1',packNotificationRef:'PACK-01'});
  state.packNotifications[0].abdRequestId='ABD-1';
  state.packNotifications[0].abdRequestRef='A1B2C3';
  assert.equal(api.begin('PN-1'),true);
  assert.deepEqual(calls.edit,['ABD-1']);
  assert.equal(calls.newAbd,0);
});
test('foreign, ambiguous or missing Pack ABD linkage fails closed',()=>{
  const {state,calls,api}=fixture();
  state.abdRequests.push({id:'ABD-FOREIGN',ref:'A1B2C3',packNotificationId:'PN-2',packNotificationRef:'PACK-02'});
  state.packNotifications[0].abdRequestId='ABD-FOREIGN';
  state.packNotifications[0].abdRequestRef='A1B2C3';
  assert.equal(api.begin('PN-1'),false);
  assert.equal(calls.newAbd,0);
  assert.match(calls.alert,/nicht eindeutig/);
  delete state.packNotifications[0].abdRequestId;
  delete state.packNotifications[0].abdRequestRef;
  state.abdRequests.push({id:'ABD-1',ref:'B1B2C3',packNotificationId:'PN-1',packNotificationRef:'PACK-01'});
  state.abdRequests.push({id:'ABD-2',ref:'C1B2C3',packNotificationId:'PN-1',packNotificationRef:'PACK-01'});
  assert.equal(api.begin('PN-1'),false);
  assert.equal(calls.newAbd,0);
});
test('cancelled Pack notification must not create a standalone ABD',()=>{
  const {state,calls,api}=fixture();
  state.packNotifications[0].status='cancelled';
  assert.equal(api.begin('PN-1'),false);
  assert.equal(calls.newAbd,0);
});
test('Pack ABD rows leave missing weights and package types open for review',()=>{
  const {api}=fixture();
  const rows=api.rowsFromPack({packageCount:2,packageType:'',totalWeight:0,packages:[]});
  assert.equal(rows.length,1);
  assert.equal(rows[0].type,'');
  assert.equal(rows[0].weight,'');
  assert.equal(rows[0].count,'2');
});
test('release patch explicitly guards saved Pack ownership and prevents shipment auto-linking',()=>{
  for(const file of ['index.html','TESTVERSION.html']){
    const source=fs.readFileSync(file,'utf8');
    const out=injectPackAbdOwnership(source,file);
    assert.match(out,/function shipmentForAbd\(a\)\{if\(!a\|\|q\(a\.packNotificationId\)\)return null/);
    assert.match(out,/packNotificationId:q\(d\.packNotificationId\|\|existing&&existing\.packNotificationId\)/);
    assert.match(out,/var sh=!item\.packNotificationId&&item\.linkedShipmentId/);
    assert.match(out,/pnSaved\.abdRequestId=item\.id/);
    assert.match(out,/shipRefUsed=shipments\(\)\.some/);
    assert.match(out,/source=d\.packNotificationId\?'Aus Packmeldung übernommen'/);
    assert.doesNotMatch(source,/var sh=!item\.packNotificationId&&item\.linkedShipmentId/);
    assert.equal(out.includes('function saveAbdInternal(showAlert,status)'),true);
  }
  assert.throws(()=>injectPackAbdOwnership('function saveAbdInternal(showAlert,status){}','TESTVERSION.html'),/contract drift/);
  assert.ok(PACK_ASSETS.includes('pack-notification-abd.js'));
  const tiny='<html><head></head><body></body></html>';
  assert.equal(injectPackRuntime(tiny,'demo.html').includes('/assets/pack-notification-abd.js?v=1'),true);
});
test('internal detail has two independent actions and locale labels exist in six languages',()=>{
  const internal=fs.readFileSync('assets/pack-notification-internal.js','utf8');
  assert.match(internal,/data-pack-action="abd"/);
  assert.match(internal,/exporthub:pack-create-abd/);
  assert.match(internal,/else if\(action==='abd'\)dispatchAbd\(model\)/);
  const root={};
  vm.runInNewContext(fs.readFileSync('assets/i18n/pack-notification.js','utf8'),{window:root,globalThis:root,console,Intl},{filename:'pack-notification.js'});
  for(const language of ['de','en','pl','es','fr','it']){
    assert.ok(root.ExportHUBPackI18n.packs[language]['pack.internal.createAbd']);
    assert.ok(root.ExportHUBPackI18n.packs[language]['pack.internal.openAbd']);
  }
});
