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

test('P0: reused technical shipment IDs resolve to the linked REF, not the first unrelated shipment',()=>{
  const api=load(),s=state(),n=s.packNotifications[0];
  s.shipments=[
    {id:'REUSED-1',ref:'WRONG1',status:'Abgeholt',packNotificationId:'another-pack'},
    {id:'REUSED-1',ref:'RIGHT1',status:'Erstellt',packNotificationId:'pn-1'}
  ];
  n.shipmentId='REUSED-1';n.shipmentRef='RIGHT1';n.status='shipment_created';
  assert.equal(api.findShipmentForNotification(s,n),s.shipments[1]);
  assert.equal(api.syncStatuses(s,'2026-10-26T13:00:00.000Z').length,0,'another REF pickup must not close the pack task');
  delete n.shipmentRef;
  assert.equal(api.findShipmentForNotification(s,n),s.shipments[1],'pack ownership disambiguates the duplicate ID');
  delete s.shipments[1].packNotificationId;
  assert.equal(api.findShipmentForNotification(s,n),null,'without REF or pack link the ID is ambiguous');
  assert.equal(api.syncStatuses(s,'2026-10-26T13:10:00.000Z').length,0,'ambiguous ID must never close the pack task');
});

test('P0: incomplete save-event ID cannot move a PDF to multiple different REFs',async()=>{
  const s=state(),events=new Map();
  const root={
    __EXPORTHUB_GET_STATE__:()=>s,
    addEventListener(name,listener){events.set(name,listener);},
    setView(){},
    ExportHUBClean:{queueSave(){return true;},flushSave(){return true;}}
  };
  const api=loadWithRoot(root);
  assert.equal(api.begin('pn-1'),true);
  s.shipments=[
    {id:'REUSED-1',ref:'WRONG1',deliveryFiles:[]},
    {id:'REUSED-1',ref:'RIGHT1',deliveryFiles:[]}
  ];
  const outcome=await events.get('exporthub:shipment-saved')({detail:{shipment:{id:'REUSED-1'}}});
  assert.equal(outcome,false,'ambiguous ID without any REF or pack ownership must fail closed');
  assert.deepEqual(s.shipments.map(sh=>sh.deliveryFiles.length),[0,0]);
  assert.equal(s.packNotifications[0].shipmentId,undefined);
});

test('P0: pack-specific link identifies the correct REF when save-event ID is recycled',async()=>{
  const s=state(),events=new Map();
  const root={
    __EXPORTHUB_GET_STATE__:()=>s,
    addEventListener(name,listener){events.set(name,listener);},
    setView(){},
    ExportHUBClean:{queueSave(){return true;},flushSave(){return true;}}
  };
  const api=loadWithRoot(root);
  assert.equal(api.begin('pn-1'),true);
  const wrong={id:'REUSED-1',ref:'WRONG1',deliveryFiles:[]};
  const correct={id:'REUSED-1',ref:'RIGHT1',packNotificationId:'pn-1',deliveryFiles:[]};
  s.shipments=[wrong,correct];
  assert.equal(await events.get('exporthub:shipment-saved')({detail:{shipment:{id:'REUSED-1'}}}),true);
  assert.equal(wrong.deliveryFiles.length,0,'unrelated reference is not altered');
  assert.equal(correct.deliveryFiles.length,1);
  assert.equal(correct.deliveryFiles[0].blobName,s.packNotifications[0].documents[0].blobName);
  assert.equal(s.packNotifications[0].shipmentRef,'RIGHT1');
});

test('P0: REF from save-event metadata resolves an ID-only snapshot without linking a foreign REF',async()=>{
  const s=state(),events=new Map();
  const root={
    __EXPORTHUB_GET_STATE__:()=>s,
    addEventListener(name,listener){events.set(name,listener);},
    setView(){},
    ExportHUBClean:{queueSave(){return true;},flushSave(){return true;}}
  };
  const api=loadWithRoot(root);
  assert.equal(api.begin('pn-1'),true);
  const wrong={id:'REUSED-1',ref:'WRONG1',deliveryFiles:[]};
  const correct={id:'REUSED-1',ref:'RIGHT1',deliveryFiles:[]};
  s.shipments=[wrong,correct];
  assert.equal(await events.get('exporthub:shipment-saved')({
    detail:{ref:'RIGHT1',shipment:{id:'REUSED-1'}}
  }),true);
  assert.equal(wrong.deliveryFiles.length,0);
  assert.equal(correct.deliveryFiles.length,1);
  assert.equal(s.packNotifications[0].shipmentRef,'RIGHT1');
});

