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

test('RC1165: bestätigte M365-Zweitsicherung wird grün dargestellt',()=>{
  const x=api();
  const meta=x.backupMeta({status:'POD vorhanden',podBackup:{status:'saved',azureSaved:true,driveSaved:true}});
  assert.equal(meta.key,'saved');
  assert.match(meta.label,/Azure \+ M365/);
});

test('RC1165: Azure-only zeigt M365 offen statt falschem Erfolg',()=>{
  const x=api();
  const meta=x.backupMeta({actualPickupAt:'2026-09-18T10:00:00Z',podBackup:{status:'pending',azureSaved:true,driveSaved:false,lastError:'SECRET-INTERNAL-ERROR'}});
  assert.equal(meta.key,'pending');
  assert.match(meta.label,/Azure ✓ · M365 offen/);
  assert.doesNotMatch(meta.label+meta.title,/SECRET-INTERNAL-ERROR/);
});

test('RC1165: fehlender oder fehlerhafter Zweitsicherungsstatus bleibt sichtbar',()=>{
  const x=api();
  assert.equal(x.backupMeta({status:'Abgeholt'}).key,'unknown');
  assert.equal(x.backupMeta({status:'Abgeholt',podBackup:{status:'failed',azureSaved:false,driveSaved:false}}).key,'error');
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
  assert.match(build,/podBackupStatusUi:'RC1165 shipment overview Azure\/M365 backup status'/);
  assert.match(build,/podGraphReadiness:'RC1164/);
  assert.match(build,/avisAppointmentRevisionHistory:'RC1163/);
  assert.match(build,/border:4mm solid #facc15/);\n  assert.match(build,/deckblattHighVisibility:'RC1198/);
});
