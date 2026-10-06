import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');

test('RC1455: gültiges Azure-Archiv mit fehlender SharePoint-Kopie bleibt in der verpflichtenden Nachholqueue',()=>{
  assert.match(archive,/const sharePointRequired = backup\.driveSaved !== true/);
  assert.match(archive,/if \(!sharePointRequired\) continue;/);
  assert.match(archive,/driveOnly = true;/);
  assert.match(archive,/if \(!integrity\.ok\) \{[\s\S]*?if \(!integrity\.repairable\)/);
});

test('RC1455: SharePoint-Nachsicherung verdrängt keine erforderliche Azure-Nachsicherung',()=>{
  assert.match(archive,/candidates\.push\(\{[\s\S]*?driveOnly/);
  assert.match(archive,/Number\(!!a\.driveOnly\) - Number\(!!b\.driveOnly\)/);
  assert.match(archive,/const requiredEligible = requiredCandidates\.length/);
  assert.match(archive,/await retryArchiveBackup\(candidate\.accessKey, environment\)/);
});


test('RC1455: fehlgeschlagene SharePoint-Kopie bleibt offen und blockiert den vollständigen POD-Sicherungsstatus',()=>{
  assert.match(archive,/const driveRequired = true/);
  assert.match(archive,/const driveWasSaved = backup\.driveSaved === true \|\| result && result\.driveSaved === true/);
  assert.match(archive,/status: 'pending-sharepoint'/);
  assert.match(archive,/drivePending\.push\(\{/);
  assert.match(archive,/drivePendingCount: drivePending\.length/);
  assert.match(archive,/const targetPendingCount = pending\.length \+ drivePending\.length/);
});


test('RC1410/RC1455: SharePoint-Nachholung nutzt das gemeinsame Remote-Budget',()=>{
  assert.match(archive,/const driveBackfillBudget = reference \? Math\.min\(limit, remainingRemoteBudget\) : Math\.min\(1, remainingRemoteBudget\)/);
  assert.match(archive,/const selectedDriveCandidates = driveBackfillCandidates\.slice\(0, driveBackfillBudget\)/);
  assert.match(archive,/const selectedCandidates = selectedRequiredCandidates\.concat\(selectedDriveCandidates\)/);
  assert.match(archive,/const requiredSelected = selectedRequiredCandidates\.length/);
  assert.match(archive,/const driveBackfillSelected = selectedDriveCandidates\.length/);
});


test('RC1410: ein gemeinsames Remote-Budget begrenzt teure POD-Arbeit pro Function-Aufruf',()=>{
  assert.match(archive,/const remoteWorkBudget = reference \? Math\.max\(2, limit\) : 2/);
  assert.match(archive,/let remainingRemoteBudget = Math\.max\(0, remoteWorkBudget - integrityChecks\)/);
  assert.match(archive,/const requiredBackupBudget = reference \? limit : remainingRemoteBudget/);
  assert.match(archive,/const relinkBudget = reference \? limit : Math\.min\(1, remainingRemoteBudget\)/);
  assert.match(archive,/pageWorkDeferred = true/);
  assert.match(archive,/nextContinuationToken = continuationToken;[\s\S]{0,100}scanComplete = false/);
});


test('RC1455: aufgeschobene SharePoint-Arbeit hält dieselbe Scan-Seite fest',()=>{
  assert.match(archive,/let requiredWorkDeferred = false/);
  assert.match(archive,/let optionalDriveWorkDeferred = false/);
  assert.match(archive,/optionalDriveWorkDeferred = true;[\s\S]*?requiredWorkDeferred = true;[\s\S]*?pageWorkDeferred = true/);
  assert.match(archive,/if \(!reference && requiredWorkDeferred\) \{[\s\S]*?nextContinuationToken = continuationToken;[\s\S]*?scanComplete = false/);
  assert.match(archive,/requiredWorkDeferred,[\s\S]*?optionalDriveWorkDeferred/);
});
