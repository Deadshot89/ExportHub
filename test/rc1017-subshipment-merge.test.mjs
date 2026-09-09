import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const merge=require('../api/shared/merge.js');

function shipment(overrides={}){
  return Object.assign({id:'S1',ref:'ABC123'},overrides);
}

test('RC1017: stale Client darf begonnene Teilsendung nicht zurücksetzen',()=>{
  assert.equal(typeof merge.mergeShipmentProtected,'function');
  const server=shipment({_syncUpdatedAt:'2026-09-09T13:00:00Z',multiTruckLocked:true,subShipments:[{subShipmentId:'S1-TRUCK-1',sequence:1,total:2,status:'confirmed',locked:true,confirmedAt:'2026-09-09T13:00:00Z',pickupHistory:[{id:'pickup-1',confirmedAt:'2026-09-09T13:00:00Z'}],collectedPickupCollis:2,pickupCollectedColliCount:2,remainingPickupCollis:0,pickupRemainingColliCount:0,podFiles:[]},{subShipmentId:'S1-TRUCK-2',sequence:2,total:2,status:'open',locked:false,pickupHistory:[],podFiles:[]}]});
  const stale=shipment({_syncUpdatedAt:'2026-09-09T13:05:00Z',multiTruckLocked:false,subShipments:[{subShipmentId:'S1-TRUCK-1',sequence:1,total:2,status:'open',locked:false,pickupHistory:[],collectedPickupCollis:0,pickupCollectedColliCount:0,remainingPickupCollis:2,pickupRemainingColliCount:2,podFiles:[]},{subShipmentId:'S1-TRUCK-2',sequence:2,total:2,status:'open',locked:false,pickupHistory:[],podFiles:[]}]});
  const out=merge.mergeShipmentProtected(server,stale);
  assert.equal(out.multiTruckLocked,true);
  assert.equal(out.subShipments[0].status,'confirmed');
  assert.equal(out.subShipments[0].locked,true);
  assert.equal(out.subShipments[0].pickupHistory.length,1);
  assert.equal(out.subShipments[0].pickupCollectedColliCount,2);
});

test('RC1017: neuerer operativer Teilsendungsstand darf den älteren ersetzen',()=>{
  const server=shipment({_syncUpdatedAt:'2026-09-09T13:00:00Z',multiTruckLocked:true,subShipments:[{subShipmentId:'S1-TRUCK-1',sequence:1,total:2,status:'partial',locked:true,lastPartialPickupAt:'2026-09-09T13:00:00Z',pickupHistory:[{id:'pickup-1',confirmedAt:'2026-09-09T13:00:00Z'}],collectedPickupCollis:1,pickupCollectedColliCount:1,remainingPickupCollis:1,pickupRemainingColliCount:1,podFiles:[]}]});
  const incoming=shipment({_syncUpdatedAt:'2026-09-09T13:10:00Z',multiTruckLocked:true,subShipments:[{subShipmentId:'S1-TRUCK-1',sequence:1,total:2,status:'confirmed',locked:true,confirmedAt:'2026-09-09T13:10:00Z',pickupHistory:[{id:'pickup-1',confirmedAt:'2026-09-09T13:00:00Z'},{id:'pickup-2',confirmedAt:'2026-09-09T13:10:00Z'}],collectedPickupCollis:2,pickupCollectedColliCount:2,remainingPickupCollis:0,pickupRemainingColliCount:0,podFiles:[{id:'pod-1'}]}]});
  const out=merge.mergeShipmentProtected(server,incoming);
  assert.equal(out.subShipments[0].status,'confirmed');
  assert.equal(out.subShipments[0].pickupHistory.length,2);
  assert.equal(out.subShipments[0].pickupRemainingColliCount,0);
  assert.equal(out.subShipments[0].podFiles.length,1);
});

test('RC1017: nicht-operative Teilsendungsplanung darf bei neuerem Client weiter aktualisiert werden',()=>{
  const server=shipment({_syncUpdatedAt:'2026-09-09T13:00:00Z',multiTruckLocked:false,subShipments:[{subShipmentId:'S1-TRUCK-1',sequence:1,total:2,status:'open',locked:false,rows:[{sourceRowId:'r1',count:2}],pickupHistory:[],podFiles:[]},{subShipmentId:'S1-TRUCK-2',sequence:2,total:2,status:'open',locked:false,rows:[{sourceRowId:'r1',count:1}],pickupHistory:[],podFiles:[]}]});
  const incoming=shipment({_syncUpdatedAt:'2026-09-09T13:05:00Z',multiTruckLocked:false,subShipments:[{subShipmentId:'S1-TRUCK-1',sequence:1,total:3,status:'open',locked:false,rows:[{sourceRowId:'r1',count:1}],pickupHistory:[],podFiles:[]},{subShipmentId:'S1-TRUCK-2',sequence:2,total:3,status:'open',locked:false,rows:[{sourceRowId:'r1',count:1}],pickupHistory:[],podFiles:[]},{subShipmentId:'S1-TRUCK-3',sequence:3,total:3,status:'open',locked:false,rows:[{sourceRowId:'r1',count:1}],pickupHistory:[],podFiles:[]}]});
  const out=merge.mergeShipmentProtected(server,incoming);
  assert.equal(out.multiTruckLocked,false);
  assert.equal(out.subShipments.length,3);
});

test('RC1017: Raw Public-Access-Tokens werden auch aus Teilsendungen vor dem Teamspeicher entfernt',()=>{
  const dirty={
    shipments:[shipment({
      pickupToken:'TOP-SECRET',
      subShipments:[{
        subShipmentId:'S1-TRUCK-1',sequence:1,total:2,status:'open',
        pickupToken:'CHILD-PICKUP',pickupQrToken:'CHILD-QR',qrToken:'CHILD-RAW',
        customerAvisToken:'CHILD-AVIS',avisToken:'CHILD-AVIS-2',
        customerAvisPublicUrl:'https://example.invalid/avis?token=secret',
        avisPublicUrl:'https://example.invalid/avis2?token=secret',
        pickupHistory:[],podFiles:[]
      }]
    })]
  };
  const out=merge.sanitizeState(dirty);
  const parent=out.shipments[0],child=parent.subShipments[0];
  assert.equal(parent.pickupToken,undefined);
  for(const key of ['pickupToken','pickupQrToken','qrToken','customerAvisToken','avisToken','customerAvisPublicUrl','avisPublicUrl']){
    assert.equal(child[key],undefined,`${key} darf nicht in subShipments persistieren`);
  }
  assert.equal(child.subShipmentId,'S1-TRUCK-1');
  assert.equal(child.status,'open');
});
