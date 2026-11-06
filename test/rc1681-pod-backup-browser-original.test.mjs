import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const samplePdf = Buffer.from('%PDF-1.4\n' + 'signed-pdf-original-content'.repeat(60));

function cloudController(responseBody) {
  const marker = '<script id="exporthub-rc479-sharepoint-pod-backup-controller">';
  const start = html.indexOf(marker);
  const end = html.indexOf('</script>', start);
  assert.ok(start >= 0 && end > start, 'real Cloud POD controller must exist');
  const writes = [];
  const savedEvents = [];
  const sh = { id: 's1', ref: 'ABC123', pickupToken: 'valid-pickup-token', pickupConfirmedAt: '2026-10-27T07:00:00Z' };
  const window = {
    __EXPORTHUB_GET_STATE__: () => ({ shipments: [sh] }),
    ExportHUBPODVault: { store: async () => true },
    ExportHUBClean: { queueSave: async reason => { writes.push(reason); return true; } },
    addEventListener: () => {},
    dispatchEvent: event => savedEvents.push(event)
  };
  const document = { readyState: 'loading', addEventListener: () => {}, hidden: false };
  const context = {
    window, document, Blob, Uint8Array, Date, console,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    setTimeout: () => 1, clearTimeout: () => {},
    btoa: value => Buffer.from(value, 'latin1').toString('base64'),
    fetch: async () => ({ ok: true, status: 200, text: async () => JSON.stringify(responseBody) })
  };
  vm.runInNewContext(html.slice(start + marker.length, end), context, { filename: 'rc479-sharepoint-pod.js' });
  return { sh, cloud: window.ExportHUBPODCloudBackup, writes, savedEvents };
}

function batchOriginalPod(api) {
  const from = html.indexOf('async function localSignedPod(sh){');
  const end = html.indexOf('\nvar crcTable=', from);
  assert.ok(from >= 0 && end > from, 'actual batch-download original reader must exist');
  let regenerated = 0;
  const context = {
    window: { ExportHUBRC1602OfficialPOD: api, ExportHUBIndex240: { createPodBlob: async () => { regenerated++; return { blob: new Blob([Buffer.from('%PDF-re-render')]) }; } } },
    Uint8Array, Blob, q: value => String(value || ''), safe: value => String(value || ''), ref: () => 'ABC123',
    ensureInlineSignature: async () => { throw new Error('Digitale Signatur ist aktuell nicht als Bild abrufbar'); },
    fileFormat: bytes => Buffer.from(bytes).toString('ascii', 0, 5) === '%PDF-' ? 'pdf' : ''
  };
  const reader = vm.runInNewContext('(function(){' + html.slice(from, end) + ';return localSignedPod})()', context);
  return { reader, regenerations: () => regenerated };
}

test('RC1681: bulk POD download uses the exact persisted signed PDF even without signature image', async () => {
  const original = new Blob([samplePdf], { type: 'application/pdf' });
  const x = batchOriginalPod({ storedSignedBlob: async () => original, canonicalPdf: async () => { throw new Error('Unexpected API call'); } });
  const downloaded = await x.reader({ ref: 'ABC123' });
  assert.deepEqual(Buffer.from(downloaded.bytes), samplePdf);
  assert.equal(downloaded.ext, 'pdf');
  assert.equal(x.regenerations(), 0);
});

test('RC1681: bulk POD download recovers exact server POD when the local attachment is absent', async () => {
  const original = new Blob([samplePdf], { type: 'application/pdf' });
  const x = batchOriginalPod({ storedSignedBlob: async () => null, canonicalPdf: async () => original });
  const downloaded = await x.reader({ ref: 'ABC123' });
  assert.deepEqual(Buffer.from(downloaded.bytes), samplePdf);
  assert.equal(x.regenerations(), 0);
});

