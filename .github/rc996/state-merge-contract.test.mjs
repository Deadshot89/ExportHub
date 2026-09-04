import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {mergeState}=require('../../api/shared/merge.js');

const meta=()=>({_teamSyncMeta:{fields:{},tombstones:[]}});

test('RC996 State-Merge: unveränderte große Sendungssammlung bleibt strukturell wiederverwendet',()=>{
  let deepReads=0;
  const payload={};
  Object.defineProperty(payload,'documentBody',{
    enumerable:true,
    get(){deepReads++;return 'x'.repeat(1024)}
  });
  const shipments=[{
    id:'S1',
    ref:'ABC123',
    deliveryFiles:[{id:'D1',payload}],
    updatedAt:'2026-09-03T10:00:00.000Z'
  }];
  const server={...meta(),shipments,tasks:[{id:'T1',status:'offen',updatedAt:'2026-09-03T10:00:00.000Z'}]};
  const incoming={...meta(),tasks:[{id:'T1',status:'erledigt',done:true,updatedAt:'2026-09-03T11:00:00.000Z'}]};

  const merged=mergeState(server,incoming);
  assert.equal(deepReads,0,'unveränderte Dokumentdaten dürfen beim Task-Merge nicht tief gelesen werden');
  assert.strictEqual(merged.shipments,shipments,'unveränderte Sendungssammlung muss strukturell wiederverwendet werden');
  assert.equal(merged.tasks[0].done,true);
});

test('RC996 State-Merge: öffentliche Tokens werden Copy-on-write entfernt ohne Dokumente oder Geschwister tief zu kopieren',()=>{
  let deepReads=0;
  const payload={};
  Object.defineProperty(payload,'documentBody',{
    enumerable:true,
    get(){deepReads++;return 'x'.repeat(1024)}
  });
  const protectedFiles=[{id:'D1',payload}];
  const withLegacyToken={id:'S1',ref:'ABC123',pickupToken:'legacy-secret',customerAvisToken:'legacy-avis',deliveryFiles:protectedFiles};
  const untouched={id:'S2',ref:'DEF456',deliveryFiles:[{id:'D2',payload}]};
  const shipments=[withLegacyToken,untouched];
  const server={...meta(),shipments};

  const merged=mergeState(server,meta());
  assert.equal(deepReads,0,'Token-Bereinigung darf Dokumentpayloads nicht tief lesen');
  assert.notStrictEqual(merged.shipments,shipments,'nur bei tatsächlich vorhandenem Secret muss die Sammlung flach kopiert werden');
  assert.notStrictEqual(merged.shipments[0],withLegacyToken,'Sendung mit Legacy-Token muss flach kopiert werden');
  assert.equal(merged.shipments[0].pickupToken,undefined);
  assert.equal(merged.shipments[0].customerAvisToken,undefined);
  assert.strictEqual(merged.shipments[0].deliveryFiles,protectedFiles,'Dokumentliste der bereinigten Sendung bleibt strukturell erhalten');
  assert.strictEqual(merged.shipments[1],untouched,'unbetroffene Sendung darf nicht kopiert werden');
  assert.equal(withLegacyToken.pickupToken,'legacy-secret','Original-State darf nicht mutiert werden');
});
