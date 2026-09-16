import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {compactStateForStorage}=require('../api/shared/state-compaction.js');

function clone(v){return JSON.parse(JSON.stringify(v))}

test('RC1136: exakt identische Kunden-Snapshots werden verlustfrei dedupliziert',()=>{
  const customer={id:'C1',name:'Kunde',locations:[{id:'L1',name:'Werk'}]};
  const state={shipments:[{id:'S1',customer:clone(customer),customerData:clone(customer),selectedCustomer:clone(customer)}]};
  const before=clone(state);
  const out=compactStateForStorage(state);
  assert.deepEqual(state,before,'Eingangsdaten dürfen nicht mutiert werden');
  assert.deepEqual(out.shipments[0].customer,customer);
  assert.equal('customerData' in out.shipments[0],false);
  assert.equal('selectedCustomer' in out.shipments[0],false);
});

test('RC1136: unterschiedliche Kunden-Snapshots bleiben vollständig erhalten',()=>{
  const state={savedShipments:[{id:'S1',customer:{id:'C1',name:'Neu'},customerData:{id:'C1',name:'Alt'},selectedCustomer:{id:'C2',name:'Andere Auswahl'}}]};
  const out=compactStateForStorage(state);
  assert.deepEqual(out.savedShipments[0].customer,state.savedShipments[0].customer);
  assert.deepEqual(out.savedShipments[0].customerData,state.savedShipments[0].customerData);
  assert.deepEqual(out.savedShipments[0].selectedCustomer,state.savedShipments[0].selectedCustomer);
});

test('RC1136: identische historische RC-Dokumentkopien werden nur einmal behalten',()=>{
  const docs=[{id:'D1',name:'Dokument',content:'ALT'}];
  const item={id:'A1',rc247Docs:clone(docs),rc254Docs:clone(docs),rc256Docs:clone(docs),rc311Docs:clone(docs),rc312Docs:clone(docs),rc313Docs:clone(docs)};
  const out=compactStateForStorage({abdRequests:[item]});
  assert.deepEqual(out.abdRequests[0].rc313Docs,docs);
  for(const key of ['rc312Docs','rc311Docs','rc256Docs','rc254Docs','rc247Docs'])assert.equal(key in out.abdRequests[0],false,key+' sollte als identische Kopie entfallen');
});

test('RC1136: einzigartige historische RC-Dokumentstände bleiben erhalten',()=>{
  const item={id:'S1',rc313Docs:[{id:'D',content:'neu'}],rc312Docs:[{id:'D',content:'alt'}],rc311Docs:[{id:'X',content:'extra'}]};
  const out=compactStateForStorage({shipments:[item]});
  assert.deepEqual(out.shipments[0].rc313Docs,item.rc313Docs);
  assert.deepEqual(out.shipments[0].rc312Docs,item.rc312Docs);
  assert.deepEqual(out.shipments[0].rc311Docs,item.rc311Docs);
});

test('RC1136: fachliche Dokumente, Historien und Signaturen bleiben unangetastet',()=>{
  const item={id:'S1',generatedDocuments:[{id:'G1'}],deliveryFiles:[{id:'L1'}],podFiles:[{id:'P1'}],abdFiles:[{id:'A1'}],shipmentHistory:[{id:'H1'}],statusHistory:[{id:'S1'}],driverSignature:'data:image/jpeg;base64,AAA',signatureDataUrl:'data:image/jpeg;base64,AAA'};
  const out=compactStateForStorage({shipments:[item]});
  for(const key of ['generatedDocuments','deliveryFiles','podFiles','abdFiles','shipmentHistory','statusHistory','driverSignature','signatureDataUrl'])assert.deepEqual(out.shipments[0][key],item[key],key+' wurde verändert');
});


test('RC1136: State-Save kompaktisiert erst nach Merge und vor Upload',()=>{
  const fs=require('node:fs');
  const source=fs.readFileSync('api/exporthub-state/index.js','utf8');
  assert.match(source,/require\('\.\.\/shared\/state-compaction'\)/);
  assert.match(source,/compactStateForStorage\(pruneTombstones\(mergeState\(current\.state\|\|\{\},incoming\.state\|\|\{\}\)\)\)/);
});