test('P0: foreign pack owner on a saved REF cannot steal pending notification or PDF',async()=>{
  const s=state(),events=new Map();
  const root={
    __EXPORTHUB_GET_STATE__:()=>s,
    addEventListener(name,listener){events.set(name,listener);},
    setView(){},
    ExportHUBClean:{queueSave(){return true;},flushSave(){throw Error('must not save foreign REF');}}
  };
  const api=loadWithRoot(root);
  assert.equal(api.begin('pn-1'),true);
  const foreign={id:'REUSED-1',ref:'WRONG1',packNotificationId:'other-pack',packNotificationRef:'PK-OTHER',deliveryFiles:[]};
  s.shipments=[foreign];
  assert.equal(await events.get('exporthub:shipment-saved')({detail:{ref:'WRONG1',shipment:{...foreign}}}),false);
  assert.equal(foreign.deliveryFiles.length,0);
  assert.equal(foreign.packNotificationId,'other-pack');
  assert.equal(s.packNotifications[0].shipmentId,undefined);
  assert.equal(s.packNotifications[0].status,'in_review');
});

test('P0: conflicting pack ownership in a persisted REF alias fails closed for all aliases',async()=>{
  const s=state(),events=new Map();
  const root={
    __EXPORTHUB_GET_STATE__:()=>s,
    addEventListener(name,listener){events.set(name,listener);},
    setView(){},
    ExportHUBClean:{queueSave(){return true;},flushSave(){throw Error('must not save conflicting aliases');}}
  };
  const api=loadWithRoot(root);
  assert.equal(api.begin('pn-1'),true);
  const own={id:'SHIP-1',ref:'RIGHT1',packNotificationId:'pn-1',deliveryFiles:[]};
  const foreign={id:'SHIP-1',ref:'RIGHT1',packNotificationId:'other-pack',deliveryFiles:[]};
  s.shipments=[own];s.savedShipments=[foreign];
  assert.equal(await events.get('exporthub:shipment-saved')({detail:{ref:'RIGHT1',shipment:{id:'SHIP-1'}}}),false);
  assert.deepEqual(own.deliveryFiles,[]);
  assert.deepEqual(foreign.deliveryFiles,[]);
  assert.equal(s.packNotifications[0].shipmentId,undefined);
});

test('P0: contradictory event REF and shipment snapshot REF never attach a PDF',async()=>{
  const s=state(),events=new Map();
  const root={
    __EXPORTHUB_GET_STATE__:()=>s,
    addEventListener(name,listener){events.set(name,listener);},
    setView(){},
    ExportHUBClean:{queueSave(){return true;},flushSave(){throw Error('must not save contradictory REFs');}}
  };
  const api=loadWithRoot(root);
  assert.equal(api.begin('pn-1'),true);
  const wrong={id:'REUSED-1',ref:'WRONG1',deliveryFiles:[]};
  const correct={id:'REUSED-1',ref:'RIGHT1',deliveryFiles:[]};
  s.shipments=[wrong,correct];
  const result=await events.get('exporthub:shipment-saved')({
    detail:{ref:'RIGHT1',shipment:{id:'REUSED-1',ref:'WRONG1'}}
  });
  assert.equal(result,false);
  assert.deepEqual(s.shipments.map(sh=>sh.deliveryFiles.length),[0,0]);
  assert.equal(s.packNotifications[0].shipmentId,undefined);
});

test('P0: REF and recycled ID cannot resolve a shipment explicitly owned by another pack',()=>{
  const api=load(),s=state(),n=s.packNotifications[0];
  n.shipmentId='REUSED-1';n.shipmentRef='RIGHT1';n.status='shipment_created';
  const other={id:'REUSED-1',ref:'RIGHT1',status:'Abgeholt',packNotificationId:'other-pack',packNotificationRef:'PK-OTHER'};
  s.shipments=[other];
  assert.equal(api.findShipmentForNotification(s,n),null,'a known REF cannot override an explicit foreign pack owner');
  assert.equal(api.syncStatuses(s,'2026-10-26T14:30:00.000Z').length,0,'foreign pickup cannot complete this pack notification');
  delete n.shipmentRef;
  other.packNotificationRef='PK-1';
  assert.equal(api.findShipmentForNotification(s,n),null,'matching pack REF does not override conflicting pack ID');
  assert.equal(api.syncStatuses(s,'2026-10-26T14:31:00.000Z').length,0);
});


