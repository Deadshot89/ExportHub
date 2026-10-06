import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const store=read('api/shared/pickup-store.js');
const archive=read('api/shared/pod-archive.js');
const workflow=read('.github/workflows/rc1144-pod-backup-reconcile.yml');
const pickup=read('pickup.html');
const build=read('.github/rc1112/build-three-env.mjs');

test('RC1455: Fahrer- und Zollunterschrift werden zusätzlich unveränderlich im Azure-POD-Archiv gesichert',()=>{
  assert.match(store,/async function archiveImmutableSignature\(/,'Unterschrift-Archivhelfer fehlt');
  assert.match(store,/podArchiveClient\(c\.environment\)/,'Unterschrift nutzt nicht den getrennten Archivcontainer');
  assert.match(store,/conditions:\{ifNoneMatch:'\*'\}/,'Archivkopie ist nicht unveränderlich angelegt');
  assert.match(store,/SIGNATURE_ARCHIVE_INTEGRITY_FAILED/,'Byte-/Hash-Verifikation der Archivkopie fehlt');
  assert.match(store,/await archiveImmutableSignature\(c,record,blobName,parsed,'driver-signature'\)/,'Fahrerunterschrift wird nicht archiviert');
  assert.match(store,/await archiveImmutableSignature\(c,record,blobName,parsed,'customs-documents-receipt-signature'\)/,'Zollunterschrift wird nicht archiviert');
});

test('RC1455: POD gilt erst mit SharePoint-Kopie als vollständig gesichert',()=>{
  assert.match(archive,/status: 'pending-sharepoint'/,'Fehlende SharePoint-Kopie wird nicht als offen markiert');
  assert.match(archive,/const sharePointRequired = backup\.driveSaved !== true/,'SharePoint-Nachsicherung bleibt optional');
  assert.match(archive,/pending\.length \+ drivePending\.length/,'Gezielter Nachweis ignoriert offene SharePoint-Kopien');
  assert.match(archive,/eligible: requiredEligible \+ driveBackfillEligible \+ teamRelinkCandidates\.length/,'SharePoint-Rückstand zählt nicht als verpflichtende Reconcile-Arbeit');
  assert.match(workflow,/const requiredDone=eligible===0&&selected===0&&skipped===0&&!v\.nextContinuationToken&&!v\.requiredWorkDeferred/,'Workflow darf verpflichtenden SharePoint-Rückstand nicht als fertig akzeptieren');
  assert.match(pickup,/data\.podDriveSaved/,'Abholseite zeigt SharePoint-Sicherungsstatus nicht an');
  assert.match(build,/SharePoint required/,'Releasevertrag dokumentiert SharePoint nicht als Pflichtsicherung');
});
