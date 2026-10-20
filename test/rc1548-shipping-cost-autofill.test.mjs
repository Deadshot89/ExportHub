import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(state){
  const code=fs.readFileSync(new URL('../assets/rc1206-shipping-rules.js',import.meta.url),'utf8');
  const document={readyState:'loading',querySelector(){return null},addEventListener(){},documentElement:{}};
  const window={addEventListener(){},__EXPORTHUB_GET_STATE__:()=>state};
  const ctx={window,document,Event:function(){},setTimeout(){return 1},clearTimeout(){},Intl};
  vm.createContext(ctx);
  vm.runInContext(code,ctx);
  return window.ExportHUBRC1206ShippingRules;
}

test('RC1548: Verpackungsdaten kommen aus der fachlich vollständigsten Colli-Liste statt aus einer beliebigen rows-Liste',()=>{
  const state={currentShipment:{
    rows:[{itemNumber:'12345',quantity:99}],
    packagingRows:[{packagingType:'E3',count:2,kg:20,lengthCm:43,widthCm:31,heightCm:31}]
  }};
  const x=load(state);
  const data=x.canonicalLoad('ups');
  assert.equal(data.packaging,'E3');
  assert.equal(data.count,2);
  assert.equal(data.totalWeight,20);
  assert.equal(data.l,43);
  assert.equal(data.w,31);
  assert.equal(data.h,31);
});

test('RC1548: kanonische Sendungsdaten werden in den UPS-Kostenstatus gespiegelt und schlagen veraltete Länder-/Verpackungswerte',()=>{
  const state={
    customers:[{id:'C1',country:'Nederland',locations:[{id:'L1',country:'Italia',postalCode:'60044',city:'Fabriano',address:'60044 Fabriano Italia'}]}],
    currentShipment:{
      customerId:'C1',selectedLocationId:'L1',country:'Nederland',postalCode:'5657 EA',
      rows:[{itemNumber:'12345',quantity:99}],
      packagingRows:[{packagingType:'E3',count:2,kg:20,lengthCm:43,widthCm:31,heightCm:31}]
    },
    shippingCosts:{ups:{destinationCountry:'Deutschland',destinationPostal:'',packaging:'',packages:1,totalKg:3.1,manualRoute:false,manualLoad:false},gate:{}}
  };
  const x=load(state);
  assert.equal(typeof x.syncCanonicalShippingState,'function');
  x.syncCanonicalShippingState();
  assert.equal(x.countryCode(state.shippingCosts.ups.destinationCountry),'IT');
  assert.equal(state.shippingCosts.ups.destinationPostal,'60044');
  assert.equal(state.shippingCosts.ups.packaging,'E3');
  assert.equal(state.shippingCosts.ups.packages,2);
  assert.equal(state.shippingCosts.ups.totalKg,20);
  assert.equal(state.shippingCosts.ups.length,43);
  assert.equal(state.shippingCosts.ups.width,31);
  assert.equal(state.shippingCosts.ups.height,31);
});
