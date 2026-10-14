import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const secureMerge=require('../api/shared/secure-merge.js');
const writeContext=require('../api/shared/state-write-context.js');

function right(level){
  return {
    level,
    visible:level!=='none',
    read:level!=='none',
    edit:level==='edit'||level==='admin',
    admin:level==='admin',
    functionAdmin:level==='admin'
  };
}

function employee(overrides={}){
  return {
    id:'U-MA',
    user:'ma-test',
    name:'MA Test',
    role:'Benutzer',
    active:true,
    permissions:[],
    rights:{
      shipment:right('view'),
      shipmentoverview:right('view'),
      documents:right('view'),
      history:right('view'),
      ...overrides
    }
  };
}

function baseShipment(){
  return {
    id:'S1',
    ref:'ABC123',
    status:'Erstellt',
    customerName:'Testkunde',
    totalColli:2,
    totalWeight:250,
    updatedAt:'2026-10-14T08:00:00.000Z',
    shipmentHistory:[{
      id:'H0',
      at:'2026-10-14T08:00:00.000Z',
      type:'created',
      label:'Sendung erstellt',
      actor:{name:'Tobias',id:'U1',role:'Globaler Administrator'},
      source:'exporthub',
      details:{reference:'ABC123'},
      version:'RC1151'
    }]
  };
}

function baseState(){
  const shipment=baseShipment();
  return {
    shipments:[structuredClone(shipment)],
    savedShipments:[structuredClone(shipment)],
    _teamSyncMeta:{
      fields:{
        shipments:{updatedAt:'2026-10-14T08:00:00.000Z'},
        savedShipments:{updatedAt:'2026-10-14T08:00:00.000Z'}
      },
      tombstones:[]
    }
  };
}

function registrationEvent(id='REG-1',type='registration',label='Versandanmeldung per E-Mail gestartet'){
  return {
    id,
    at:'2026-10-14T09:00:00.000Z',
    type,
    label,
    actor:{name:'MA Test',id:'U-MA',role:'Benutzer'},
    source:'exporthub',
    details:{
      reference:'ABC123',
      to:'carrier@example.invalid',
      subject:'Versandanmeldung ABC123',
      mailType:'Versandanmeldung'
    },
    version:'RC1151'
  };
}

function runAs(user,fn){
  return writeContext.run(()=>{
    writeContext.captureUser(user);
    return fn();
  });
}

function addRegistrationToCopies(state,event){
  for(const key of ['shipments','savedShipments']){
    state[key][0].shipmentHistory.push(structuredClone(event));
    state._teamSyncMeta.fields[key]={updatedAt:'2026-10-14T09:00:00.000Z'};
  }
}

function expectForbidden(user,server,incoming){
  assert.throws(
    ()=>runAs(user,()=>secureMerge.mergeState(server,incoming)),
    error=>error&&error.code==='STATE_MODULE_WRITE_FORBIDDEN'&&error.status===403
  );
}

test('RC1530: MA mit Sendungs-Leserecht darf Versandanmeldung in der Sendungshistorie persistieren',()=>{
  const server=baseState();
  const incoming=structuredClone(server);
  addRegistrationToCopies(incoming,registrationEvent());

  const merged=runAs(employee(),()=>secureMerge.mergeState(server,incoming));

  for(const key of ['shipments','savedShipments']){
    assert.equal(merged[key][0].status,'Erstellt');
    assert.equal(merged[key][0].customerName,'Testkunde');
    assert.equal(merged[key][0].shipmentHistory.length,2);
    assert.equal(merged[key][0].shipmentHistory[1].label,'Versandanmeldung per E-Mail gestartet');
    assert.equal(merged[key][0].shipmentHistory[1].actor.id,'U-MA');
  }
});

test('RC1530: MA darf auch den bestätigten Versandanmeldungs-Mailversand protokollieren',()=>{
  const server=baseState();
  const incoming=structuredClone(server);
  addRegistrationToCopies(incoming,registrationEvent('REG-2','mail-sent','Versandanmeldung versendet'));

  const merged=runAs(employee(),()=>secureMerge.mergeState(server,incoming));
  assert.equal(merged.shipments[0].shipmentHistory.at(-1).label,'Versandanmeldung versendet');
});

test('RC1530: Versandanmeldung gibt MA kein Recht auf Status- oder Fachdatenänderungen',()=>{
  const server=baseState();
  const incoming=structuredClone(server);
  addRegistrationToCopies(incoming,registrationEvent());
  incoming.shipments[0].status='Bereit zur Abholung';
  incoming.savedShipments[0].status='Bereit zur Abholung';

  expectForbidden(employee(),server,incoming);
});

test('RC1530: MA ohne Sendungs-Leserecht darf keine Versandanmeldung in die Historie schreiben',()=>{
  const server=baseState();
  const incoming=structuredClone(server);
  addRegistrationToCopies(incoming,registrationEvent());

  expectForbidden(employee({shipment:right('none'),shipmentoverview:right('none')}),server,incoming);
});

test('RC1530: Sendungs-Leserecht erlaubt keine beliebigen Historienereignisse',()=>{
  const server=baseState();
  const incoming=structuredClone(server);
  addRegistrationToCopies(incoming,{
    ...registrationEvent('FAKE-1','pickup','Abholung bestätigt'),
    details:{reference:'ABC123',status:'Abgeholt'}
  });

  expectForbidden(employee(),server,incoming);
});
