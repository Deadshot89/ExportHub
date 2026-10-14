import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1176-shipment-location.js','utf8');

function runtime(state){
  const document={documentElement:{},body:{},getElementById(){return null}};
  const window={
    document,
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_ACTIVE_SHIPMENT__:()=>state.shipment,
    addEventListener(){},
    setTimeout(){return 1}
  };
  vm.runInNewContext(source,{window,document,setTimeout:window.setTimeout,String,Array,Object,JSON,Date,console,MutationObserver:undefined});
  return window.ExportHUBShipmentLocation1176;
}

test('RC1524: ausgewählter Standort ersetzt Hauptland und Hauptmail in der Sendung',()=>{
  const shipment={
    customerId:'C1',
    country:'Deutschland',
    recipientCountry:'Deutschland',
    destinationCountry:'Deutschland',
    customerEmail:'main@example.com',
    customerMail:'main@example.com',
    recipientEmail:'main@example.com',
    email:'main@example.com'
  };
  const state={shipment,customers:[{
    id:'C1',
    name:'Hauptkunde Deutschland',
    country:'Deutschland',
    customerEmail:'main@example.com',
    locations:[{
      id:'FR-1',
      name:'Werk Frankreich',
      address:'1 Rue Exemple, 75001 Paris, France',
      country:'France',
      email:'paris@example.com'
    }]
  }]};

  const api=runtime(state);
  assert.equal(api.applyLocation('FR-1'),true);

  assert.equal(shipment.locationId,'FR-1');
  assert.equal(shipment.recipientAddress,'1 Rue Exemple, 75001 Paris, France');
  assert.equal(shipment.country,'France','kanonisches Sendungsland darf nicht vom Hauptkunden bleiben');
  assert.equal(shipment.recipientCountry,'France');
  assert.equal(shipment.destinationCountry,'France');
  assert.equal(shipment.customerEmail,'paris@example.com','Mail-Flow muss die Standort-Mail vor der Hauptmail erhalten');
  assert.equal(shipment.customerMail,'paris@example.com');
  assert.equal(shipment.recipientEmail,'paris@example.com');
  assert.equal(shipment.email,'paris@example.com');
});
