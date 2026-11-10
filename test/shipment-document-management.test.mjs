import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const store = require('../api/shared/ref-doc-blob-store.js');
const api = fs.readFileSync('api/reference-files/index.js', 'utf8');
const ui = fs.readFileSync('assets/shipment-document-upload.js', 'utf8');
const avis = fs.readFileSync('api/shared/customer-avis-reference-docs.js', 'utf8');
const storage = fs.readFileSync('api/shared/ref-doc-blob-store.js', 'utf8');

test('Entfernen: verbietet POD, AV, SharePoint-IDs und freie Blob-Schlüssel', async () => {
 for (const id of ['A1', 'avblob:' + 'a'.repeat(32), '../ABC123', 'refdoc:bad']) {
  await assert.rejects(store.softDelete('ABC123', 'production', id, 'tester'), error => {
   assert.equal(error.code, 'REFDOC_DELETE_FORBIDDEN');
   assert.equal(error.status, 403);
   return true;
  });
 }
});

test('Entfernen: Upload-spezifisch, referenzgebunden, reversibel, nach Rücklesen bestätigt', () => {
 assert.match(storage, /refdoc-removed-v1\//);
 assert.match(storage, /new RegExp\('\^\(\?:Lieferschein\|Rechnung\|Packliste\|Excel\|Dokument\)_'/);
 assert.match(storage, /conditions: \{ ifNoneMatch: '\*' \}/);
 assert.match(storage, /verified\.equals\(data\)/);
 assert.match(storage, /deletedRecords\(ref, env\)/);
 assert.match(storage, /return files\.filter\(f => !deleted\.has\(f\.id\)\)/);
 assert.doesNotMatch(storage.slice(storage.indexOf('async function softDelete')), /deleteIfExists\(|deleteBlob\(/);
});

test('API: authentifizierte Löschung nur für exakt nachgewiesene Upload-ID', () => {
 assert.match(api, /const sessionInfo=await validateSession\(req\)/);
 assert.match(api, /action==='delete-document'/);
 assert.match(api, /refDocBlob\.softDelete\(ref,environment,id/);
 assert.match(api, /refDocBlob\.softDelete\(ref,environment,id,usernameOf\(sessionInfo\.user\)\)/);
 assert.match(api, /refDocBlob\.removalFilters\(ref,env\)/);
 assert.match(api, /removedGraphHashes\.has\(crypto\.createHash\('sha256'\)/);
 assert.match(api, /azureDocNames\.has\(text\(f\.name\)\.toLowerCase\(\)\)/);
});

test('AVIS: entfernte Dokumente werden nicht über Graph erneut veröffentlicht', () => {
 assert.match(avis, /filters=await refDocStore\.removalFilters\(reference,environment\)/);
 assert.match(avis, /hiddenGraphHashes\.has\(crypto\.createHash\('sha256'\)/);
 assert.match(avis, /hidden\.has\(key\)/);
});

test('Sendungsansicht: vorhandenen Viewer, Download und Druck nicht überschreiben', () => {
 assert.match(ui, /querySelector\('\[data-rc786-open-file\]'\)/);
 assert.match(ui, /querySelector\('\[data-rc786-download-file\]'\)/);
 assert.doesNotMatch(ui, /actions\.textContent=''/, 'Vorhandene Druckfunktion darf nicht überschrieben werden');
 assert.doesNotMatch(ui, /actions\.textContent=''/);
 assert.match(ui, /if\(open&&open\.textContent!==t\('open'\)\)/);
 assert.match(ui, /if\(download&&download\.textContent!==t\('download'\)\)/);
 assert.match(ui, /function canRemoveDocument\(d\)/);
 assert.match(ui, /'data-docup-file-action':'delete'/);
 assert.match(ui, /if\(!canRemoveDocument\(d\)\)/);
 assert.match(ui, /action:'delete-document'/);
 assert.match(ui, /window\.confirm\(t\('removeConfirm'/);
 assert.match(ui, /t\('removed'\)/);
 assert.match(ui, /t\('actionError'/);
});
test('MutationObserver: Native-Dateiknöpfe dürfen nicht bei jedem Lauf neu geschrieben werden', () => {
 assert.match(ui,/open\.textContent!==t\('open'\)/);
 assert.match(ui,/download\.textContent!==t\('download'\)/);
 assert.match(ui,/oldRemove\.textContent!==t\('remove'\)/);
 assert.match(ui,/actions\.getAttribute\('data-docup-managed'\)!==q\(d\.itemId\)/);
 assert.match(ui,/if\(!row\.hasAttribute\('data-docup-layout'\)\)/);
});

test('Dokument-Aktionen besitzen Übersetzungen in allen sechs Sprachen', () => {
 const src=fs.readFileSync('assets/i18n/shipment-document-upload.js','utf8');
 for (const lang of ['de','en','pl','es','fr','it']) {
  assert.match(src,new RegExp('"'+lang+'":\\{'));
 }
 for (const key of ['removeConfirm','removed','actionError','open','download','remove'])assert.match(src,new RegExp('"'+key+'":'));
});

test('Neue Dateiauswahl ersetzt alte, damit keine fremde Rechnung im Upload bleibt', () => {
 assert.match(ui, /function addFiles\(files\)\{if\(busy\)return;log=\[\];picked=\[\];/);
});

test('SharePoint-only Upload: serverseitig gegen echte REF-Liste und Dateiart geprüft', () => {
 assert.match(api, /listFiles\(ref,req\),matches=listed\.files\.filter\(f=>f\.id===id\)/);
 assert.match(api, /refDocBlob\.hideSharePoint\(ref,environment,matches\[0\],usernameOf\(sessionInfo\.user\)\)/);
 assert.match(storage, /async function hideSharePoint\(ref, env, item, actor\)/);
 assert.match(ui, /function canRemoveDocument\(d\)/);
 assert.match(ui, /if\(!canRemoveDocument\(d\)\)/);
 assert.match(ui, /data-rc786-open-file/);
 assert.match(ui, /data-rc786-download-file/);
 assert.doesNotMatch(ui, /actions\.textContent=''/, 'Native Öffnen/Download/Drucken-Aktionen dürfen nicht gelöscht werden');
});
