import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');

test('RC1387: gültiges Azure-Archiv mit fehlender Drive-Kopie wird nicht als Archivfehler behandelt',()=>{
  assert.match(archive,/const driveBackfillRequired = m365Enabled\(\) && graphDrive\.readiness\(\)\.configured && backup\.driveSaved !== true/);
  assert.match(archive,/if \(integrity\.ok\) \{[\s\S]*?const driveBackfillRequired[\s\S]*?if \(!driveBackfillRequired\) \{[\s\S]*?continue;[\s\S]*?\n\s*\}[\s\S]*?\n\s*\}\n\s*if \(!integrity\.ok\) \{/);
  assert.match(archive,/if \(!integrity\.ok\) \{[\s\S]*?if \(!integrity\.repairable\)/);
});

test('RC1387: Drive-Backfill bleibt Kandidat für retryArchiveBackup',()=>{
  assert.match(archive,/candidates\.push\(\{/);
  assert.match(archive,/await retryArchiveBackup\(candidate\.accessKey, environment\)/);
});
