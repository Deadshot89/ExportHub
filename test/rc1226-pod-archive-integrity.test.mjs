import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');
const reconcile=fs.readFileSync('api/pod-backup-reconcile/index.js','utf8');
const workflow=fs.readFileSync('.github/workflows/rc1144-pod-backup-reconcile.yml','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1226: Archivkopie wird vor archiveSaved per vollständigem Read-back verifiziert',()=>{
  const upload=archive.indexOf('await blob.uploadData(pdf');
  const verify=archive.indexOf('await verifyAzureArchiveBlob(blob, hash, pdf.length, true)',upload);
  const saved=archive.indexOf('archiveSaved: true',verify);
  assert.ok(upload>=0&&verify>upload&&saved>verify);
  assert.match(archive,/crypto\.createHash\('sha256'\)\.update\(read\.buffer\)\.digest\('hex'\)/);
  assert.match(archive,/read\.buffer\.length !== wantedSize \|\| actualHash !== wantedHash/);
  assert.match(archive,/POD_ARCHIVE_INTEGRITY_FAILED/);
});

test('RC1226: bestehende Archivkopien werden regelmäßig geprüft',()=>{
  assert.match(archive,/await checkAzureArchive\(clients, record, match\[1\]\.toLowerCase\(\), fullRead\)/);
  assert.match(archive,/Date\.now\(\) - lastVerifiedMs >= 24 \* 60 \* 60 \* 1000/);
  assert.match(archive,/verifiedCount \+= 1/);
  assert.match(archive,/archiveVerifiedAt: integrity\.verifiedAt/);
});

test('RC1226: fehlende Archivkopie wird automatisch zur Reparatur zurückgesetzt',()=>{
  assert.match(archive,/code: 'POD_ARCHIVE_NOT_FOUND'/);
  assert.match(archive,/repairable: true/);
  assert.match(archive,/status: 'pending',[\s\S]{0,180}archiveSaved: false/);
  assert.match(archive,/forceRepair = true/);
  assert.match(archive,/await retryArchiveBackup\(candidate\.accessKey, environment\)/);
});

test('RC1226: beschädigte vorhandene Kopie bleibt fail-closed und wird nicht überschrieben',()=>{
  assert.match(archive,/repairable: false/);
  assert.match(archive,/integrityErrors\.push/);
  assert.match(archive,/conditions: \{ ifNoneMatch: '\*' \}/);
});

test('RC1226: Reconcile und Workflow melden Integritäts- und Reparaturzähler',()=>{
  assert.match(archive,/verifiedCount,/);
  assert.match(archive,/repairedStateCount,/);
  assert.match(archive,/const errors = integrityErrors\.slice\(\)/);
  assert.match(reconcile,/version: 'RC1226'/);
  assert.match(workflow,/verifiedCount:v\.verifiedCount/);
  assert.match(workflow,/repairedStateCount:v\.repairedStateCount/);
  assert.match(build,/podArchiveIntegrity:'RC1226 archive read-back \+ scheduled integrity verification'/);
});

test('RC1226: Runtime bleibt syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','api/shared/pod-archive.js'],{stdio:'pipe'});
  execFileSync(process.execPath,['--check','api/pod-backup-reconcile/index.js'],{stdio:'pipe'});
});
