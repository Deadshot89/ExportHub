import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflowPath='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const workflow=fs.readFileSync(workflowPath,'utf8');

test('RC1537: Main Verification serialisiert die mutable TESTSERVICE-Umgebung pro Branch',()=>{
  const block=workflow.match(/concurrency:\s*\n([\s\S]*?)\n\s*jobs:/);
  assert.ok(block,'Concurrency-Block der Main Verification fehlt');
  const text=block[1];
  assert.match(text,/group:\s*exporthub-rc1112-three-env-\$\{\{\s*github\.ref\s*\}\}/,'TESTSERVICE-Main-Verification muss pro Ref/Branch serialisiert werden');
  assert.doesNotMatch(text,/github\.sha/,'SHA-spezifische Concurrency erlaubt parallele Main-Versionen gegen dieselbe TESTSERVICE-Umgebung');
  assert.match(text,/cancel-in-progress:\s*true/,'ein neuer Main-Stand muss den älteren TESTSERVICE-Lauf abbrechen dürfen');
});