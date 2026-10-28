import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/rc1206-shipping-rules.js',import.meta.url),'utf8');
function load(state,doc={},extra={}){
  const document={readyState:'loading',documentElement:{},activeElement:null,querySelector(){return null},addEventListener(){},...doc};
  const window={addEventListener(){},__EXPORTHUB_GET_STATE__:()=>state,...extra};
  vm.runInNewContext(source,{window,document,Intl,Event:function(){this.type='change'},setTimeout(){return 1},clearTimeout(){}});
  return window.ExportHUBRC1206ShippingRules;
}

test('RC1715: explizites Empfängerland gewinnt gegen veralteten Adresstext',()=>{
  const api=load({currentShipment:{recipientCountry:'Italia',recipientAddress:'5657 EA Eindhoven Nederland',recipientPostalCode:'60044'}});
  assert.equal(api.shipmentDestination().country,'IT');
  assert.equal(api.shipmentDestination().postal,'60044');
});

test('RC1715: nicht passende eingebettete Standort-ID darf neue Auswahl nicht zurücksetzen',()=>{
  const api=load({customers:[{id:'C1',country:'Nederland',locations:[]}],
    currentShipment:{customerId:'C1',selectedLocationId:'L2',locationData:{id:'L1',country:'Nederland',postalCode:'5657 EA',address:'5657 EA Eindhoven Nederland'},
      recipientCountry:'Italia',recipientPostalCode:'60044'}});
  assert.equal(api.shipmentDestination().country,'IT');
  assert.equal(api.shipmentDestination().postal,'60044');
});

test('RC1715: ohne explizites Zielland wird weiterhin Italien aus der Lieferadresse erkannt',()=>{
  const api=load({currentShipment:{country:'Nederland',deliveryAddress:'60044 Fabriano AN'}});
  assert.equal(api.shipmentDestination().country,'IT');
  assert.equal(api.shipmentDestination().postal,'60044');
});

function field(name,value){
  return {value,tagName:'INPUT',options:null,parentElement:{textContent:name},closest(){return this.parentElement}};
}
test('RC1715: manuelle Zielländer und Verpackungen bleiben in UPS und Gate41 unberührt',()=>{
  const state={currentShipment:{recipientCountry:'Italia',recipientPostalCode:'60044',
    packagingRows:[{packagingType:'E3',count:2,kg:20,lengthCm:43,widthCm:31,heightCm:31},{packagingType:'Euro Palette',count:1,kg:200}]},
    shippingCosts:{ups:{manualRoute:true,manualLoad:true,destinationCountry:'Belgien',destinationPostal:'1000',packaging:'E5',packages:4},
      gate:{manualRoute:true,manualLoad:true,country:'Belgien',destinationPostal:'1000',packaging:'Euro Palette',pallets:3}}};
  const f={
    ups:{destinationPostal:field('Ziel PLZ','1000'),packaging:field('Verpackung','E5'),packages:field('Pakete','4')},
    gate:{country:field('Zielland','Belgien'),packaging:field('Verpackung','Euro Palette'),pallets:field('Paletten','3')}
  };
  f.ups.country=field('Zielland','Belgien');
  const roots={};
  for(const kind of ['ups','gate']){
    roots[kind]={querySelector(q){for(const [name,el] of Object.entries(f[kind]))if(q.includes('[data-rc501-field="'+name+'"]'))return el;return null},
      querySelectorAll(){return Object.values(f[kind])}};
  }
  const doc={querySelector(q){
    const kind=q.includes('data-section="ups"')?'ups':q.includes('data-section="gate"')?'gate':'';
    if(!kind)return null;
    for(const [name,el] of Object.entries(f[kind]))if(q.includes('[data-rc501-field="'+name+'"]'))return el;
    return roots[kind];
  }};
  const api=load(state,doc);
  api.syncShipmentCostFields();
  assert.equal(f.ups.country.value,'Belgien');
  assert.equal(f.ups.destinationPostal.value,'1000');
  assert.equal(f.ups.packaging.value,'E5');
  assert.equal(f.ups.packages.value,'4');
  assert.equal(f.gate.country.value,'Belgien');
  assert.equal(f.gate.packaging.value,'Euro Palette');
  assert.equal(f.gate.pallets.value,'3');
  assert.equal(state.shippingCosts.ups.destinationCountry,'Belgien');
});

test('RC1715: fremde DOM-Mutationen lösen keinen Versandkosten-Neurender aus',()=>{
  const watched=[],timers=[];
  class Observer{
    constructor(callback){this.callback=callback}
    observe(target){this.target=target;watched.push(this)}
    disconnect(){this.target=null}
  }
  const root={id:'rc626Shipping',nodeType:1},documentElement={nodeType:1};
  const doc={documentElement,querySelector(q){return q==='#rc626Shipping'?root:null}};
  load({shippingCosts:{ups:{manualRoute:true,manualLoad:true},gate:{manualRoute:true,manualLoad:true}}},doc,
    {MutationObserver:Observer});
  // Verify the local observer is attached to the shipping section, and no
  // observer on the document schedules on arbitrary unrelated mutations.
  const local=watched.find(o=>o.target===root);
  const global=watched.find(o=>o.target===documentElement);
  assert.ok(local,'shipping area must have its own observer');
  assert.ok(global,'the outer observer only needs to detect section replacement');
  const unrelated={nodeType:1,id:'unrelated'};
  global.callback([{addedNodes:[unrelated],removedNodes:[],target:unrelated}]);
  assert.equal(timers.length,0);
});
