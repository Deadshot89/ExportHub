import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const secureMerge = require('../api/shared/secure-merge.js');
const writeContext = require('../api/shared/state-write-context.js');

function right(level){
  return {
    level,
    visible: level !== 'none',
    read: level !== 'none',
    edit: level === 'edit' || level === 'admin',
    admin: level === 'admin',
    functionAdmin: level === 'admin'
  };
}

function shipmentEditor(){
  return {
    id:'RC1526-U1',
    user:'shipment-editor',
    role:'Benutzer',
    active:true,
    rights:{
      shipment:right('edit'),
      documents:right('view'),
      tasks:right('view'),
      customers:right('view'),
      settings:right('none')
    }
  };
}

function runAs(user, fn){
  return writeContext.run(() => {
    writeContext.captureUser(user);
    return fn();
  });
}

test('RC1526: authorized save is not rejected by unrelated unmapped full-state fields', () => {
  const server = {
    shipments:[{id:'S1',ref:'ABC123',status:'Erstellt',updatedAt:'2026-10-14T08:00:00.000Z'}],
    futureSensitiveState:{enabled:false,secretPolicy:'server-owned'},
    _teamSyncMeta:{
      fields:{
        shipments:{updatedAt:'2026-10-14T08:00:00.000Z'},
        futureSensitiveState:{updatedAt:'2026-10-14T08:00:00.000Z'}
      },
      tombstones:[]
    }
  };
  const incoming = structuredClone(server);
  incoming.shipments[0] = {...incoming.shipments[0], status:'Bereit zur Abholung', updatedAt:'2026-10-14T09:00:00.000Z'};
  incoming._teamSyncMeta.fields.shipments = {updatedAt:'2026-10-14T09:00:00.000Z'};

  // Simulate a legacy/full-state client carrying unrelated unmapped noise.
  incoming.futureSensitiveState = {enabled:true,secretPolicy:'must-not-be-written'};
  incoming._teamSyncMeta.fields.futureSensitiveState = {updatedAt:'2099-01-01T00:00:00.000Z'};
  incoming._teamSyncMeta.tombstones.push({
    collection:'futureSensitiveItems',
    id:'F1',
    deletedAt:'2099-01-01T00:00:00.000Z'
  });

  const merged = runAs(shipmentEditor(), () => secureMerge.mergeState(server, incoming));

  assert.equal(merged.shipments[0].status, 'Bereit zur Abholung');
  assert.deepEqual(merged.futureSensitiveState, server.futureSensitiveState);
  assert.deepEqual(merged._teamSyncMeta.fields.futureSensitiveState, server._teamSyncMeta.fields.futureSensitiveState);
  assert.equal(merged._teamSyncMeta.tombstones.length, 0);
});

test('RC1526: unmapped-only mutation remains fail-closed', () => {
  const server = {
    futureSensitiveState:{enabled:false,secretPolicy:'server-owned'},
    _teamSyncMeta:{fields:{futureSensitiveState:{updatedAt:'2026-10-14T08:00:00.000Z'}},tombstones:[]}
  };
  const incoming = structuredClone(server);
  incoming.futureSensitiveState = {enabled:true,secretPolicy:'must-not-be-written'};
  incoming._teamSyncMeta.fields.futureSensitiveState = {updatedAt:'2099-01-01T00:00:00.000Z'};

  assert.throws(
    () => runAs(shipmentEditor(), () => secureMerge.mergeState(server, incoming)),
    error => error && error.code === 'STATE_MODULE_WRITE_FORBIDDEN' && error.status === 403
  );
});
