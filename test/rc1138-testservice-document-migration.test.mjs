import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const API='api/state-maintenance/index.js';
const WF='.github/workflows/rc1137-state-compaction.yml';

test('RC1138: Wartungs-API bindet die bestehende verifizierte Dokumentmigration ein',()=>{
  const source=fs.readFileSync(API,'utf8');
  assert.match(source,/migrateLegacyDocuments/,'bestehende Blob-Migration muss wiederverwendet werden');
  assert.match(source,/DOCUMENT_CONTAINER/,'Dokumentcontainer muss explizit verwendet werden');
  assert.match(source,/migrate-testservice-documents/,'dedizierte Wartungsaktion fehlt');
});

test('RC1138: Dokumentmigration ist hart auf TESTSERVICE begrenzt und Produktion bleibt gesperrt',()=>{
  const source=fs.readFileSync(API,'utf8');
  assert.match(source,/TESTSERVICE_ONLY/,'explizite TESTSERVICE-Sperre fehlt');
  assert.match(source,/environment\s*!==?\s*['"]testservice['"]/,'Umgebungsprüfung fehlt');
  assert.doesNotMatch(source,/migrate-production-documents/,'Produktionsmigration darf nicht existieren');
});

test('RC1138: vor der ersten State-Aenderung wird ein verifiziertes Backup erstellt',()=>{
  const source=fs.readFileSync(API,'utf8');
  const functionPos=source.indexOf('async function migrateTestserviceDocuments');
  assert.ok(functionPos>=0,'Migration-Funktion fehlt');
  const block=source.slice(functionPos);
  const backupPos=block.indexOf('createVerifiedBackup');
  const uploadPos=block.indexOf('uploadTeam');
  assert.ok(backupPos>=0,'Backup-Aufruf fehlt');
  assert.ok(uploadPos>backupPos,'State darf erst nach dem Backup geschrieben werden');
  assert.match(block,/RC1138-document-migration/,'eindeutiger Backup-/Client-Versionsmarker fehlt');
  assert.match(block,/backupVerified/,'Backup-Nachweis in Antwort fehlt');
});

test('RC1138: Migration arbeitet in kleinen verifizierten Batches mit ETag-Konfliktschutz',()=>{
  const source=fs.readFileSync(API,'utf8');
  const functionPos=source.indexOf('async function migrateTestserviceDocuments');
  assert.ok(functionPos>=0,'Migration-Funktion fehlt');
  const block=source.slice(functionPos);
  assert.match(block,/limit\s*:\s*10/,'Batchlimit 10 fehlt');
  assert.match(block,/migrateLegacyDocuments\(/,'Migration wird nicht ausgeführt');
  assert.match(block,/currentEtag|etag/,'ETag-Fortschreibung fehlt');
  assert.match(block,/CONCURRENT_UPDATE/,'Konflikt muss fail-closed abbrechen');
  assert.match(block,/MIGRATION_NO_PROGRESS/,'kein Fortschritt muss fail-closed abbrechen');
});

test('RC1138: Workflow migriert nur TESTSERVICE und verifiziert danach null Inline-Payloads',()=>{
  const source=fs.readFileSync(WF,'utf8');
  const testStart=source.indexOf('TESTSERVICE');
  const prodStart=source.indexOf('PRODUCTION');
  assert.ok(testStart>=0&&prodStart>testStart,'Workflow-Struktur fehlt');
  const testBlock=source.slice(testStart,prodStart);
  assert.match(testBlock,/migrate-testservice-documents/,'TESTSERVICE-Migrationsaufruf fehlt');
  assert.match(testBlock,/inlinePayloadCount/,'Inline-Anzahl wird nicht nachgeprüft');
  assert.match(testBlock,/documentPayloadBytes/,'Inline-Bytes werden nicht nachgeprüft');
  assert.match(testBlock,/blobDocumentEntries/,'Blob-Referenzen werden nicht nachgeprüft');
  const prodBlock=source.slice(prodStart);
  assert.doesNotMatch(prodBlock,/migrate-testservice-documents/,'Produktionsjob darf Dokumentmigration nicht ausführen');
});