test('RC1679: two differently named real Lieferschein PDFs remain separate attachments in shipment creation and saved state',()=>{
  const bridge=load(),s=state(),note=s.packNotifications[0],first=note.documents[0];
  first.name='DNC3019222063.pdf';
  first.originalName='scan-A.pdf';
  first.documentReference='DNC3019222063';
  const second={id:'d2',name:'SIDE250071282.pdf',originalName:'scan-B.pdf',documentReference:'SIDE250071282',
    storage:'blob',blobName:'rc1059/production/bb/'+('b'.repeat(64)),mimeType:'application/pdf',size:256};
  note.documents.push(second);
  const draft=bridge.shipmentPrefill(note);
  assert.deepEqual(Array.from(draft.deliveryFiles,file=>file.name),['DNC3019222063.pdf','SIDE250071282.pdf']);
  assert.deepEqual(Array.from(draft.deliveryFiles,file=>file.originalName),['scan-A.pdf','scan-B.pdf']);
  assert.deepEqual(Array.from(draft.deliveryFiles,file=>file.blobName),[first.blobName,second.blobName]);
  assert.ok(draft.deliveryFiles.every(file=>file.storage==='blob'&&file.customerAvisVisible===false));
  const shipment={id:'sh-2',ref:'ABC123',deliveryFiles:[]};
  s.shipments.push(shipment);
  assert.equal(bridge.linkShipment(s,note,shipment,'2026-10-27T08:00:00.000Z'),true);
  assert.deepEqual(Array.from(shipment.deliveryFiles,file=>file.name),['DNC3019222063.pdf','SIDE250071282.pdf']);
  assert.deepEqual(Array.from(shipment.deliveryFiles,file=>file.blobName),[first.blobName,second.blobName]);
  bridge.linkShipment(s,note,shipment,'2026-10-27T08:01:00.000Z');
  assert.equal(shipment.deliveryFiles.length,2,'the same original PDFs are not duplicated on repeat link');
});


test('RC1679: lost real Pack Lieferschein Blob pointers restore only for the same pending Pack owner',()=>{
  const source=fs.readFileSync('assets/pack-notification-shipment.js','utf8');
  const injected=source.replace('  root.ExportHUBPackShipment=Object.freeze(',
    '  root.__RC1679_KEEP_DOCS__=keepPendingDocuments;root.ExportHUBPackShipment=Object.freeze(');
  assert.notEqual(injected,source,'actual production preservation helper must be invoked');
  const shared=state(),notification=shared.packNotifications[0];
  notification.documents[0].name='DNC3019222063.pdf';
  const extra={id:'d2',name:'SIDE250071282.pdf',storage:'blob',
    blobName:'rc1059/production/bb/'+('b'.repeat(64)),mimeType:'application/pdf'};
  notification.documents.push(extra);
  const current={packNotificationId:'pn-1',packNotificationRef:'PK-1',deliveryFiles:[]};
  shared.shipment=current;
  const root={__EXPORTHUB_GET_STATE__:()=>shared,addEventListener(){}};
  vm.runInContext(injected,vm.createContext({window:root,globalThis:root,console,Date,Intl,setTimeout,clearTimeout}));
  const prefill=root.ExportHUBPackShipment.shipmentPrefill(notification);
  assert.equal(root.__RC1679_KEEP_DOCS__(prefill),true);
  assert.deepEqual(Array.from(current.deliveryFiles,file=>file.name),['DNC3019222063.pdf','SIDE250071282.pdf']);
  assert.deepEqual(Array.from(current.deliveryFiles,file=>file.blobName),
    [notification.documents[0].blobName,extra.blobName]);
  assert.equal(root.__RC1679_KEEP_DOCS__(prefill),false,'repeated refresh must not duplicate real PDFs');
  assert.equal(current.deliveryFiles.length,2);
  const foreign={packNotificationId:'another-pack',packNotificationRef:'PK-OTHER',deliveryFiles:[]};
  shared.shipment=foreign;
  assert.equal(root.__RC1679_KEEP_DOCS__(prefill),false,'unrelated shipment must not receive private Pack PDFs');
  assert.deepEqual(foreign.deliveryFiles,[]);
  shared.shipment={packNotificationId:'pn-1',packNotificationRef:'PK-OTHER',deliveryFiles:[]};
  assert.equal(root.__RC1679_KEEP_DOCS__(prefill),false,'matching Pack ID but different pack reference must be rejected');
  assert.deepEqual(shared.shipment.deliveryFiles,[]);
});


