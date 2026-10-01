import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');

test('RC1385: vollständig konfiguriertes Microsoft-Ziel bleibt ohne explizites Disable aktiv',()=>{
  assert.match(archive,/const flag = text\(process\.env\.EXPORTHUB_POD_M365_ENABLED\)\.toLowerCase\(\)/);
  assert.match(archive,/if \(\/\^\(0\|false\|no\|off\)\$\/\.test\(flag\)\) return false/);
  assert.match(archive,/return graphDrive\.readiness\(\)\.configured/);
});

test('RC1385: bereits archivierte PODs ohne Drive-Kopie werden erneut in die Nachholqueue aufgenommen',()=>{
  assert.match(archive,/const driveBackfillRequired = m365Enabled\(\) && graphDrive\.readiness\(\)\.configured && backup\.driveSaved !== true/);
  assert.match(archive,/if \(!driveBackfillRequired\) \{[\s\S]*?continue;[\s\S]*?\}/);
  assert.match(archive,/await retryArchiveBackup\(candidate\.accessKey, environment\)/);
});
