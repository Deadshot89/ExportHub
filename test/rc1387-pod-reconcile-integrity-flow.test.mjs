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


test('RC1407: optionales Drive-Backfill ist pro Reconcile-Aufruf hart begrenzt',()=>{
  assert.match(archive,/const driveBackfillBudget = Math\.min\(2, Math\.max\(0, limit - selectedRequiredCandidates\.length\)\)/);
  assert.match(archive,/const selectedDriveCandidates = driveBackfillCandidates\.slice\(0, driveBackfillBudget\)/);
  assert.match(archive,/const selectedCandidates = selectedRequiredCandidates\.concat\(selectedDriveCandidates\)/);
  assert.match(archive,/const requiredSelected = selectedRequiredCandidates\.length/);
  assert.match(archive,/const driveBackfillSelected = selectedDriveCandidates\.length/);
});