test('RC1680: imported original Pack PDF is visible and opens/downloads from shipment creation without foreign-REF leakage',async()=>{
  const source=fs.readFileSync('assets/pack-notification-shipment.js','utf8');
  const patched=source.replace('  root.ExportHUBPackShipment=Object.freeze(',
    '  root.__RC1680_RENDER__=renderPendingLieferscheine;root.ExportHUBPackShipment=Object.freeze(');
  assert.notEqual(patched,source,'test invokes the original production UI renderer');
  const node=tag=>({
    tagName:tag,children:[],style:{},attrs:{},listeners:{},dataset:{},parent:null,
    setAttribute(key,value){this.attrs[key]=String(value);},
    addEventListener(type,callback){this.listeners[type]=callback;},
    appendChild(child){child.parent=this;this.children.push(child);return child;},
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;},
    querySelector(selector){
      if(selector!=='#rc1680PackDeliveryFiles')return null;
      return this.children.find(child=>child.id==='rc1680PackDeliveryFiles')||null;
    }
  });
  const docSection=node('section'),opened=[],s=state(),note=s.packNotifications[0];
  note.documents[0].name='DNC3019222063.pdf';
  s.shipment={packNotificationId:note.id,packNotificationRef:note.reference,deliveryFiles:[]};
  const root={
    document:{getElementById:id=>id==='rc363BlockDocuments'?docSection:null,createElement:node},
    __EXPORTHUB_GET_STATE__:()=>s,
    addEventListener(){},
    ExportHUBDocumentBlob1059:{async open(file,options){opened.push({name:file.name,blobName:file.blobName,download:options.download});return true;}}
  };
  vm.runInContext(patched,vm.createContext({window:root,globalThis:root,console,Date,Intl,setTimeout,clearTimeout}));
  const prefill=root.ExportHUBPackShipment.shipmentPrefill(note);
  s.shipment.deliveryFiles=prefill.deliveryFiles.slice();
  assert.equal(root.__RC1680_RENDER__(prefill),true);
  assert.equal(docSection.children.length,1);
  const box=docSection.children[0];
  assert.equal(box.id,'rc1680PackDeliveryFiles');
  assert.equal(box.children[1].children[0].textContent,'DNC3019222063.pdf');
  assert.equal(box.children[1].children.filter(child=>child.tagName==='button').length,2);
  const buttons=box.children[1].children.filter(child=>child.tagName==='button');
  const event={preventDefault(){},stopPropagation(){}};
  buttons[0].listeners.click(event);
  await new Promise(resolve=>setTimeout(resolve,0));
  buttons[1].listeners.click(event);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.deepEqual(opened.map(x=>x.download),[false,true]);
  assert.ok(opened.every(x=>x.name==='DNC3019222063.pdf'&&x.blobName===note.documents[0].blobName));
  assert.equal(root.__RC1680_RENDER__(prefill),true);
  assert.equal(docSection.children.length,1,'repeated render must not duplicate attachment lists');
  // A stale click, like a cached browser control, must also fail closed.
  s.shipment={packNotificationId:'OTHER',packNotificationRef:'WRONG',deliveryFiles:[...prefill.deliveryFiles]};
  buttons[1].listeners.click(event);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(opened.length,2,'stale controls may not open private PDFs from another Pack REF');
  assert.equal(root.__RC1680_RENDER__(prefill),false);
  assert.equal(docSection.children.length,0,'foreign Pack PDF UI must be removed from the new shipment');
});
