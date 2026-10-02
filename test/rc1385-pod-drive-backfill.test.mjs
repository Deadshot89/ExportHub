import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');

test('RC1386: vollständig konfiguriertes Microsoft-Ziel ist automatisch aktiv',()=>{
  assert.match(archive,/function m365Enabled\(\) \{[\s\S]*?return graphDrive\.readiness\(\)\.configured;[\s\S]*?\}/);
  assert.doesNotMatch(archive,/process\.env\.EXPORTHUB_POD_M365_ENABLED/);
});

test('RC1395: bereits archivierte PODs ohne Drive-Kopie bleiben in der optionalen Nachholqueue',()=>{
  assert.match(archive,/const driveBackfillRequired = m365Enabled\(\) && graphDrive\.readiness\(\)\.configured && backup\.driveSaved !== true/);
  assert.match(archive,/if \(!driveBackfillRequired\) continue;/);
  assert.match(archive,/driveOnly = true;/);
  assert.match(archive,/driveBackfillEligible/);
  assert.match(archive,/await retryArchiveBackup\(candidate\.accessKey, environment\)/);
});
