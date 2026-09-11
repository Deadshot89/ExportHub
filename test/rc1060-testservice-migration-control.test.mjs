import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const blobSource=fs.readFileSync(new URL('../assets/rc1059-document-blob.js',import.meta.url),'utf8');
const adminSource=fs.readFileSync(new URL('../assets/rc1061-document-migration-admin.js',import.meta.url),'utf8');

test('RC1060 Bestandsschutz: temporäre TESTSERVICE-Steuerung ist nach RC1061 nicht mehr doppelt aktiv',()=>{
  assert.doesNotMatch(blobSource,/rc1060MigrationControl/);
  assert.doesNotMatch(blobSource,/ExportHUBDocumentMigration1060/);
  assert.match(adminSource,/exporthub-document-migrate/);
  assert.match(adminSource,/limit:5/);
});

test('RC1060 Bestandsschutz: RC1061 verwendet weiterhin die aktive ExportHUB-Sitzung für die geschützte Migration',()=>{
  assert.match(adminSource,/authToken/);
  assert.match(adminSource,/X-ExportHUB-Token/);
  assert.match(adminSource,/'Authorization':'Bearer '/);
  assert.match(adminSource,/environmentName\(\)/);
});
