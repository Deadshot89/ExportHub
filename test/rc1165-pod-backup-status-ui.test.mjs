import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createTestI18n} from './helpers/i18n.mjs';

const runtime=fs.readFileSync('assets/rc1165-pod-backup-status.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function api(){
  const sandbox={
    ExportHUBI18n:createTestI18n('de'),
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

test('RC1714: Azure-Archiv ohne SharePoint-Readback ist sichtbar offen, niemals grün',()=>{
  const x=api();
  const meta=x.backupMeta({status:'POD vorhanden',podBackup:{status:'saved',azureSaved:true,archiveSaved:true,driveSaved:false}});
  assert.equal(meta.key,'pending');
  assert.match(meta.label,/Azure ✓ · SharePoint offen/);
  assert.match(meta.title,/SHA-256/);
});

test('RC1714: unabhängig verifizierte Azure- und SharePoint-Kopie wird grün angezeigt',()=>{
  const x=api();
  const hash='a'.repeat(64);
  const meta=x.backupMeta({status:'POD vorhanden',podBackup:{
    status:'saved',azureSaved:true,archiveSaved:true,driveSaved:true,
    hash,driveItemId:'graph-file-verified',driveVerifiedHash:hash,driveVerifiedAt:'2026-10-28T12:00:00Z'
  }});
  assert.equal(meta.key,'saved');
  assert.match(meta.label,/Azure \+ SharePoint ✓/);
});

test('RC1714: historische und widersprüchliche Graph-Erfolgsmeldungen bleiben offen',()=>{
  const x=api();
  const hash='b'.repeat(64);
  const base={status:'saved',azureSaved:true,archiveSaved:true,driveSaved:true,
    hash,driveItemId:'graph-id',driveVerifiedHash:hash,driveVerifiedAt:'2026-10-28T12:00:00Z'};
  for(const override of [
    {driveItemId:''},
    {driveVerifiedHash:'c'.repeat(64)},
    {driveVerifiedAt:''},
    {hash:''},
    {driveSaved:false}
  ]){
    const meta=x.backupMeta({status:'POD vorhanden',podBackup:{...base,...override,lastError:'SENSITIVE-BACKEND-DETAIL'}});
    assert.equal(meta.key,'pending');
    assert.doesNotMatch(meta.label+' '+meta.title,/SENSITIVE-BACKEND-DETAIL/);
  }
  assert.equal(x.backupMeta({status:'POD vorhanden',podBackup:{...base,archiveSaved:false}}).key,'pending');
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
  assert.match(build,/podGraphReadiness:'RC1220/);
  assert.match(build,/avisAppointmentRevisionHistory:'RC1163/);
  assert.match(build,/border:3mm solid #111827/);
});
