import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../assets/rc1059-document-blob.js',import.meta.url),'utf8');

test('RC1060: Migrationssteuerung erscheint nur im TESTSERVICE und migriert maximal fünf Dokumente',()=>{
  assert.match(source,/-testservice\\\./i);
  assert.match(source,/exporthub-document-migrate/);
  assert.match(source,/environment:'testservice'/);
  assert.match(source,/limit:5/);
  assert.match(source,/rc1060MigrationControl/);
  assert.match(source,/5 Dokumente migrieren/);
});

test('RC1060: Migrationssteuerung nutzt die aktive ExportHUB-Sitzung und stoppt bei Fehlern',()=>{
  assert.match(source,/rt\.authToken\|\|rt\.token\|\|rt\.sessionToken/);
  assert.match(source,/X-ExportHUB-Token/);
  assert.match(source,/Authorization:'Bearer '/);
  assert.match(source,/if\(data\.failed\)/);
  assert.match(source,/Migration abgeschlossen/);
});
