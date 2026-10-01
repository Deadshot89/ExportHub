import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const archive = fs.readFileSync('api/shared/pod-archive.js','utf8');

test('RC1390: Reconcile meldet Erfolg erst nach bestätigter Drive-Kopie', () => {
  assert.match(
    archive,
    /if \(backup\.archiveSaved === true && \(!driveRequired \|\| backup\.driveSaved === true\)\)/
  );
  assert.doesNotMatch(
    archive,
    /if \(backup\.archiveSaved === true\) \{\s*saved\.push/
  );
});

test('RC1390: Drive-Fehler bleibt als Pending mit echtem Fehlercode sichtbar', () => {
  assert.match(archive, /backup\.driveLastError/);
  assert.match(archive, /driveError\.code \? driveError\.code \+ ': ' : ''/);
  assert.match(archive, /POD_DRIVE_BACKUP_PENDING/);
  assert.match(archive, /pending\.push\(\{/);
});
