import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const source=fs.readFileSync('assets/pack-notification-shipment.js','utf8');
  const root={};
  vm.runInContext(source,vm.createContext({window:root,globalThis:root,console,Date,Intl,setTimeout,clearTimeout,Event:function(){},KeyboardEvent:function(){}}),{filename:'pack-notification-shipment.js'});
  return root.ExportHUBPackShipment;
}
function loadWithRoot(root){
  const source=fs.readFileSync('assets/pack-notification-shipment.js','utf8');
  const FakeEvent=function(type){this.type=type;};
  const FakeKeyboardEvent=function(type,init={}){this.type=type;Object.assign(this,init);};
  vm.runInContext(source,vm.createContext({window:root,globalThis:root,console,Date,Intl,setTimeout,clearTimeout,Event:FakeEvent,KeyboardEvent:FakeKeyboardEvent}),{filename:'pack-notification-shipment.js'});
  return root.ExportHUBPackShipment;
}
function state(){return{packNotifications:[{id:'pn-1',reference:'PK-1',customer:'BSH',customerId:'C100',customerAccount:'9000003004',customerSource:'master',deliveryNoteReference:'LS1',packageType:'Europalette',packageCount:2,totalWeight:600,packages:[{packageNo:1,length:120,width:80,height:140,unit:'cm'},{packageNo:2,length:120,width:80,height:130,unit:'cm'}],documents:[{id:'d1',name:'LS1.pdf',storage:'blob',blobName:'rc1059/production/aa/'+('a'.repeat(64)),mimeType:'application/pdf',size:12}],status:'in_review'}],tasks:[{id:'task:pack:pn-1',sourceType:'pack_notification',sourceId:'pn-1',sourceRef:'PK-1'}],shipments:[]};}

test('shipment prefill preserves pack origin, customer identity, dimensions, weight and private document references',()=>{
  const api=load(),s=state(),n=s.packNotifications[0];
  const prefill=api.shipmentPrefill(n);
  assert.equal(prefill.packNotificationId,'pn-1');
  assert.equal(prefill.packNotificationRef,'PK-1');
  assert.equal(prefill.customerName,'BSH');
  assert.equal(prefill.customerId,'C100');
  assert.equal(prefill.customerAccount,'9000003004');
  assert.equal(prefill.customerSource,'master');
  assert.equal(prefill.totalWeight,600);
  assert.equal(prefill.rows.length,2);
  assert.equal(prefill.rows[0].l,120);
  assert.equal(prefill.deliveryFiles.length,1);
  assert.equal(prefill.deliveryFiles[0].blobName,n.documents[0].blobName);
  assert.equal(prefill.deliveryFiles[0].customerVisible,false);
  assert.equal(prefill.deliveryFiles[0].customerAvisVisible,false);
});

test('manual customer remains a valid prefill without a fake customer id',()=>{
  const api=load(),s=state(),n=s.packNotifications[0];
  n.customer='Neuer Kunde GmbH';n.customerId='';n.customerAccount='';n.customerSource='manual';
  const prefill=api.shipmentPrefill(n);
  assert.equal(prefill.customerName,'Neuer Kunde GmbH');
  assert.equal(prefill.customerId,'');
  assert.equal(prefill.customerAccount,'');
  assert.equal(prefill.customerSource,'manual');
});

test('RC1515: manual pack customer prefill must not trigger destructive customer lookup events',()=>{
  const customer={
    value:'',events:[],
    dispatchEvent(event){
      this.events.push(event.type);
      if(event.type==='change'||(event.type==='keydown'&&event.key==='Enter'))this.value=' ·  · ';
    }
  };
  const draft={};
  const root={
    __EXPORTHUB_GET_STATE__:()=>({shipment:draft}),
    document:{
      getElementById:id=>id==='shipmentCustomerSearch'?customer:null,
      querySelectorAll:()=>[]
    }
  };
  const api=loadWithRoot(root);
  const prefill=api.shipmentPrefill({id:'pn-manual',reference:'PK-MANUAL',customer:'E2E PACK CUSTOMER A',customerId:'',customerAccount:'',customerSource:'manual',packageCount:1,documents:[]});
  api.applyPrefillToMountedForm(prefill);
  assert.equal(customer.value,'E2E PACK CUSTOMER A');
  assert.equal(customer.events.includes('change'),false);
  assert.equal(customer.events.includes('keydown'),false);
  assert.equal(draft.packNotificationCustomer.name,'E2E PACK CUSTOMER A');
});

