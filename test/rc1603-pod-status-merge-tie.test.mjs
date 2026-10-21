import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {mergeShipmentProtected,mergeCollection} = require('../api/shared/merge.js');

const stamp = '2026-10-21T14:00:00.000Z';
function sh(status, extra={}) {
  return {id:'RC1603-EXAMPLE',ref:'EX1234',status,processStatus:status,
    updatedAt:stamp,_syncUpdatedAt:stamp,...extra};
}
test('RC1603: stale POD from equal-time incoming copy cannot overwrite server Abgeholt',()=>{
  const server=sh('Abgeholt',{podFiles:[{id:'original1',blobName:'archive/original.pdf'}]});
  const incoming=sh('POD vorhanden',{podFiles:[]});
  const original=JSON.stringify(server);
  const merged=mergeShipmentProtected(server,incoming);
  assert.equal(merged.status,'Abgeholt');
  assert.equal(merged.processStatus,'Abgeholt');
  assert.equal(merged.podFiles.length,1);
  assert.equal(merged.podFiles[0].blobName,'archive/original.pdf');
  assert.equal(JSON.stringify(server),original,'No mutation of persisted source object');
});
test('RC1603: stale Abgeholt from equal-time incoming copy cannot erase genuine persisted POD status',()=>{
  const merged=mergeShipmentProtected(sh('POD vorhanden'),sh('Abgeholt'));
  assert.equal(merged.status,'POD vorhanden');
  assert.equal(merged.processStatus,'POD vorhanden');
});
test('RC1603: explicitly newer incoming POD status continues to win; never block newer legitimate update',()=>{
  const merged=mergeShipmentProtected(sh('Abgeholt'),sh('POD vorhanden',{
    _syncUpdatedAt:'2026-10-21T14:01:00.000Z',updatedAt:'2026-10-21T14:01:00.000Z'
  }));
  assert.equal(merged.status,'POD vorhanden');
  assert.equal(merged.processStatus,'POD vorhanden');
});
test('RC1603: explicitly newer incoming Abgeholt also continues to win',()=>{
  const merged=mergeShipmentProtected(sh('POD vorhanden'),sh('Abgeholt',{
    _syncUpdatedAt:'2026-10-21T14:01:00.000Z',updatedAt:'2026-10-21T14:01:00.000Z'
  }));
  assert.equal(merged.status,'Abgeholt');
});
test('RC1603: unrelated status transition with equal timestamp retains original merge policy',()=>{
  const merged=mergeShipmentProtected(sh('Erstellt'),sh('Bereit zur Abholung'));
  assert.equal(merged.status,'Bereit zur Abholung');
});
test('RC1603: conflicting internal status fields are not silently force-resolved',()=>{
  const merged=mergeShipmentProtected(sh('Abgeholt',{processStatus:'POD vorhanden'}),sh('POD vorhanden'));
  assert.equal(merged.status,'POD vorhanden');
});
test('RC1603: protected mergeCollection applies to both shipments and savedShipments',()=>{
  for(const collection of ['shipments','savedShipments']){
    const merged=mergeCollection(collection,[sh('Abgeholt')],[sh('POD vorhanden')],new Map());
    assert.equal(merged.length,1);
    assert.equal(merged[0].status,'Abgeholt',collection);
  }
});
test('RC1603: no document deletion when status is tied and old client has only some files',()=>{
  const server=sh('POD vorhanden',{deliveryFiles:[{id:'LS1',blobName:'signed.pdf'}]});
  const incoming=sh('Abgeholt',{deliveryFiles:[]});
  const merged=mergeShipmentProtected(server,incoming);
  assert.equal(merged.status,'POD vorhanden');
  assert.deepEqual(merged.deliveryFiles,server.deliveryFiles);
});
