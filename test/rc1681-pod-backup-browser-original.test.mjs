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

test('RC1681: Azure-only POD response never tells the employee SharePoint copy succeeded', async () => {
  const x = cloudController({
    ok: true, saved: true, azureSaved: true, archiveSaved: true, driveSaved: false,
    fileName: 'POD_ABC123_Ladeliste_mit_Unterschrift.pdf', savedAt: '2026-10-27T07:01:00Z', webUrl: ''
  });
  await assert.rejects(
    x.cloud.backupBlob(x.sh, { blob: new Blob([samplePdf], { type: 'application/pdf' }), name: 'POD_ABC123_Ladeliste_mit_Unterschrift.pdf' }, { force: true }),
    /SharePoint|Microsoft-365/
  );
  assert.notEqual(x.sh.podCloudBackupStatus, 'saved');
  assert.equal(x.cloud.status(x.sh).saved, false);
  assert.equal(x.savedEvents.some(event => event.detail && event.detail.saved === true), false);
});

test('RC1681: historical local saved flag without Graph proof is retried, not trusted', async () => {
  const x = cloudController({
    ok: true, saved: true, azureSaved: true, archiveSaved: true, driveSaved: false,
    fileName: 'POD_ABC123_Ladeliste_mit_Unterschrift.pdf'
  });
  Object.assign(x.sh, {
    podCloudBackupStatus: 'saved', podCloudBackupAt: '2026-10-22T10:00:00Z',
    podCloudBackupFileName: 'POD_ABC123_Ladeliste_mit_Unterschrift.pdf', podDriveSaved: false
  });
  await assert.rejects(x.cloud.backupBlob(x.sh, { blob: new Blob([samplePdf], { type: 'application/pdf' }) }, {}), /SharePoint/);
  assert.equal(x.cloud.status(x.sh).saved, false);
});

test('RC1681: Graph-confirmed POD is shown as saved', async () => {
  const x = cloudController({
    ok: true, saved: true, azureSaved: true, archiveSaved: true, driveSaved: true,
    fileName: 'POD_ABC123_Ladeliste_mit_Unterschrift.pdf', savedAt: '2026-10-27T07:01:00Z', webUrl: 'https://example.invalid/SharePoint/POD_ABC123.pdf'
  });
  const result = await x.cloud.backupBlob(x.sh, { blob: new Blob([samplePdf], { type: 'application/pdf' }), name: 'POD_ABC123_Ladeliste_mit_Unterschrift.pdf' }, { force: true });
  assert.equal(result.saved, true);
  assert.equal(x.sh.podCloudBackupStatus, 'saved');
  assert.equal(x.sh.podDriveSaved, true);
  assert.equal(x.cloud.status(x.sh).saved, true);
});

test('RC1681: POD-Sicherung summary excludes historical Azure-only flags without Graph proof', async () => {
  const from = html.indexOf('async function refreshEmergencyStatus(){');
  const end = html.indexOf('\nfunction update(', from);
  assert.ok(from >= 0 && end > from);
  const elements = {
    '#rc551PodCloud': { textContent: '', style: {} },
    '#rc551PodVault': { textContent: '', style: {} },
    '#rc551PodFolder': { textContent: '', style: {} }
  };
  const context = {
    document: { getElementById: () => ({ querySelector: selector => elements[selector] }) },
    window: { ExportHUBPODVault: { count: async () => 1, folderInfo: async () => ({ connected: false, writable: false }) } },
    filtered: () => [
      { podCloudBackupStatus: 'saved', podCloudBackupFileName: 'POD_A.pdf', podDriveSaved: false },
      { podCloudBackupStatus: 'saved', podCloudBackupFileName: 'POD_B.pdf', podDriveSaved: true }
    ],
    low: v => String(v || '').toLowerCase(), q: v => String(v || '')
  };
  const check = vm.runInNewContext('(function(){' + html.slice(from, end) + ';return refreshEmergencyStatus})()', context);
  await check();
  assert.equal(elements['#rc551PodCloud'].textContent, '1 / 2 PODs');
});

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

test('RC1681: automatic emergency vault mirrors the persisted signed original without new rendering', async () => {
  const from = html.indexOf('async function mirrorShipment(sh,force){');
  const end = html.indexOf('\nasync function mirrorAll(', from);
  assert.ok(from >= 0 && end > from);
  const record = { ref: 'ABC123', id: 's1' };
  const saved = [];
  const original = new Blob([samplePdf], { type: 'application/pdf' });
  const context = {
    window: {
      ExportHUBPickupPOD: { syncOne: async () => true },
      ExportHUBRC1602OfficialPOD: { storedSignedBlob: async () => original, canonicalPdf: async () => { throw new Error('Do not call Graph if exact original is available'); } },
      ExportHUBIndex240: { createPodBlob: async () => { throw new Error('Do not recreate an already stored POD'); } }
    },
    list: async () => [], validPdfBlob: async blob => blob.size >= 1000 && Buffer.from(await blob.slice(0, 5).arrayBuffer()).toString('ascii') === '%PDF-',
    folderInfo: async () => ({ connected: false, writable: false }), writeFolder: async () => false,
    hasSignature: () => true, q: value => String(value || ''), low: value => String(value || '').toLowerCase(),
    ref: () => 'ABC123', sid: () => 's1', store: async (_shipment, blob, name) => { saved.push({ bytes: Buffer.from(await blob.arrayBuffer()), name }); }
  };
  const mirror = vm.runInNewContext('(function(){' + html.slice(from, end) + ';return mirrorShipment})()', context);
  assert.equal(await mirror(record, true), true);
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0].bytes, samplePdf);
});