test('RC1535: live input lookup must not erase a manual pack customer during shipment handoff',()=>{
  const draft={customerSearch:''};
  const customer={
    value:'',events:[],
    dispatchEvent(event){
      this.events.push(event.type);
      if(event.type==='input'||event.type==='change'||(event.type==='keydown'&&event.key==='Enter')){
        this.value='';
        draft.customerSearch='';
      }
    }
  };
  const root={
    __EXPORTHUB_GET_STATE__:()=>({shipment:draft}),
    document:{
      getElementById:id=>id==='shipmentCustomerSearch'?customer:null,
      querySelectorAll:()=>[]
    }
  };
  const api=loadWithRoot(root);
  const prefill=api.shipmentPrefill({id:'pn-live',reference:'PK-LIVE',customer:'E2E PACK CUSTOMER A',customerId:'',customerAccount:'',customerSource:'manual',packageCount:1,documents:[]});
  api.applyPrefillToMountedForm(prefill);
  assert.equal(customer.value,'E2E PACK CUSTOMER A','sichtbarer manueller Kunde muss erhalten bleiben');
  assert.deepEqual(customer.events,[],'manueller Packkunde darf keinen Kundensuch-Lookup auslösen');
  assert.equal(draft.customerSearch,'E2E PACK CUSTOMER A','Entwurfswert muss ohne Lookup direkt synchronisiert werden');
  assert.equal(draft.packNotificationCustomer.name,'E2E PACK CUSTOMER A');
});

test('RC1516: pack task starts the canonical blank shipment before applying a manual customer',async()=>{
  const notification={id:'pn-manual',reference:'PK-MANUAL',customer:'E2E PACK CUSTOMER A',customerId:'',customerAccount:'',customerSource:'manual',packageCount:1,totalWeight:680,packages:[{packageNo:1,length:120,width:80,height:145}],documents:[]};
  const draft={customerId:'FOREIGN-CUSTOMER',customerAccount:'9000009999',customerSearch:' ·  · ',recipientAddress:'Wrong customer address'};
  const shared={packNotifications:[notification],shipments:[],shipment:draft};
  let canonicalStarts=0;
  const customer={
    value:'',
    dispatchEvent(event){if(event.type==='input')draft.customerSearch=this.value;}
  };
  const root={
    __EXPORTHUB_GET_STATE__:()=>shared,
    ExportHUBShipment420:{
      startNewShipment(){
        canonicalStarts+=1;
        for(const key of ['customerId','customerAccount','customerSearch','recipientAddress'])draft[key]='';
        draft.__rc562Fresh=true;
      }
    },
    setView(){},
    document:{
      getElementById(id){
        if(id==='rc363BlockCustomer')return{};
        if(id==='shipmentCustomerSearch')return customer;
        return null;
      },
      querySelectorAll:()=>[]
    }
  };
  const api=loadWithRoot(root);
  assert.equal(api.begin('pn-manual'),true);
  await new Promise(resolve=>setTimeout(resolve,60));
  assert.equal(canonicalStarts,1,'Packmeldung muss den kanonischen frischen Sendungsentwurf starten');
  assert.equal(draft.customerId,'','vorselektierter Fremdkunde darf nicht erhalten bleiben');
  assert.equal(draft.customerAccount,'','fremde Kundennummer darf nicht erhalten bleiben');
  assert.equal(draft.recipientAddress,'','fremde Empfängeradresse darf nicht erhalten bleiben');
  assert.equal(draft.customerSearch,'E2E PACK CUSTOMER A');
  assert.equal(customer.value,'E2E PACK CUSTOMER A');
});

test('existing shipment linked to pack notification is found and prevents duplicate creation',()=>{
  const api=load(),s=state();
  s.shipments.push({id:'sh-1',ref:'ABC123',packNotificationId:'pn-1'});
  s.packNotifications[0].shipmentId='sh-1';
  assert.equal(api.findShipmentForNotification(s,s.packNotifications[0]).id,'sh-1');
});

