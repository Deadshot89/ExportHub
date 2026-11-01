import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

// RC1740: an uploaded POD can be removed from a shipment (overview card) and a new POD uploaded afterwards.

const require = createRequire(import.meta.url);
const { mergeShipmentProtected, mergePodFilesProtected } = require('../api/shared/merge.js');
const i18nSource = fs.readFileSync(new URL('../assets/i18n/rc1740-pod-remove.js', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../assets/rc1740-pod-remove.js', import.meta.url), 'utf8');
const builder = fs.readFileSync(new URL('../.github/rc1112/build-three-env.mjs', import.meta.url), 'utf8');
const pages = ['index.html', 'TESTVERSION.html'].map((f) => [f, fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')]);

function manualPod(extra = {}) {
  return Object.assign({
    id: 'POD-1730000000000', name: 'POD_ABC123.pdf', filename: 'POD_ABC123.pdf', type: 'application/pdf',
    data: 'data:application/pdf;base64,JVBERi0xLjQK', docKind: 'pod', source: 'manual-upload', manualUpload: true,
    status: 'active', uploadedAt: '2026-10-30T08:00:00.000Z', uploadedBy: 'Tobias'
  }, extra);
}

function shipment(extra = {}) {
  return Object.assign({
    id: 'SH-1', ref: 'ABC123', createdBy: 'someone.else', status: 'POD vorhanden', processStatus: 'POD vorhanden',
    podStatus: 'POD vorhanden', pickupStatus: 'abgeholt', pickedUpAt: '2026-10-30T08:00:00.000Z',
    actualPickupDate: '2026-10-30', podAvailable: true, podFiles: [manualPod()], updatedAt: '2026-10-30T08:00:00.000Z'
  }, extra);
}

function load({ user = { name: 'Tobias', role: 'admin' }, state, docAdmin = false } = {}) {
  const saves = [];
  const document = {
    readyState: 'complete', head: null, body: null,
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, contains: () => false, createElement: () => ({ setAttribute() {} })
  };
  const window = {
    document,
    __EXPORTHUB_GET_STATE__: () => state,
    ExportHUBClean: {
      runtime: { user, changeGeneration: 1, lastSavedGeneration: 0, saving: false },
      queueSave: (reason) => { saves.push(reason); },
      flushSave: () => Promise.resolve(true)
    },
    canAdmin: (id) => docAdmin && id === 'cmr',
    ExportHUBI18n: { language: () => 'de' },
    setTimeout: () => 1,
    addEventListener() {},
    alert() { throw new Error('unexpected alert'); },
    confirm: () => true,
    prompt: () => 'Falscher POD'
  };
  const context = vm.createContext({ window, document, globalThis: window, JSON, Date, Promise, Object, String, Number, Array, Error, console });
  vm.runInContext(i18nSource, context);
  vm.runInContext(source, context);
  return { api: window.ExportHUBPodRemove1740, saves, window };
}

test('RC1740: Admin entfernt manuell hochgeladenen POD, Status fällt auf Abgeholt / POD fehlt', async () => {
  const sh = shipment(), copy = shipment();
  const state = { shipments: [sh], shipment: copy };
  const { api, saves } = load({ state });
  assert.equal(api.removableFiles(sh).length, 1);
  const res = await api.removePod('SH-1', 'POD-1730000000000', { skipConfirm: true, reason: 'Falsche Datei', silent: true });
  assert.equal(res.ok, true);
  assert.equal(res.saved, true);
  for (const x of [sh, copy]) {
    assert.equal(x.status, 'Abgeholt');
    assert.equal(x.processStatus, 'Abgeholt');
    assert.equal(x.podStatus, 'POD fehlt');
    assert.equal(x.podAvailable, false);
    assert.equal(x.podFiles.length, 1, 'Tombstone bleibt, damit der Server-Merge die Datei nicht zurückholt');
    assert.equal(x.podFiles[0].status, 'deleted');
    assert.equal(x.podFiles[0].data, undefined, 'kein Dateiinhalt mehr im aktiven POD-Feld');
    assert.equal(x.podFiles[0].customerAvisVisible, false, 'nicht mehr im Kundenportal');
    assert.equal(x.podFiles[0].deletionReason, 'Falsche Datei');
    assert.equal(x.documentHistory.length, 1);
    assert.match(x.documentHistory[0].data, /^data:application\/pdf/, 'Original bleibt in der Dokumenthistorie');
    assert.equal(x.shipmentHistory.at(-1).type, 'pod-removed');
    assert.equal(api.removableFiles(x).length, 0);
  }
  assert.deepEqual(saves, ['POD entfernt: ABC123']);
});

test('RC1740: ohne bestätigte Abholung wird die Sendung wieder Erstellt', async () => {
  const sh = shipment({ pickedUpAt: '', actualPickupDate: '', pickupStatus: '', status: 'POD vorhanden', processStatus: 'POD vorhanden' });
  const { api } = load({ state: { shipments: [sh] } });
  await api.removePod('ABC123', 'POD-1730000000000', { skipConfirm: true, reason: 'x', silent: true });
  assert.equal(sh.status, 'Erstellt');
  assert.equal(sh.podStatus, 'POD fehlt');
});

test('RC1740: Unterschrift aus QR-Abholung bleibt POD, nur die Datei wird entfernt', async () => {
  const sh = shipment({ pickupDriverSignature: 'data:image/png;base64,' + 'A'.repeat(300) });
  const { api } = load({ state: { shipments: [sh] } });
  await api.removePod('SH-1', 'POD-1730000000000', { skipConfirm: true, reason: 'x', silent: true });
  assert.equal(sh.podFiles[0].status, 'deleted');
  assert.equal(sh.status, 'POD vorhanden', 'QR-POD mit Fahrerunterschrift wird hier nicht angetastet');
});

test('RC1740: QR-Dateien sind keine einzeln entfernbaren Uploads, Rechte nur für Ersteller, Dokumenten-Admin oder globale Admins', async () => {
  const qr = shipment({ podFiles: [manualPod({ id: 'QR-ABC123-0', source: 'QR-Abholung', kind: 'signed-loadlist', manualUpload: false })] });
  const { api } = load({ state: { shipments: [qr] } });
  assert.equal(api.removableFiles(qr).length, 0);

  const sh = shipment();
  const plain = load({ user: { name: 'Lager', role: 'user' }, state: { shipments: [sh] } });
  assert.equal(plain.api.canRemove(sh), false);
  const res = await plain.api.removePod('SH-1', 'POD-1730000000000', { skipConfirm: true, reason: 'x', silent: true });
  assert.equal(res.code, 'NO_RIGHT');
  assert.equal(sh.podFiles[0].status, 'active');

  assert.equal(load({ user: { name: 'Lager', role: 'user' }, state: { shipments: [sh] }, docAdmin: true }).api.canRemove(sh), true);
  assert.equal(load({ user: { name: 'someone.else', role: 'user' }, state: { shipments: [sh] } }).api.canRemove(sh), true);
});

test('RC1740: Abbruch oder fehlender Grund ändert nichts', async () => {
  const sh = shipment();
  const { api } = load({ state: { shipments: [sh] } });
  const res = await api.removePod('SH-1', 'POD-1730000000000', { skipConfirm: true, reason: '', silent: true });
  assert.equal(res.code, 'REASON_REQUIRED');
  assert.equal(sh.podFiles[0].status, 'active');
  assert.equal(sh.status, 'POD vorhanden');
});

test('RC1740: Server-Merge holt einen entfernten POD aus einer veralteten Kopie nicht zurück', () => {
  const active = manualPod({ storage: 'blob', blobName: 'documents/production/ABC123/pod.pdf', data: undefined });
  const stone = Object.assign({}, active, { status: 'deleted', deletedAt: '2026-10-30T09:00:00.000Z', customerAvisVisible: false });
  // incoming stale browser still has the active file
  let merged = mergePodFilesProtected([stone], [active]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, 'deleted');
  // incoming removal against the active server copy
  merged = mergePodFilesProtected([manualPod()], [Object.assign({}, manualPod(), { status: 'deleted', deletedAt: '2026-10-30T09:00:00.000Z', data: undefined })].map((f) => { delete f.data; return f; }));
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, 'deleted');
  assert.equal(merged[0].data, undefined, 'kein Inhalt aus der aktiven Serverkopie im Tombstone');
  // a newly uploaded POD (new id) is kept next to the tombstone
  merged = mergePodFilesProtected([stone], [stone, manualPod({ id: 'POD-1730000099999' })]);
  assert.deepEqual(merged.map((f) => f.status).sort(), ['active', 'deleted']);
  // explicit later restore wins
  merged = mergePodFilesProtected([stone], [Object.assign({}, active, { restoredAt: '2026-10-30T10:00:00.000Z' })]);
  assert.equal(merged[0].status, 'active');
});

test('RC1740: kompletter Sendungs-Merge behält Entfernen, Status und Historie', () => {
  const server = shipment({ updatedAt: '2026-10-30T08:00:00.000Z' });
  const incoming = shipment({
    updatedAt: '2026-10-30T09:00:00.000Z', status: 'Abgeholt', processStatus: 'Abgeholt', podStatus: 'POD fehlt', podAvailable: false,
    podFiles: [Object.assign({}, manualPod(), { status: 'deleted', deletedAt: '2026-10-30T09:00:00.000Z', customerAvisVisible: false })].map((f) => { delete f.data; return f; }),
    documentHistory: [Object.assign({}, manualPod(), { status: 'deleted', deletedAt: '2026-10-30T09:00:00.000Z' })]
  });
  const out = mergeShipmentProtected(server, incoming);
  assert.equal(out.status, 'Abgeholt');
  assert.equal(out.podStatus, 'POD fehlt');
  assert.equal(out.podFiles.length, 1);
  assert.equal(out.podFiles[0].status, 'deleted');
  assert.equal(out.documentHistory.length, 1);
});

test('RC1740: Drei-Umgebungen-Build bindet Skript und Texte ein', () => {
  assert.match(builder, /\/assets\/rc1740-pod-remove\.js\?v=1740/);
  assert.match(builder, /\/assets\/i18n\/rc1740-pod-remove\.js\?v=1740/);
  assert.match(builder, /RC1740 POD entfernen fehlt/);
  assert.match(builder, /'assets\/rc1740-pod-remove\.js',\n  'assets\/i18n\/rc1740-pod-remove\.js',/);
});

test('RC1740: alle sechs Sprachen haben dieselben Texte', () => {
  const ctx = vm.createContext({ window: {} });
  ctx.globalThis = ctx.window;
  vm.runInContext(i18nSource, ctx);
  const packs = ctx.window.ExportHUBPodRemove1740I18n.packs;
  const keys = Object.keys(packs.de).sort();
  for (const lang of ['de', 'en', 'fr', 'it', 'es', 'pl']) {
    assert.deepEqual(Object.keys(packs[lang]).sort(), keys, lang);
    assert.match(packs[lang].confirm, /\{\{name\}\}/);
    assert.match(packs[lang].confirm, /\{\{ref\}\}/);
  }
});

function qrShipment(extra = {}) {
  return shipment(Object.assign({
    pickupConfirmedAt: '2026-10-29T10:00:00.000Z', pickupDriverName: 'Fahrer A',
    pickupDriverSignature: 'data:image/png;base64,' + 'A'.repeat(300), signatureAvailable: true,
    remotePickupStatusLocked: true, podServerVerified: true,
    podFiles: [{ id: 'QR-POD-ABC123', name: 'POD_ABC123_Ladeliste_mit_Unterschrift.pdf', url: '/api/pickup-pod?token=x', source: 'QR-Abholung', kind: 'signed-loadlist', remote: true }]
  }, extra));
}

test('RC1740: QR-POD mit Fahrerunterschrift wird entfernt, Abholung und Unterschrift bleiben', async () => {
  const sh = qrShipment();
  const { api } = load({ state: { shipments: [sh] } });
  assert.equal(api.signatureEvidence(sh), true);
  const res = await api.removePod('SH-1', api.QR_KEY, { skipConfirm: true, reason: 'Falsche Ladeliste', silent: true });
  assert.equal(res.ok, true);
  assert.equal(api.qrRemoved(sh), true);
  assert.equal(api.signatureEvidence(sh), false);
  assert.equal(sh.status, 'Abgeholt');
  assert.equal(sh.podStatus, 'POD fehlt');
  assert.equal(sh.podServerVerified, false);
  assert.equal(sh.pickupConfirmedAt, '2026-10-29T10:00:00.000Z', 'Abholung bleibt bestätigt');
  assert.match(sh.pickupDriverSignature, /^data:image/, 'Fahrerunterschrift bleibt als Abholnachweis');
  assert.equal(sh.podFiles[0].status, 'deleted');
  assert.equal(sh.podFiles[0].url, undefined);
  assert.equal(sh.qrPodRemoval.reason, 'Falsche Ladeliste');
  assert.equal(sh.qrPodRemoval.pickupConfirmedAt, '2026-10-29T10:00:00.000Z');
});

test('RC1740: nach QR-Entfernen und neuem Upload ist der Upload der POD', async () => {
  const sh = qrShipment({ podFiles: [] });
  const { api } = load({ state: { shipments: [sh] } });
  await api.removePod('SH-1', api.QR_KEY, { skipConfirm: true, reason: 'x', silent: true });
  sh.podFiles.push(manualPod({ id: 'POD-NEU' }));
  assert.equal(api.hasManualPod(sh), true);
  assert.equal(api.qrRemoved(sh), true, 'neuer Upload holt die QR-Unterschrift nicht als POD zurück');
});

test('RC1740: eine neue QR-Abholung nach dem Entfernen zählt wieder als POD', () => {
  const sh = qrShipment({ qrPodRemoval: { at: '2026-10-30T09:00:00.000Z', reason: 'x' } });
  const { api } = load({ state: { shipments: [sh] } });
  assert.equal(api.qrRemoved(sh), true);
  sh.pickupConfirmedAt = '2026-10-30T12:00:00.000Z';
  assert.equal(api.qrRemoved(sh), false);
  assert.equal(api.signatureEvidence(sh), true);
});

test('RC1740: POD-Prüfungen und QR-Abgleich in index.html und TESTVERSION.html beachten das Entfernen', () => {
  const guard = 'window.ExportHUBPodRemove1740&&window.ExportHUBPodRemove1740.qrRemoved(sh)';
  for (const [file, html] of pages) {
    const count = html.split(guard).length - 1;
    assert.equal(count, 5, file + ': Übersicht, RC542, RC543, RC628 (zweimal) prüfen qrRemoved');
    assert.match(html, /var rc1740Api=window\.ExportHUBPodRemove1740;if\(rc1740Api&&rc1740Api\.qrRemoved\(sh\)\)\{/, file);
    assert.match(html, /\}else\{patch\.podFiles=mergePodFiles\(/, file + ': QR-Abgleich holt entfernte QR-Dateien nicht zurück');
  }
});
