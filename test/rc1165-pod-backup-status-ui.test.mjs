import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const runtime=fs.readFileSync('assets/rc1165-pod-backup-status.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function api(){
  const sandbox={
    setTimeout(){return 1},
    clearTimeout(){},
    addEventListener(){},
    console:{warn(){}}
  };
  vm.runInNewContext(runtime,sandbox,{filename:'rc1165-pod-backup-status.js'});
  return sandbox.ExportHUBRC1165PodBackupStatus;
}

test('RC1165: Runtime ist syntaktisch gültig und read-only',()=>{
  execFileSync(process.execPath,['--check','assets/rc1165-pod-backup-status.js'],{stdio:'pipe'});
  assert.doesNotMatch(runtime,/\bfetch\s*\(/);
  assert.doesNotMatch(runtime,/XMLHttpRequest/);
  assert.doesNotMatch(runtime,/pod-backup-reconcile/);
  assert.doesNotMatch(runtime,/lastError/);
});

test('RC1165: Vor Abholung wird kein POD-Backupstatus eingeblendet',()=>{
  const x=api();
  assert.equal(x.backupMeta({status:'Erstellt',podBackup:{azureSaved:true,driveSaved:false}}),null);
});

test('RC1220: bestätigte Azure-Archivkopie wird grün dargestellt',()=>{
  const x=api();
  const meta=x.backupMeta({status:'POD vorhanden',podBackup:{status:'saved',azureSaved:true,archiveSaved:true,driveSaved:false}});
  assert.equal(meta.key,'saved');
  assert.match(meta.label,/Azure \+ Archiv/);
});

test('RC1220: Azure-Primärspeicher ohne Archivkopie bleibt offen',()=>{
  const x=api();
  const meta=x.backupMeta({actualPickupAt:'2026-09-18T10:00:00Z',podBackup:{status:'pending',azureSaved:true,archiveSaved:false,driveSaved:false,lastError:'SECRET-INTERNAL-ERROR'}});
  assert.equal(meta.key,'pending');
  assert.match(meta.label,/Azure ✓ · Archiv offen/);
  assert.doesNotMatch(meta.label+meta.title,/SECRET-INTERNAL-ERROR/);
});

test('RC1165: fehlender oder fehlerhafter Zweitsicherungsstatus bleibt sichtbar',()=>{
  const x=api();
  assert.equal(x.backupMeta({status:'Abgeholt'}).key,'unknown');
  assert.equal(x.backupMeta({status:'Abgeholt',podBackup:{status:'failed',azureSaved:false,archiveSaved:false,driveSaved:false}}).key,'error');
});

test('RC1165: Runtime ist idempotent auf den vorhandenen Sendungskarten verankert',()=>{
  assert.match(runtime,/data-rc1165-pod-backup/);
  assert.match(runtime,/data-rc1014-shipment-meta/);
  assert.match(runtime,/shipmentoverview/);
  assert.match(runtime,/exporthub:shipment-updated/);
  assert.match(runtime,/exporthub:overview-updated/);
});

test('RC1165: Drei-Umgebungen-Build liefert die Runtime und behält kritische Fixes',()=>{
  assert.match(build,/exporthub-rc1165-pod-backup-status/);
  assert.match(build,/assets\/rc1165-pod-backup-status\.js\?v=1165/);
  assert.match(build,/'assets\/rc1165-pod-backup-status\.js'/);
  assert.match(build,/podBackupStatusUi:'RC1220 shipment overview Azure\/archive backup status'/);
  assert.match(build,/podGraphReadiness:'RC1164/);
  assert.match(build,/avisAppointmentRevisionHistory:'RC1163/);
  assert.match(build,/border:3mm solid #111827/);
});
