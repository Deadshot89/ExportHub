import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1002 historische Drei-Umgebungen-Baseline bleibt nachvollziehbar',()=>{
  assert.equal(fs.existsSync('.github/rc1002/build-three-env.mjs'),true);
  const src=read('.github/rc1002/build-three-env.mjs');
  assert.match(src,/const VERSION='RC1002'/);
  assert.match(src,/production-candidate/);
  assert.match(src,/testservice/);
  assert.match(src,/demo/);
});

test('veraltete Einzel-Release-Workflows bleiben entfernt',()=>{
  const obsolete=[
    '.github/workflows/rc997-website-final.yml',
    '.github/workflows/rc1000-production-qr-fix.yml',
    '.github/workflows/rc1001-task-tiles-cleanup.yml',
    '.github/workflows/rc1002-release-sync.yml',
    '.github/workflows/rc1002-task-groups.yml',
    '.github/workflows/rc1002-testservice-live.yml'
  ];
  for(const file of obsolete) assert.equal(fs.existsSync(file),false,`veralteter Workflow ist wieder vorhanden: ${file}`);
  assert.equal(fs.existsSync('.github/rc997/rc997-workflow-contract.test.mjs'),false,'veralteter RC997 Workflow-Vertrag ist wieder vorhanden');
});
