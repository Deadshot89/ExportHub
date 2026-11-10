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
 assert.match(api, /if\(!\/\^refdoc:\[0-9a-f\]\{32\}\$\/\.test\(id\)\)/);
 assert.match(api, /refDocBlob\.softDelete\(ref,environment,id,usernameOf\(sessionInfo\.user\)\)/);
 assert.match(api, /refDocBlob\.hiddenNames\(ref,env\)/);
 assert.match(api, /azureDocNames\.has\(text\(f\.name\)\.toLowerCase\(\)\)/);
});

test('AVIS: entfernte Dokumente werden nicht über Graph erneut veröffentlicht', () => {
 assert.match(avis, /hidden=await refDocStore\.hiddenNames\(reference,environment\)/);
 assert.match(avis, /hidden\.has\(key\)/);
});

test('Sendungsansicht: sichtbare Aktionen für Originaldatei, sichere Vorschau und Rückfrage', () => {
 assert.match(ui, /\['open','Öffnen'\]/);
 assert.match(ui, /\['download','Herunterladen'\]/);
 assert.match(ui, /\['delete','Löschen'\]/);
 assert.match(ui, /q\(d\.itemId\)\)\?\[\['delete','Löschen'\]\]/);
 assert.match(ui, /action:'delete-document'/);
 assert.match(ui, /window\.confirm\(/);
 assert.match(ui, /fetchStoredFile\(ctx\.reference,d\)/);
 assert.match(ui, /URL\.createObjectURL\(blob\)/);
 assert.match(ui, /info\.name\?' → '\+info\.name/);
});
