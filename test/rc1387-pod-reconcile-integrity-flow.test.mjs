import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');

test('RC1395: gültiges Azure-Archiv mit fehlender Drive-Kopie bleibt fachlich gesichert und wird nur als optionales Backfill markiert',()=>{
  assert.match(archive,/const driveBackfillRequired = m365Enabled\(\) && graphDrive\.readiness\(\)\.configured && backup\.driveSaved !== true/);
  assert.match(archive,/if \(!driveBackfillRequired\) continue;/);
  assert.match(archive,/driveOnly = true;/);
  assert.match(archive,/if \(!integrity\.ok\) \{[\s\S]*?if \(!integrity\.repairable\)/);
});

test('RC1395: Drive-Backfill bleibt Kandidat, verdrängt aber keine erforderliche Azure-Nachsicherung',()=>{
  assert.match(archive,/candidates\.push\(\{[\s\S]*?driveOnly/);
  assert.match(archive,/Number\(!!a\.driveOnly\) - Number\(!!b\.driveOnly\)/);
  assert.match(archive,/const requiredEligible = requiredCandidates\.length/);
  assert.match(archive,/await retryArchiveBackup\(candidate\.accessKey, environment\)/);
});


test('RC1395: fehlgeschlagene optionale Drive-Kopie bleibt sichtbar, blockiert aber den erforderlichen POD-Backupstatus nicht',()=>{
  assert.match(archive,/const driveRequired = m365Enabled\(\) && graphDrive\.readiness\(\)\.configured/);
  assert.match(archive,/const driveWasSaved = backup\.driveSaved === true \|\| result && result\.driveSaved === true/);
  assert.match(archive,/if \(backup\.archiveSaved === true\)/);
  assert.match(archive,/if \(!candidate\.driveOnly\) saved\.push/);
  assert.match(archive,/drivePending\.push\(\{/);
  assert.match(archive,/drivePendingCount: drivePending\.length/);
  assert.match(archive,/pending\.push\(\{ reference: candidate\.reference, error: text\(backup\.lastError/);
});


test('RC1408: optionales Drive-Backfill nutzt nur das verbleibende gemeinsame Remote-Budget',()=>{
  assert.match(archive,/const driveBackfillBudget = reference \? Math\.min\(limit, remainingRemoteBudget\) : Math\.min\(1, remainingRemoteBudget\)/);
  assert.match(archive,/const selectedDriveCandidates = driveBackfillCandidates\.slice\(0, driveBackfillBudget\)/);
  assert.match(archive,/const selectedCandidates = selectedRequiredCandidates\.concat\(selectedDriveCandidates\)/);
  assert.match(archive,/const requiredSelected = selectedRequiredCandidates\.length/);
  assert.match(archive,/const driveBackfillSelected = selectedDriveCandidates\.length/);
});


test('RC1408: ein gemeinsames Remote-Budget begrenzt teure POD-Arbeit pro Function-Aufruf',()=>{
  assert.match(archive,/const remoteWorkBudget = reference \? Math\.max\(2, limit\) : 2/);
  assert.match(archive,/let remainingRemoteBudget = Math\.max\(0, remoteWorkBudget - integrityChecks\)/);
  assert.match(archive,/const relinkBudget = reference \? limit : Math\.min\(1, remainingRemoteBudget\)/);
  assert.match(archive,/const requiredBackupBudget = reference \? limit : remainingRemoteBudget/);
  assert.match(archive,/pageWorkDeferred = true/);
  assert.match(archive,/nextContinuationToken = continuationToken;[\s\S]{0,100}scanComplete = false/);
});
