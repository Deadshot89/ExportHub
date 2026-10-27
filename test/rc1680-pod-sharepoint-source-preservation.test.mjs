import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Module = require('node:module');

function storage() {
  const saved = new Map();
  const metadata = new Map();
  const getBlobClient = name => ({
    name,
    saved,
    async getProperties() {
      const data = saved.get(name);
      if (!data) throw Object.assign(new Error('Blob missing'), { statusCode: 404 });
      return { contentLength: data.length, metadata: metadata.get(name) || {} };
    }
  });
  return {
    saved,
    getBlobClient,
    getBlockBlobClient(name) {
      return {
        ...getBlobClient(name),
        async uploadData(data, options) {
          if (saved.has(name)) throw Object.assign(new Error('Blob already exists'), { statusCode: 409 });
          saved.set(name, Buffer.from(data));
          metadata.set(name, options && options.metadata || {});
        }
      };
    }
  };
}

function podFixture({ failGraph = false } = {}) {
  const primary = storage();
  const archiveStorage = storage();
  const uploads = [];
  let graphFails = failGraph;
  let record = {
    reference: 'ABC123',
    status: 'confirmed',
    confirmedAt: '2026-10-27T07:00:00Z',
    signatureBlobName: 'signature-original',
    podFiles: [],
    podBackup: {}
  };
  const store = {
    POD_BACKUP_CONTAINER: 'exporthub-pod-backup',
    now: () => '2026-10-27T07:01:00Z',
    normalizeEnvironment: () => 'production',
    podPrefix: () => 'rc995/production/pods/fixture',
    getRecord: async () => ({ record, clients: { pods: primary } }),
    podArchiveClient: async () => ({ podArchive: archiveStorage }),
    mutateRecord: async (_accessKey, _environment, change) => {
      record = change(structuredClone(record));
      return record;
    },
    readBuffer: async blob => {
      const buffer = blob.saved.get(blob.name);
      if (!buffer) throw Object.assign(new Error('Blob missing'), { statusCode: 404 });
      return { buffer: Buffer.from(buffer) };
    }
  };
  const graphDrive = {
    readiness: () => ({ configured: true }),
    uploadPdf: async (buffer, name) => {
      uploads.push({ buffer: Buffer.from(buffer), name });
      if (graphFails) throw Object.assign(new Error('Configured SharePoint target not found'), { code: 'GRAPH_DIRECT_PATH_TARGET_FAILED', graphCode: 'ResourceNotFound' });
      return { id: 'graph-pod-1', name, webUrl: 'https://example.invalid/backup' };
    }
  };
  const modulePath = require.resolve('../api/shared/pod-archive.js');
  const originalLoad = Module._load;
  delete require.cache[modulePath];
  Module._load = function(request, parent, isMain) {
    if (parent && parent.filename === modulePath && request === './pickup-store') return store;
    if (parent && parent.filename === modulePath && request === './graph-drive') return graphDrive;
    return originalLoad.call(this, request, parent, isMain);
  };
  let podArchive;
  try { podArchive = require(modulePath); }
  finally { Module._load = originalLoad; }
  return {
    podArchive,
    uploads,
    primary,
    archiveStorage,
    record: () => record,
    failGraph: value => { graphFails = value; },
    markDrivePending: () => { record.podBackup.driveSaved = false; }
  };
}

// A deterministic PDF-shaped fixture; the route validates complete PDFs separately.
const originalPdf = Buffer.from('%PDF-1.4\n' + 'digital signed loading list fixture\n'.repeat(40));

test('digital POD is sent to SharePoint immediately using the exact archived signed PDF', async () => {
  const f = podFixture();
  const saved = await f.podArchive.saveSuppliedPod('fixture', 'production', f.record(), originalPdf);
  assert.equal(f.record().podBackup.azureSaved, true);
  assert.equal(f.record().podBackup.archiveSaved, true);
  assert.equal(f.record().podBackup.driveSaved, true);
  assert.equal(f.uploads.length, 1);
  assert.deepEqual(f.uploads[0].buffer, originalPdf);
  assert.equal(f.uploads[0].name, 'POD_ABC123_Ladeliste_unterschrieben.pdf');
  assert.equal(saved.driveSaved, true);
});

test('SharePoint target failure keeps original Azure POD, and retry preserves original PDF bytes and file identity', async () => {
  const f = podFixture({ failGraph: true });
  await f.podArchive.saveSuppliedPod('fixture', 'production', f.record(), originalPdf);
  const originalFile = structuredClone(f.record().podFiles[0]);
  assert.equal(f.record().podBackup.archiveSaved, true);
  assert.equal(f.record().podBackup.driveSaved, false);
  assert.match(f.record().podBackup.driveLastError, /GRAPH_DIRECT_PATH_TARGET_FAILED/);
  f.failGraph(false);
  const retried = await f.podArchive.retryArchiveBackup('fixture', 'production');
  assert.equal(retried.driveSaved, true);
  assert.equal(f.record().podBackup.driveSaved, true);
  assert.deepEqual(f.record().podFiles[0], originalFile);
  assert.deepEqual(f.uploads.at(-1).buffer, originalPdf);
  assert.equal(f.primary.saved.size, 1);
  assert.equal(f.archiveStorage.saved.size, 1);
});

test('SharePoint backfill reads the verified historical Azure archive if the primary POD blob is missing', async () => {
  const f = podFixture({ failGraph: true });
  await f.podArchive.saveSuppliedPod('fixture', 'production', f.record(), originalPdf);
  const signedOriginal = structuredClone(f.record().podFiles[0]);
  f.primary.saved.clear();
  f.failGraph(false);
  const result = await f.podArchive.retryArchiveBackup('fixture', 'production');
  assert.equal(result.driveSaved, true);
  assert.equal(f.record().podBackup.driveSaved, true);
  assert.deepEqual(f.uploads.at(-1).buffer, originalPdf);
  assert.deepEqual(f.record().podFiles[0], signedOriginal);
  assert.equal(f.primary.saved.size, 0);
  assert.equal(f.archiveStorage.saved.size, 1);
});
