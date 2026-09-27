import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/rc1002-main-contract.yml','utf8');

test('RC1307: Main Contract läuft vor jedem Merge nach main',()=>{
  assert.match(workflow,/on:\s*\n\s*workflow_dispatch:\s*\n\s*pull_request:\s*\n\s*branches:\s*\[main\]/);
  assert.match(workflow,/pull_request:[\s\S]*?branches:\s*\[main\][\s\S]*?push:/);
});

test('RC1307: Main Contract bleibt zusätzlich auf main-push aktiv',()=>{
  assert.match(workflow,/push:\s*\n\s*branches:\s*\[main\]/);
});

test('RC1307: Pre-Merge-Gate hat nur Lesezugriff auf Repository-Inhalte',()=>{
  assert.match(workflow,/permissions:\s*\n\s*contents:\s*read/);
});
