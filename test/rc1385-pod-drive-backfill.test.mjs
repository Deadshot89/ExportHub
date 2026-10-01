import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');

test('RC1386: vollständig konfiguriertes Microsoft-Ziel ist automatisch aktiv',()=>{
  assert.match(archive,/function m365Enabled\(\) \{[\s\S]*?return graphDrive\.readiness\(\)\.configured;[\s\S]*?\}/);
  assert.doesNotMatch(archive,/process\.env\.EXPORTHUB_POD_M365_ENABLED/);
});

test('RC1385: bereits archivierte PODs ohne Drive-Kopie werden erneut in die Nachholqueue aufgenommen',()=>{
  assert.match(archive,/const driveBackfillRequired = m365Enabled\(\) && graphDrive\.readiness\(\)\.configured && backup\.driveSaved !== true/);
  assert.match(archive,/if \(!driveBackfillRequired\) \{[\s\S]*?continue;[\s\S]*?\}/);
  assert.match(archive,/await retryArchiveBackup\(candidate\.accessKey, environment\)/);
});
