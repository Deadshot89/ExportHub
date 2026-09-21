import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync('assets/rc1176-shipment-location.js','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const e2e=fs.readFileSync('e2e/specs/shipment-create.spec.mjs','utf8');

test('RC1176: Standortwechsel wird im Capture-Pfad vor dem bestehenden Render in den aktiven Entwurf geschrieben',()=>{
  const listeners={},windowListeners={};let later=null;
  const shipment={customerId:'C1'},runtimeShipment={customerId:'C1'};
  const state={shipment,customers:[{id:'C1',name:'Testkunde',address:'Hauptweg 1, 00000 Teststadt',country:'DE',locations:[{
    id:'L1',name:'Werk 1',address:'Teststraße 1, 00000 Teststadt',country:'DE'
  }]}]};
  const select={id:'index289LocationSelect',value:'L1'};
  const document={
    addEventListener(name,fn,capture){listeners[name]=listeners[name]||[];listeners[name].push({fn,capture})},
    getElementById(id){return id==='index289LocationSelect'?select:null}
  };
  const window={
    document,
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_ACTIVE_SHIPMENT__:()=>runtimeShipment,
    ExportHUBClean:{runtime:{shipment:runtimeShipment}},
    addEventListener(name,fn,capture){windowListeners[name]=windowListeners[name]||[];windowListeners[name].push({fn,capture})},
    setTimeout(fn){later=fn;return 1}
  };
  vm.runInNewContext(source,{window,document,setTimeout:window.setTimeout,String,Array,Object,JSON,console});
  const locationChange=(windowListeners.change||[]).find(x=>x.capture&&/index289LocationSelect/.test(String(x.fn)));
  assert.ok(locationChange);
  locationChange.fn({target:select});
  assert.equal(shipment.locationId,'L1');
  assert.equal(shipment.selectedLocationId,'L1');
  assert.equal(shipment.siteId,'L1');
  assert.equal(shipment.destinationId,'L1');
  assert.equal(shipment.deliveryLocationId,'L1');
  assert.equal(shipment.shipToLocationId,'L1');
  assert.equal(shipment.recipientLocationId,'L1');
  assert.equal(shipment.recipientAddress,'Teststraße 1, 00000 Teststadt');
  assert.equal(shipment.deliveryAddress,'Teststraße 1, 00000 Teststadt');
  assert.equal(shipment.locationName,'Werk 1');
  assert.equal(runtimeShipment.locationId,'L1');
  assert.equal(runtimeShipment.recipientAddress,'Teststraße 1, 00000 Teststadt');
  assert.equal(typeof later,'function');
  shipment.locationId='';shipment.selectedLocationId='';shipment.recipientAddress='';
  runtimeShipment.locationId='';runtimeShipment.selectedLocationId='';runtimeShipment.recipientAddress='';
  select.value='';
  later();
  assert.equal(select.value,'L1');
  assert.equal(shipment.locationId,'L1');
  assert.equal(runtimeShipment.locationId,'L1');
  assert.equal(shipment.recipientAddress,'Teststraße 1, 00000 Teststadt');
});


test('RC1176: abgeleitete Hauptadresse wird genauso wie ein Zusatzstandort übernommen',()=>{
  const shipment={customerId:'C1'};
  const state={shipment,customers:[{id:'C1',name:'Testkunde',address:'Hauptweg 1, 00000 Teststadt',country:'DE'}]};
  const document={addEventListener(){},getElementById(){return null}};
  const window={document,__EXPORTHUB_GET_STATE__:()=>state,__EXPORTHUB_GET_ACTIVE_SHIPMENT__:()=>shipment,addEventListener(){},setTimeout(){return 1}};
  vm.runInNewContext(source,{window,document,setTimeout:window.setTimeout,String,Array,Object,JSON,console});
  assert.equal(window.ExportHUBShipmentLocation1176.applyLocation('MAIN-C1'),true);
  assert.equal(shipment.locationId,'MAIN-C1');
  assert.equal(shipment.locationName,'Hauptadresse');
  assert.equal(shipment.recipientAddress,'Hauptweg 1, 00000 Teststadt');
});

test('RC1176: unbekannte oder leere Standortwerte werden nicht künstlich in den Entwurf geschrieben',()=>{
  const shipment={customerId:'C1'};
  const state={shipment,customers:[{id:'C1',locations:[{id:'L1',address:'A'}]}]};
  const document={addEventListener(){},getElementById(){return null}};
  const window={document,__EXPORTHUB_GET_STATE__:()=>state,__EXPORTHUB_GET_ACTIVE_SHIPMENT__:()=>shipment,addEventListener(){},setTimeout(){return 1}};
  vm.runInNewContext(source,{window,document,setTimeout:window.setTimeout,String,Array,Object,JSON,console});
  assert.equal(window.ExportHUBShipmentLocation1176.applyLocation(''),false);
  assert.equal(window.ExportHUBShipmentLocation1176.applyLocation('UNKNOWN'),false);
  assert.equal(shipment.locationId,undefined);
});

test('RC1176: Runtime wird in Produktion TESTSERVICE und Demo mitgebaut',()=>{
  assert.match(builder,/exporthub-rc1176-shipment-location/);
  assert.match(builder,/assets\/rc1176-shipment-location\.js\?v=1196/);
  assert.match(builder,/'assets\/rc1176-shipment-location\.js'/);
  assert.match(builder,/shipmentLocationPersistence:'RC1191/);
});

test('RC1176: Live-E2E verlangt stabile Dropdown-Auswahl, aktiven State und entfernte Standortwarnung',()=>{
  assert.match(e2e,/toHaveValue\(customer\.locationId/);
  assert.match(e2e,/__EXPORTHUB_GET_ACTIVE_SHIPMENT__/);
  assert.match(e2e,/sh\.locationId\|\|sh\.selectedLocationId\|\|sh\.siteId\|\|sh\.destinationId/);
  assert.match(e2e,/Standort fehlt\|Adresse fehlt/);
});

test('RC1176: Runtime, Build und E2E bleiben syntaktisch gültig',()=>{
  for(const file of ['assets/rc1176-shipment-location.js','.github/rc1112/build-three-env.mjs','e2e/specs/shipment-create.spec.mjs']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});


test('RC1182: späte Re-Render bis 15 Sekunden werden für denselben Kunden repariert',()=>{
  const shipment={customerId:'C1'},state={shipment,customers:[{id:'C1',locations:[{id:'L1',name:'Werk 1',address:'A'}]}]};
  const timers=[],select={id:'index289LocationSelect',value:'L1',options:[{value:''},{value:'L1'}]};
  const listeners={},windowListeners={};
  const document={documentElement:{},addEventListener(name,fn,capture){listeners[name]=listeners[name]||[];listeners[name].push({fn,capture})},getElementById(id){return id==='index289LocationSelect'?select:null}};
  const window={document,__EXPORTHUB_GET_STATE__:()=>state,__EXPORTHUB_GET_ACTIVE_SHIPMENT__:()=>shipment,addEventListener(name,fn,capture){windowListeners[name]=windowListeners[name]||[];windowListeners[name].push({fn,capture})},setTimeout(fn,delay){timers.push({fn,delay});return timers.length}};
  vm.runInNewContext(source,{window,document,setTimeout:window.setTimeout,String,Array,Object,JSON,Date,console,MutationObserver:undefined});
  const change=windowListeners.change.find(x=>x.capture).fn;
  change({target:select});
  shipment.locationId='';shipment.selectedLocationId='';shipment.deliveryLocationId='';select.value='';
  const late=timers.find(x=>x.delay===12000);
  assert.ok(late,'12s Reparatur fehlt');
  late.fn();
  assert.equal(select.value,'L1');
  assert.equal(shipment.locationId,'L1');
  assert.equal(shipment.deliveryLocationId,'L1');
});

test('RC1182: Kundenwechsel beendet den Standort-Reparaturschutz',()=>{
  const shipment={customerId:'C1'},state={shipment,customers:[{id:'C1',locations:[{id:'L1',address:'A'}]},{id:'C2',locations:[{id:'L2',address:'B'}]}]};
  const timers=[],select={id:'index289LocationSelect',value:'L1',options:[{value:'L1'},{value:'L2'}]},listeners={},windowListeners={};
  const document={documentElement:{},addEventListener(name,fn,capture){listeners[name]=listeners[name]||[];listeners[name].push({fn,capture})},getElementById(){return select}};
  const window={document,__EXPORTHUB_GET_STATE__:()=>state,__EXPORTHUB_GET_ACTIVE_SHIPMENT__:()=>shipment,addEventListener(name,fn,capture){windowListeners[name]=windowListeners[name]||[];windowListeners[name].push({fn,capture})},setTimeout(fn,delay){timers.push({fn,delay});return timers.length}};
  vm.runInNewContext(source,{window,document,setTimeout:window.setTimeout,String,Array,Object,JSON,Date,console,MutationObserver:undefined});
  windowListeners.change.find(x=>x.capture).fn({target:select});
  shipment.customerId='C2';shipment.locationId='L2';shipment.selectedLocationId='L2';select.value='L2';
  const late=timers.find(x=>x.delay===9000);assert.ok(late);late.fn();
  assert.equal(select.value,'L2');
  assert.equal(shipment.locationId,'L2');
});

test('RC1182: Runtime setzt zusätzliche Standort-Aliase und beobachtet verzögerte DOM-Re-Render',()=>{
  assert.match(source,/deliveryLocationId=value/);
  assert.match(source,/shipToLocationId=value/);
  assert.match(source,/recipientLocationId=value/);
  assert.match(source,/expiresAt:Date\.now\(\)\+18000/);
  assert.match(source,/12000,15000/);
  assert.match(source,/MutationObserver/);
  assert.match(source,/shipmentCustomerSearch/);
});


test('RC1183: Standort-Hook sitzt auf window capture und läuft vor Index289 document capture',()=>{
  const windowListeners={},documentListeners={};
  const shipment={customerId:'C1'};
  const state={shipment,customers:[{id:'C1',locations:[{id:'L1',name:'Werk 1',address:'A'}]}]};
  const select={id:'index289LocationSelect',value:'L1',options:[{value:''},{value:'L1'}]};
  const document={
    documentElement:{},
    addEventListener(name,fn,capture){documentListeners[name]=documentListeners[name]||[];documentListeners[name].push({fn,capture})},
    getElementById(id){return id==='index289LocationSelect'?select:null}
  };
  const window={
    document,
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_ACTIVE_SHIPMENT__:()=>shipment,
    addEventListener(name,fn,capture){windowListeners[name]=windowListeners[name]||[];windowListeners[name].push({fn,capture})},
    setTimeout(){return 1}
  };
  vm.runInNewContext(source,{window,document,setTimeout:window.setTimeout,String,Array,Object,JSON,Date,console,MutationObserver:undefined});
  const winChange=(windowListeners.change||[]).find(x=>x.capture);
  assert.ok(winChange,'RC1183 Standortwechsel muss auf window capture registriert sein');
  assert.equal((documentListeners.change||[]).some(x=>x.capture&&/onLocationChange/.test(String(x.fn))),false,'Standortwechsel darf nicht mehr hinter Index289 auf document capture hängen');
  winChange.fn({target:select});
  assert.equal(shipment.locationId,'L1');
  assert.equal(shipment.selectedLocationId,'L1');
});

test('RC1183: Runtime kennzeichnet neuen Capture-Stand',()=>{
  assert.match(source,/w\.addEventListener\('change',onLocationChange,true\)/);
  assert.match(source,/w\.addEventListener\('input',onCustomerInput,true\)/);
  assert.match(source,/version:'RC1196'/);
});


test('RC1191: Same-Customer-change nach Standortwahl löscht den Reparaturschutz nicht',()=>{
  const shipment={customerId:'C1'};
  const state={shipment,customers:[{id:'C1',locations:[{id:'L1',name:'Werk 1',address:'A'}]}]};
  const timers=[],listeners={};
  const select={id:'index289LocationSelect',value:'L1',options:[{value:''},{value:'L1'}]};
  const customerSearch={id:'shipmentCustomerSearch',value:'Testkunde'};
  const document={documentElement:{},getElementById(id){return id==='index289LocationSelect'?select:null}};
  const window={
    document,
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_ACTIVE_SHIPMENT__:()=>shipment,
    addEventListener(name,fn,capture){listeners[name]=listeners[name]||[];listeners[name].push({fn,capture})},
    setTimeout(fn,delay){timers.push({fn,delay});return timers.length}
  };
  vm.runInNewContext(source,{window,document,setTimeout:window.setTimeout,String,Array,Object,JSON,Date,console,MutationObserver:undefined});
  const changes=listeners.change.filter(x=>x.capture);
  const locationChange=changes.find(x=>/onLocationChange/.test(String(x.fn))).fn;
  const customerChange=changes.find(x=>/onCustomerInput/.test(String(x.fn))).fn;

  locationChange({type:'change',target:select});
  select.value='';
  shipment.locationId='';shipment.selectedLocationId='';

  customerChange({type:'change',target:customerSearch});
  const deferred=timers.filter(x=>x.delay===0).at(-1);
  assert.ok(deferred,'Same-Customer-Prüfung muss verzögert erfolgen');
  deferred.fn();

  assert.equal(select.value,'L1');
  assert.equal(shipment.locationId,'L1');
  assert.equal(shipment.selectedLocationId,'L1');
});

test('RC1191: echter Kundenwechsel beendet den alten Standort-Reparaturschutz',()=>{
  const shipment={customerId:'C1'};
  const state={shipment,customers:[
    {id:'C1',locations:[{id:'L1',name:'Werk 1',address:'A'}]},
    {id:'C2',locations:[{id:'L2',name:'Werk 2',address:'B'}]}
  ]};
  const timers=[],listeners={};
  const select={id:'index289LocationSelect',value:'L1',options:[{value:''},{value:'L1'},{value:'L2'}]};
  const customerSearch={id:'shipmentCustomerSearch',value:'Anderer Kunde'};
  const document={documentElement:{},getElementById(id){return id==='index289LocationSelect'?select:null}};
  const window={
    document,
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_ACTIVE_SHIPMENT__:()=>shipment,
    addEventListener(name,fn,capture){listeners[name]=listeners[name]||[];listeners[name].push({fn,capture})},
    setTimeout(fn,delay){timers.push({fn,delay});return timers.length}
  };
  vm.runInNewContext(source,{window,document,setTimeout:window.setTimeout,String,Array,Object,JSON,Date,console,MutationObserver:undefined});
  const changes=listeners.change.filter(x=>x.capture);
  changes.find(x=>/onLocationChange/.test(String(x.fn))).fn({type:'change',target:select});

  shipment.customerId='C2';
  shipment.locationId='L2';shipment.selectedLocationId='L2';
  select.value='L2';
  changes.find(x=>/onCustomerInput/.test(String(x.fn))).fn({type:'change',target:customerSearch});
  const deferred=timers.filter(x=>x.delay===0).at(-1);
  assert.ok(deferred,'Kundenwechsel-Prüfung muss verzögert erfolgen');
  deferred.fn();

  shipment.locationId='L2';shipment.selectedLocationId='L2';select.value='L2';
  assert.equal(window.ExportHUBShipmentLocation1176.repairPending(),false);
  assert.equal(select.value,'L2');
  assert.equal(shipment.locationId,'L2');
});

test('RC1191: Kundenfeld-change wird erst nach dem bestehenden Kundenhandler bewertet',()=>{
  assert.match(source,/expectedCustomerKey=pending\.customerKey/);
  assert.match(source,/setTimeout\)\(function\(\)\{/);
  assert.match(source,/expectedCustomerKey&&actualCustomerKey&&expectedCustomerKey!==actualCustomerKey/);
  assert.match(source,/repairPending\(seq\)/);
  assert.match(source,/version:'RC1196'/);
});


test('RC1196: frischer Sendungsentwurf hat Vorrang vor stale globalem Active-Shipment',()=>{
  const draft={customerId:'C1'};
  const stale={customerId:'OLD',ref:'2RKTUZ'};
  const state={shipment:draft,customers:[
    {id:'C1',locations:[{id:'L1',name:'Werk 1',address:'A'}]},
    {id:'OLD',locations:[{id:'OLD-L1',name:'Alt',address:'Alt'}]}
  ]};
  const timers=[],listeners={};
  const select={id:'index289LocationSelect',value:'L1',options:[{value:''},{value:'L1'}]};
  const document={documentElement:{},getElementById(id){return id==='index289LocationSelect'?select:null}};
  const window={
    document,
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_ACTIVE_SHIPMENT__:()=>stale,
    ExportHUBClean:{runtime:{shipment:stale}},
    addEventListener(name,fn,capture){listeners[name]=listeners[name]||[];listeners[name].push({fn,capture})},
    setTimeout(fn,delay){timers.push({fn,delay});return timers.length}
  };
  vm.runInNewContext(source,{window,document,setTimeout:window.setTimeout,String,Array,Object,JSON,Date,console,MutationObserver:undefined});
  const locationChange=listeners.change.find(x=>x.capture&&/onLocationChange/.test(String(x.fn))).fn;
  locationChange({type:'change',target:select});

  assert.equal(draft.locationId,'L1');
  assert.equal(draft.selectedLocationId,'L1');
  assert.equal(stale.locationId,undefined,'stale gespeicherte Sendung darf nicht durch den neuen Entwurf verändert werden');

  draft.locationId='';draft.selectedLocationId='';select.value='';
  const immediate=timers.find(x=>x.delay===0);
  assert.ok(immediate,'sofortige Re-Render-Reparatur fehlt');
  immediate.fn();

  assert.equal(select.value,'L1');
  assert.equal(draft.locationId,'L1');
  assert.equal(stale.locationId,undefined);
});

test('RC1196: Standort-Runtime priorisiert state.shipment und begrenzt No-Ref-Synchronisation auf denselben Kunden',()=>{
  assert.match(source,/var draft=s&&s\.shipment;\s*if\(obj\(draft\)\)return draft/);
  assert.match(source,/sameCustomer=!ref&&customerKey&&shipmentCustomerKey\(x\)===customerKey/);
  assert.match(source,/version:'RC1196'/);
});
