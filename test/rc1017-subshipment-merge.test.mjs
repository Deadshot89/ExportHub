import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const merge=require('../api/shared/merge.js');

function sub(overrides={}){
  return {
    subShipmentId:'S1-TRUCK-1',
    sequence:1,
    total:2,
    status:'open',
    locked:false,
    pickupHistory:[],
    collectedPickupCollis:0,
    pickupCollectedColliCount:0,
    remainingPickupCollis:2,
    pickupRemainingColliCount:2,
    confirmedAt:'',
    lastPartialPickupAt:'',
    podFiles:[],
    signatureBlobName:'',
    signatureStoredAt:'',
    pickupRegistered:false,
    pickupAccessKeyHash:'',
    updatedAt:'2026-09-09T12:00:00Z',
    ...overrides
  };
}

function shipment(overrides={}){
  return {
    id:'S1',
    ref:'ABC123',
    status:'Erstellt',
    processStatus:'Erstellt',
    _syncUpdatedAt:'2026-09-09T13:00:00Z',
    subShipments:[sub()],
    multiTruckLocked:false,
    ...overrides
  };
}

test('RC1017: mergeShipmentProtected ist für Test und Reuse exportiert',()=>{
  assert.equal(typeof merge.mergeShipmentProtected,'function');
});

test('RC1017: stale Client darf begonnene Teilsendung nicht zurücksetzen',()=>{
  const server=shipment({
    multiTruckLocked:true,
    subShipments:[sub({
      status:'confirmed',
      locked:true,
      pickupHistory:[{id:'pickup-1',confirmedAt:'2026-09-09T13:00:00Z'}],
      collectedPickupCollis:2,
      pickupCollectedColliCount:2,
      remainingPickupCollis:0,
      pickupRemainingColliCount:0,
      confirmedAt:'2026-09-09T13:00:00Z',
      pickupRegistered:true,
      pickupAccessKeyHash:'hash-1',
      updatedAt:'2026-09-09T13:00:00Z'
    })]
  });
  const stale=shipment({
    _syncUpdatedAt:'2026-09-09T13:05:00Z',
    multiTruckLocked:false,
    subShipments:[sub({updatedAt:'2026-09-09T12:55:00Z'})]
  });
  const out=merge.mergeShipmentProtected(server,stale);
  assert.equal(out.multiTruckLocked,true);
  assert.equal(out.subShipments[0].status,'confirmed');
  assert.equal(out.subShipments[0].locked,true);
  assert.equal(out.subShipments[0].pickupHistory.length,1);
  assert.equal(out.subShipments[0].pickupCollectedColliCount,2);
  assert.equal(out.subShipments[0].pickupRemainingColliCount,0);
  assert.equal(out.subShipments[0].pickupAccessKeyHash,'hash-1');
});

test('RC1017: neuerer operativer Teilsendungsstand darf ältere Serverdaten ersetzen',()=>{
  const server=shipment({
    subShipments:[sub({status:'partial',locked:true,lastPartialPickupAt:'2026-09-09T13:00:00Z',pickupHistory:[{id:'p1',confirmedAt:'2026-09-09T13:00:00Z'}],updatedAt:'2026-09-09T13:00:00Z'})]
  });
  const incoming=shipment({
    _syncUpdatedAt:'2026-09-09T13:10:00Z',
    multiTruckLocked:true,
    subShipments:[sub({status:'confirmed',locked:true,confirmedAt:'2026-09-09T13:10:00Z',pickupHistory:[{id:'p1',confirmedAt:'2026-09-09T13:00:00Z'},{id:'p2',confirmedAt:'2026-09-09T13:10:00Z'}],remainingPickupCollis:0,pickupRemainingColliCount:0,collectedPickupCollis:2,pickupCollectedColliCount:2,updatedAt:'2026-09-09T13:10:00Z'})]
  });
  const out=merge.mergeShipmentProtected(server,incoming);
  assert.equal(out.subShipments[0].status,'confirmed');
  assert.equal(out.subShipments[0].pickupHistory.length,2);
  assert.equal(out.subShipments[0].pickupRemainingColliCount,0);
});

test('RC1017: POD und Signatur einer operativen Teilsendung bleiben server-autoritativ erhalten',()=>{
  const server=shipment({
    multiTruckLocked:true,
    subShipments:[sub({
      status:'pod',
      locked:true,
      confirmedAt:'2026-09-09T13:00:00Z',
      podFiles:[{id:'pod-1',name:'signed-loadlist.pdf'}],
      signatureBlobName:'sig/S1-TRUCK-1.png',
      signatureStoredAt:'2026-09-09T13:02:00Z',
      updatedAt:'2026-09-09T13:02:00Z'
    })]
  });
  const stale=shipment({
    _syncUpdatedAt:'2026-09-09T13:15:00Z',
    subShipments:[sub({status:'open',updatedAt:'2026-09-09T12:59:00Z'})]
  });
  const out=merge.mergeShipmentProtected(server,stale);
  assert.equal(out.subShipments[0].status,'pod');
  assert.equal(out.subShipments[0].podFiles.length,1);
  assert.equal(out.subShipments[0].signatureBlobName,'sig/S1-TRUCK-1.png');
  assert.equal(out.subShipments[0].signatureStoredAt,'2026-09-09T13:02:00Z');
});

test('RC1017: Teilsendungen werden per subShipmentId zusammengeführt und nicht positionsbasiert',()=>{
  const server=shipment({
    multiTruckLocked:true,
    subShipments:[
      sub({subShipmentId:'S1-TRUCK-1',sequence:1,status:'confirmed',locked:true,confirmedAt:'2026-09-09T13:00:00Z',updatedAt:'2026-09-09T13:00:00Z'}),
      sub({subShipmentId:'S1-TRUCK-2',sequence:2,status:'open',remainingPickupCollis:1,pickupRemainingColliCount:1,updatedAt:'2026-09-09T12:00:00Z'})
    ]
  });
  const incoming=shipment({
    _syncUpdatedAt:'2026-09-09T13:05:00Z',
    subShipments:[
      sub({subShipmentId:'S1-TRUCK-2',sequence:2,status:'partial',locked:true,lastPartialPickupAt:'2026-09-09T13:05:00Z',updatedAt:'2026-09-09T13:05:00Z'}),
      sub({subShipmentId:'S1-TRUCK-1',sequence:1,status:'open',updatedAt:'2026-09-09T12:50:00Z'})
    ]
  });
  const out=merge.mergeShipmentProtected(server,incoming);
  const truck1=out.subShipments.find(x=>x.subShipmentId==='S1-TRUCK-1');
  const truck2=out.subShipments.find(x=>x.subShipmentId==='S1-TRUCK-2');
  assert.equal(truck1.status,'confirmed');
  assert.equal(truck2.status,'partial');
  assert.equal(out.multiTruckLocked,true);
});

test('RC1017: Raw Public-Access-Tokens werden auch innerhalb von Teilsendungen entfernt',()=>{
  const state={shipments:[shipment({subShipments:[sub({pickupToken:'raw-token',pickupQrToken:'raw-qr',pickupAccessKeyHash:'hash-ok'})]})]};
  const sanitized=merge.sanitizeState(state);
  assert.equal('pickupToken' in sanitized.shipments[0].subShipments[0],false);
  assert.equal('pickupQrToken' in sanitized.shipments[0].subShipments[0],false);
  assert.equal(sanitized.shipments[0].subShipments[0].pickupAccessKeyHash,'hash-ok');
});
