import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const store=fs.readFileSync('api/shared/pickup-store.js','utf8');
const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');
const reconcile=fs.readFileSync('api/pod-backup-reconcile/index.js','utf8');
const backup=fs.readFileSync('api/pod-backup/index.js','utf8');
const confirm=fs.readFileSync('api/pickup-confirm-v2/index.js','utf8');
const ui=fs.readFileSync('assets/rc1165-pod-backup-status.js','utf8');
const pickup=fs.readFileSync('pickup.html','utf8');
const settings=JSON.parse(fs.readFileSync('api/local.settings.example.json','utf8'));

test('RC1220: separater Azure-Archivcontainer ist Standard und benötigt keine neue Pflichtkonfiguration',()=>{
  assert.match(store,/EXPORTHUB_POD_BACKUP_CONTAINER\|\|'exporthub-pod-backup'/);
  assert.match(store,/EXPORTHUB_POD_BACKUP_CONNECTION_STRING\|\|connectionString\(\)/);
  assert.match(store,/podArchive=backupService\.getContainerClient\(POD_BACKUP_CONTAINER\)/);
  assert.match(store,/podArchive\.createIfNotExists\(\)/);
  assert.equal(settings.Values.EXPORTHUB_POD_BACKUP_CONTAINER,'exporthub-pod-backup');
  assert.equal(settings.Values.EXPORTHUB_POD_M365_ENABLED,'false');
});

test('RC1220: Archivkopie ist unveränderlich und wird per SHA-256 plus Größe verifiziert',()=>{
  assert.match(archive,/kind:\s*'automatic-pod-archive'/);
  assert.match(archive,/sha256:\s*hash/);
  assert.match(archive,/conditions:\s*\{\s*ifNoneMatch:\s*'\*'\s*\}/);
  assert.match(archive,/blob\.getProperties\(\)/);
  assert.match(archive,/storedHash !== hash\.toLowerCase\(\) \|\| storedSize !== pdf\.length/);
  assert.match(archive,/POD_ARCHIVE_CONFLICT/);
});

test('RC1220: Primärspeicher kommt vor Archiv; M365 ist danach nur optional',()=>{
  const primary=archive.indexOf('await saveAzurePod(accessKey, environment, record, pdf)');
  const secondary=archive.indexOf('await saveAzureArchive(accessKey, environment, record, pdf, file)');
  const optional=archive.indexOf('await copyToDrive(accessKey, environment, record, pdf, file)');
  assert.ok(primary>=0&&secondary>primary&&optional>secondary);
  assert.match(archive,/EXPORTHUB_POD_M365_ENABLED/);
  assert.match(archive,/!m365Enabled\(\) \|\| !graphDrive\.readiness\(\)\.configured/);
});

test('RC1220: Reconcile hängt nicht mehr von Graph-Bereitschaft ab',()=>{
  assert.match(reconcile,/const graph = graphDrive\.readiness\(\)/);
  assert.doesNotMatch(reconcile,/GRAPH_NOT_CONFIGURED/);
  assert.match(reconcile,/backupMode:\s*'azure-archive'/);
  assert.match(archive,/if \(backup\.archiveSaved === true\)/);
  assert.match(archive,/await retryArchiveBackup\(candidate\.accessKey, environment\)/);
});

test('RC1220: automatische und bereitgestellte PODs nutzen die Azure-Zweitsicherung',()=>{
  assert.match(archive,/async function saveSuppliedPod\(/);
  assert.match(backup,/podArchive\.saveSuppliedPod\(/);
  assert.match(backup,/podArchive\.retryArchiveBackup\(/);
  assert.match(confirm,/podArchiveSaved:/);
  assert.match(store,/podArchiveSaved:/);
});

test('RC1220: UI meldet Azure plus Archiv und nicht mehr M365 als Pflicht',()=>{
  assert.match(ui,/Azure \+ Archiv/);
  assert.match(ui,/Archiv offen/);
  assert.doesNotMatch(ui,/M365 offen/);
  assert.match(pickup,/data\.podArchiveSaved/);
});

test('RC1220: geänderte Runtime-Dateien sind syntaktisch gültig',()=>{
  for(const file of [
    'api/shared/pickup-store.js',
    'api/shared/pod-archive.js',
    'api/pod-backup-reconcile/index.js',
    'api/pod-backup/index.js',
    'api/pickup-confirm-v2/index.js',
    'assets/rc1165-pod-backup-status.js'
  ]) execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
});
