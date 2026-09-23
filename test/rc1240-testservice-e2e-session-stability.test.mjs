import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync('api/e2e-test-fixture/index.js','utf8');

test('RC1240: signierte TESTSERVICE-E2E-Sitzung gilt 45 Minuten',()=>{
  assert.match(source,/const E2E_SESSION_TTL_MS=45\*60\*1000/);
  assert.match(source,/expiresAt:new Date\(Date\.now\(\)\+E2E_SESSION_TTL_MS\)\.toISOString\(\)/);
  assert.doesNotMatch(source,/Date\.now\(\)\+15\*60\*1000/);
});

test('RC1240: Prepare entfernt ausschließlich gültig E2E-markierte Alt-Testdaten',()=>{
  assert.match(source,/function e2eMarked\(item\)/);
  assert.match(source,/\^E2E-\[A-Za-z0-9\._-\]\{3,100\}\$/);
  assert.match(source,/function removeStaleE2ERecords\(state\)/);
  assert.match(source,/team\.users=team\.users\.filter\(u=>!e2eMarked\(u\)\)/);
  assert.match(source,/purgedStaleRecords:staleState\.removed/);
  assert.match(source,/purgedStaleUsers/);
});

test('RC1240: normale TESTSERVICE-Daten werden nicht pauschal gelöscht',()=>{
  const start=source.indexOf('function removeStaleE2ERecords');
  const end=source.indexOf('function removeRunRecords',start);
  assert.ok(start>=0&&end>start);
  const block=source.slice(start,end);
  assert.match(block,/e2eMarked\(item\)/);
  assert.doesNotMatch(block,/return false/);
  assert.doesNotMatch(block,/customers|shipments|tasks/);
});

test('RC1240: Fixture bleibt syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','api/e2e-test-fixture/index.js'],{stdio:'pipe'});
});
