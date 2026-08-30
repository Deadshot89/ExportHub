import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBackupPayload,inventoryBackup,buildMigrationPackage,sha256Hex} from '../shared/migration-core.js';

function sample(remotePod=false){
  return {
    type:'ExportHUB_BACKUP',version:'RC878',exportedAt:'2026-08-30T08:00:00.000Z',exportedBy:'Test',
    users:[{name:'Admin'}],
    state:{
      customers:[{id:'C1',account:'100',name:'Kunde A'}],
      shipments:[{id:'S1',ref:'ABC123',customerId:'C1',status:'POD vorhanden',deliveryFiles:[{id:'D1',name:'LS_123.pdf',type:'application/pdf',data:'data:application/pdf;base64,JVBERi0xLjQK'}],podFiles:[remotePod?{id:'P1',name:'POD_ABC123.pdf',url:'https://example.invalid/pod.pdf'}:{id:'P1',name:'POD_ABC123.pdf',type:'application/pdf',data:'data:application/pdf;base64,JVBERi0xLjQK'}]}],
      savedShipments:[{id:'S1',ref:'ABC123',customerId:'C1',status:'POD vorhanden'}],
      tasks:[{id:'T1',title:'Test',status:'offen'}],abdRequests:[],archive:[],palletBookings:[]
    }
  };
}

test('rejects partial/non-backup payload',()=>{
  const r=validateBackupPayload({state:{}});assert.equal(r.ok,false);assert.ok(r.errors.includes('BACKUP_TYPE_INVALID'));
});

test('inventories customers, source shipment copies and documents',()=>{
  const r=inventoryBackup(sample());assert.equal(r.validation.ok,true);assert.equal(r.inventory.counts.customers,1);assert.equal(r.inventory.counts.shipmentSourceRecords,2);assert.equal(r.inventory.counts.canonicalShipmentGroups,1);assert.equal(r.inventory.counts.documents,2);assert.equal(r.inventory.counts.pods,1);
});

test('read-only mapping covers every source record and keeps source snapshot',async()=>{
  const payload=sample(), text=JSON.stringify(payload);const pkg=await buildMigrationPackage(payload,text);
  assert.equal(pkg.manifest.gates.readOnlyReady,true);assert.equal(pkg.manifest.mapping.complete,true);assert.deepEqual(pkg.sourceSnapshot,payload);assert.equal(pkg.normalized.shipments.length,1);assert.equal(pkg.normalized.shipments[0].sourcePointers.length,2);
});

test('remote POD blocks cutover but not read-only migration',async()=>{
  const payload=sample(true),pkg=await buildMigrationPackage(payload,JSON.stringify(payload));assert.equal(pkg.manifest.gates.readOnlyReady,true);assert.equal(pkg.manifest.gates.cutoverReady,false);assert.ok(pkg.manifest.gates.cutoverBlockers.includes('REMOTE_DOCUMENTS_REQUIRE_CAPTURE'));
});

test('inline documents receive hashes',async()=>{
  const payload=sample(false),pkg=await buildMigrationPackage(payload,JSON.stringify(payload));assert.equal(pkg.manifest.documents.inlineHashed,2);assert.equal(pkg.manifest.documents.hashErrors,0);assert.match(pkg.manifest.documents.verification[0].sha256,/^[a-f0-9]{64}$/);
});

test('source hash is deterministic',async()=>{
  const text='{"a":1}';assert.equal(await sha256Hex(text),await sha256Hex(text));
});
