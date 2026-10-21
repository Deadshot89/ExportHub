import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const archive = require('../api/shared/pod-archive.js');
const store = require('../api/shared/pickup-store.js');
const key = 'c'.repeat(64);
const pdf = Buffer.from('%PDF-1.7\nSIGNED_IMMUTABLE_ORIGINAL\n');
const hash = crypto.createHash('sha256').update(pdf).digest('hex');
const file = {
  id: 'automatic-pod-' + hash.slice(0,16),
  kind: 'automatic-pod',
  blobName: 'production/original.pdf',
  hash,
  size: pdf.length,
  layoutVersion: archive.POD_PDF_LAYOUT_VERSION
};
const missing = () => Object.assign(new Error('Original primary blob missing'), { statusCode: 404 });

async function withReadback({ fileOverride = {}, backupOverride = {}, primary = missing(), secondary = pdf }, fn) {
  const saved = { getRecord: store.getRecord, readBuffer: store.readBuffer, podArchiveClient: store.podArchiveClient };
  const calls = [];
  const version = { ...file, ...fileOverride };
  const record = { reference: '8LSUHW', podFiles: [version], podBackup: {
    archiveSaved: true, archiveBlobName: 'rc1220/production/immutable.pdf', hash, ...backupOverride
  } };
  try {
    store.getRecord = async () => ({ record, clients: { pods: {
      getBlobClient: name => ({ name, kind: 'primary' })
    }}});
    store.podArchiveClient = async () => ({ podArchive: {
      getBlobClient: name => ({ name, kind: 'archive' })
    }});
    store.readBuffer = async blob => {
      calls.push(blob.kind + ':' + blob.name);
      const value = blob.kind === 'primary' ? primary : secondary;
      if (value instanceof Error) throw value;
      return { buffer: value };
    };
    return await fn({ record, version, calls });
  } finally {
    store.getRecord = saved.getRecord;
    store.readBuffer = saved.readBuffer;
    store.podArchiveClient = saved.podArchiveClient;
  }
}

test('RC1608: 8LSUHW original POD downloads exact SHA-matching archive when primary is 404', async () => {
  await withReadback({}, async ({ record, version, calls }) => {
    const before = JSON.stringify(record);
    const historic = await archive.getPodDownload(key, 'production', version.id);
    assert.deepEqual(historic.buffer, pdf);
    assert.equal(historic.file.id, version.id);
    assert.deepEqual(calls, ['primary:production/original.pdf', 'archive:rc1220/production/immutable.pdf']);
    assert.equal(JSON.stringify(record), before, 'readback must not mutate any signed original');
  });
});

test('RC1608: mismatched archive hash cannot silently substitute another historical PDF', async () => {
  await withReadback({backupOverride:{hash: 'f'.repeat(64)}}, async ({version,calls}) => {
    await assert.rejects(archive.getPodDownload(key,'production',version.id), e => e.statusCode === 404);
    assert.deepEqual(calls, ['primary:production/original.pdf']);
  });
});

test('RC1608: archived bytes with incorrect hash are blocked, not delivered', async () => {
  await withReadback({secondary: Buffer.from('%PDF-1.7\nCORRUPT')}, async ({version,calls}) => {
    await assert.rejects(archive.getPodDownload(key,'production',version.id), e => e.code === 'POD_BLOB_INTEGRITY_FAILED' && e.status === 409);
    assert.equal(calls.length,2);
  });
});

test('RC1608: valid primary PDF is returned without using archive and keeps canonical path read-only', async () => {
  await withReadback({primary:pdf}, async ({record,calls}) => {
    const before=JSON.stringify(record);
    const canonical=await archive.getPodDownload(key,'production',null);
    assert.deepEqual(canonical.buffer,pdf);
    assert.deepEqual(calls,['primary:production/original.pdf']);
    assert.equal(JSON.stringify(record),before);
  });
});

test('RC1608: missing metadata, no confirmed archive, or missing primary never guesses a replacement', async () => {
  await withReadback({backupOverride:{archiveSaved:false}}, async ({version,calls}) => {
    await assert.rejects(archive.getPodDownload(key,'production',version.id), e => e.statusCode===404);
    assert.equal(calls.length,1);
  });
});
