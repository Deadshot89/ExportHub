import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/pack-notification-shipment.js',import.meta.url),'utf8');

function setup(overrides={}){
  const note={
    id:'pn-1',reference:'PK-1',status:'in_review',customer:'Pack Customer',
    customerId:'C1',customerSource:'master',packageCount:1,totalWeight:10,
    packages:[{packageNo:1,length:120,width:80,height:100}],documents:[]
  };
  const state={packNotifications:[note],shipments:[],savedShipments:[],tasks:[],shipment:null,...overrides};
  const calls=[];
  const root={
    __EXPORTHUB_GET_STATE__:()=>state,
    addEventListener(){},
    ExportHUBRC325:{route(view,source){calls.push(['route',view,source]);return false;}},
    ExportHUBShipment420:{
      startNewShipment(){calls.push(['new']);return true;},
      openSavedShipment(ref){calls.push(['edit',ref]);return false;}
    },
    ExportHUBShipmentView:{open(ref,source){calls.push(['readonly',ref,source]);return true;}}
  };
  vm.runInContext(source,vm.createContext({
    window:root,globalThis:root,Date,Intl,console,
    setTimeout(){return 1;},clearTimeout(){},Event:function(){},KeyboardEvent:function(){}
  }),{filename:'pack-notification-shipment.js'});
  return{state,note,calls,root,api:root.ExportHUBPackShipment};
}

test('RC1910: unsaved Pack draft reopens existing editor without losing user changes',()=>{
  const x=setup();
  const draft={
    id:'DRAFT-local-1',ref:'ABC123',status:'Entwurf',__rc562Fresh:true,
    packNotificationId:'pn-1',packNotificationRef:'PK-1',
    customerSearch:'Customer edited manually',
    rows:[{type:'Europalette',count:2,l:120,w:80,h:155,weight:900}]
  };
  x.state.shipment=draft;x.state.currentShipment=draft;
  assert.equal(x.api.begin('pn-1'),true);
  assert.deepEqual(x.calls,[['route','shipment','pack-draft-resume']]);
  assert.equal(x.state.shipment,draft);
  assert.equal(draft.customerSearch,'Customer edited manually');
  assert.equal(draft.rows[0].h,155);
  assert.equal(x.root.__EXPORTHUB_PACK_SHIPMENT_PREFILL__.packNotificationId,'pn-1');
});

test('RC1910: saved shipment in Entwurf opens the canonical editable editor, not readonly view',()=>{
  const x=setup(),saved={id:'SH-1',ref:'ABC123',status:'Entwurf',draft:true,packNotificationId:'pn-1',packNotificationRef:'PK-1'};
  x.state.savedShipments.push(saved);
  assert.equal(x.api.begin('pn-1'),true);
  assert.deepEqual(x.calls,[['edit','ABC123']]);
});

test('RC1910: completed linked shipment still opens readonly shipment view',()=>{
  const x=setup(),saved={id:'SH-2',ref:'ABC123',status:'Abgeschlossen',packNotificationId:'pn-1',packNotificationRef:'PK-1'};
  x.state.shipments.push(saved);
  assert.equal(x.api.begin('pn-1'),true);
  assert.deepEqual(x.calls,[['readonly','ABC123','tasks']]);
});

test('RC1910: a foreign persisted shipment is never opened instead of an owned draft',()=>{
  const x=setup(),draft={id:'DRAFT-local',ref:'RIGHT1',packNotificationId:'pn-1',packNotificationRef:'PK-1',status:'Entwurf'};
  x.state.shipment=draft;
  x.state.savedShipments.push({id:'DRAFT-local',ref:'WRONG1',packNotificationId:'pn-foreign',packNotificationRef:'PK-FOREIGN',status:'Entwurf'});
  assert.equal(x.api.begin('pn-1'),true);
  assert.deepEqual(x.calls,[['route','shipment','pack-draft-resume']]);
});

test('RC1910: linked shipment temporarily absent must not create a duplicate draft',()=>{
  const x=setup();
  x.note.shipmentId='SH-existing';x.note.shipmentRef='ABC123';
  assert.equal(x.api.begin('pn-1'),false);
  assert.deepEqual(x.calls,[]);
});

test('RC1910: new Pack notification still creates one new shipment',()=>{
  const x=setup();
  assert.equal(x.api.begin('pn-1'),true);
  assert.deepEqual(x.calls,[['new']]);
});

test('RC1910: cancelled Pack notification never starts or resumes an editor',()=>{
  const x=setup();x.note.status='cancelled';
  assert.equal(x.api.begin('pn-1'),false);
  assert.deepEqual(x.calls,[]);
});