test('linkShipment writes bidirectional relation and marks notification shipment_created',()=>{
  const api=load(),s=state(),shipment={id:'sh-1',ref:'ABC123',deliveryFiles:[]};s.shipments.push(shipment);
  api.linkShipment(s,s.packNotifications[0],shipment,'2026-10-08T11:00:00.000Z');
  assert.equal(s.packNotifications[0].shipmentId,'sh-1');
  assert.equal(s.packNotifications[0].status,'shipment_created');
  assert.equal(shipment.packNotificationId,'pn-1');
  assert.equal(shipment.packNotificationRef,'PK-1');
  assert.equal(shipment.deliveryFiles.length,1);
  assert.equal(shipment.deliveryFiles[0].blobName,s.packNotifications[0].documents[0].blobName);
  assert.equal(shipment.deliveryFiles[0].customerAvisVisible,false);
});
test('Packmeldung attaches the real stored PDF to the canonical shipment, not only to a detached save-event snapshot',async()=>{
  const s=state(),events=new Map(),savedSnapshots=[];
  const root={
    __EXPORTHUB_GET_STATE__:()=>s,
    addEventListener(name,listener){events.set(name,listener);},
    setView(){},
    ExportHUBClean:{
      queueSave(){return true;},
      flushSave(){savedSnapshots.push(JSON.parse(JSON.stringify(s)));return true;}
    }
  };
  const api=loadWithRoot(root);
  assert.equal(api.begin('pn-1'),true);
  const persisted={id:'sh-1',ref:'ABC123',deliveryFiles:[]};
  const savedAlias={id:'sh-1',ref:'ABC123',deliveryFiles:[]};
  s.shipments.push(persisted);
  s.savedShipments=[savedAlias];
  const detached={id:'sh-1',ref:'ABC123',deliveryFiles:[]};
  const listener=events.get('exporthub:shipment-saved');
  assert.equal(typeof listener,'function');
  assert.equal(await listener({detail:{shipment:detached}}),true);
  const source=s.packNotifications[0].documents[0];
  for(const item of [persisted,savedAlias]){
    assert.equal(item.packNotificationId,'pn-1');
    assert.equal(item.deliveryFiles.length,1);
    assert.equal(item.deliveryFiles[0].name,source.name);
    assert.equal(item.deliveryFiles[0].storage,'blob');
    assert.equal(item.deliveryFiles[0].blobName,source.blobName);
    assert.equal(item.deliveryFiles[0].customerAvisVisible,false);
  }
  assert.equal(detached.deliveryFiles.length,0,'transient event object should not be mistaken for a persisted shipment');
  assert.equal(savedSnapshots.length,1);
  assert.equal(savedSnapshots[0].shipments[0].deliveryFiles[0].blobName,source.blobName);
  assert.equal(savedSnapshots[0].packNotifications[0].status,'shipment_created');
});

test('metadata-only delivery-note names cannot masquerade as actual uploaded PDFs',()=>{
  const api=load(),s=state(),n=s.packNotifications[0];
  n.documents=[{id:'empty',name:'DNC3019222063.pdf',mimeType:'application/pdf',size:12345}];
  assert.equal(api.shipmentPrefill(n).deliveryFiles.length,0);
  const saved={id:'s2',ref:'ABC123'};
  // The public helper still links a notification's relationship, while the
  // save-event bridge must refuse to mark a metadata-only upload complete.
  const calls=new Map();
  const root={__EXPORTHUB_GET_STATE__:()=>s,addEventListener:(name,fn)=>calls.set(name,fn),setView(){}};
  const bridge=loadWithRoot(root);
  assert.equal(bridge.begin('pn-1'),true);
  s.shipments.push(saved);
  return Promise.resolve(calls.get('exporthub:shipment-saved')({detail:{shipment:{...saved}}})).then(result=>{
    assert.equal(result,false);
    assert.equal(s.packNotifications[0].shipmentId,undefined);
    assert.equal(saved.deliveryFiles,undefined);
  });
});
