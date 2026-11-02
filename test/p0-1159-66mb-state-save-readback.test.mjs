import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {mergeState, pruneTombstones} = require('../api/shared/merge.js');
const {compactStateForStorage} = require('../api/shared/state-compaction.js');

function productionUploadJson() {
  const source = fs.readFileSync(new URL('../api/exporthub-state/index.js', import.meta.url), 'utf8');
  const begin = source.indexOf('async function uploadJson(');
  const end = source.indexOf('function isStorageWriteConflict(', begin);
  assert.ok(begin >= 0 && end > begin, 'exercise the real production uploadJson implementation');
  return new Function('Buffer', source.slice(begin, end) + ';return uploadJson;')(Buffer);
}

test('P0 #1159: synthetic 66 MB shipment delta survives merge, compaction, conditional Azure upload and independent readback', {timeout: 120_000}, async () => {
  // Synthetic data ONLY. Never fetch, upload or modify a production/testservice blob.
  // Shipment count and JSON size approximate the observed 02.11 production state;
  // this is a regression of the Node save path, not a substitute for a live POST.
  const filler = 'x'.repeat(120_000);
  const shipments = Array.from({length: 552}, (_, index) => {
    const id = 'SYNTH-' + String(index).padStart(4, '0');
    return {
      id,
      shipmentId: id,
      ref: 'R' + String(index).padStart(5, '0'),
      status: 'Erstellt',
      updatedAt: '2026-10-01T08:00:00.000Z',
      note: 'unchanged',
      payload: filler,
      ...(index === 0 ? {
        podFiles: [{id: 'POD-ORIGINAL', name: 'signed.pdf', checksum: 'synthetic-checksum'}]
      } : {})
    };
  });
  const savedShipments = [{
    id: 'SAVED-1', ref: 'SAVED001', status: 'Abgeholt',
    podFiles: [{id: 'SIGNED-ORIGINAL', name: 'POD.pdf', checksum: 'unchanged'}]
  }];
  const state = {
    shipments, savedShipments,
    _teamSyncMeta: {fields: {}, tombstones: []}
  };
  assert.ok(Buffer.byteLength(JSON.stringify(state), 'utf8') >= 65_000_000,
    'fixture must reproduce a production-scale JSON state');

  const delta = {
    shipments: [{
      id: 'SYNTH-0017', shipmentId: 'SYNTH-0017', ref: 'R00017',
      note: 'confirmed synthetic change', updatedAt: '2026-11-02T17:00:00.000Z'
    }]
  };
  const merged = compactStateForStorage(pruneTombstones(mergeState(state, delta)));
  assert.equal(merged.shipments.length, 552, 'no unrelated shipment dropped');
  assert.equal(merged.savedShipments.length, 1, 'saved-only shipment kept');
  assert.equal(merged.shipments.find(s => s.ref === 'R00017')?.note, 'confirmed synthetic change',
    'small delta must reach its target');

  const document = {
    schemaVersion: 3, revision: 45043,
    updatedAt: '2026-11-02T17:01:00.000Z', clientVersion: 'P0-1159-SYNTHETIC',
    state: merged, users: []
  };

  let writes = 0;
  let storedBuffer = null;
  const azureStub = {
    upload: async (buffer, byteCount, options) => {
      writes += 1;
      assert.ok(Buffer.isBuffer(buffer));
      assert.equal(buffer.length, byteCount);
      assert.equal(options.conditions.ifMatch, '"synthetic-previous-etag"',
        'conditional write must not overwrite an unexpected revision');
      assert.equal(options.transportAttempts, 1,
        '66 MB uploads must not blindly repeat ambiguous PUTs');
      storedBuffer = buffer;
      return {etag: '"synthetic-new-etag"'};
    }
  };
  const saved = await productionUploadJson()(azureStub, document, '"synthetic-previous-etag"');
  assert.equal(writes, 1);
  assert.ok(saved.bytes >= 65_000_000, 'full production-size blob really serialized');
  assert.equal(saved.etag, '"synthetic-new-etag"');

  // Independently deserialize the bytes received by the mock Azure transport:
  // comparing with the in-memory merged value alone would miss a serialization bug.
  const reloaded = JSON.parse(storedBuffer.toString('utf8'));
  assert.equal(reloaded.revision, 45043);
  assert.equal(reloaded.state.shipments.length, 552);
  assert.equal(reloaded.state.shipments.find(s => s.ref === 'R00017')?.note,
    'confirmed synthetic change');
  assert.equal(reloaded.state.shipments.find(s => s.ref === 'R00000')?.payload.length, 120_000);
  assert.equal(reloaded.state.shipments.find(s => s.ref === 'R00551')?.payload.length, 120_000);
  assert.deepEqual(reloaded.state.shipments.find(s => s.ref === 'R00000')?.podFiles,
    [{id: 'POD-ORIGINAL', name: 'signed.pdf', checksum: 'synthetic-checksum'}],
    'original signed-POD references must not be lost');
  assert.deepEqual(reloaded.state.savedShipments[0].podFiles,
    [{id: 'SIGNED-ORIGINAL', name: 'POD.pdf', checksum: 'unchanged'}],
    'saved-only signed-POD references must remain intact');
});
