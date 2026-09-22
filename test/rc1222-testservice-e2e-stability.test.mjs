import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const fixture=fs.readFileSync('api/e2e-test-fixture/index.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1222: signierte TESTSERVICE-E2E-Sitzung überlebt den vollständigen Live-Gate',()=>{
  assert.match(fixture,/const E2E_SESSION_TTL_MS=45\*60\*1000/);
  assert.match(fixture,/expiresAt:new Date\(Date\.now\(\)\+E2E_SESSION_TTL_MS\)\.toISOString\(\)/);
  assert.doesNotMatch(fixture,/Date\.now\(\)\+15\*60\*1000/);
});

test('RC1222: nur explizit markierte E2E-Daten gelten als verwaiste Testdaten',()=>{
  assert.match(fixture,/function e2eMarked\(item\)/);
  assert.match(fixture,/\^E2E-\[A-Za-z0-9\._-\]\{3,100\}\$/);
  assert.match(fixture,/text\(item\._e2eRunId\)/);
});

test('RC1222: Prepare bereinigt alte E2E-State-Datensätze vor dem neuen Lauf',()=>{
  const purge=fixture.indexOf('const staleState=removeStaleE2ERecords(team.state)');
  const add=fixture.indexOf('team.state.customers.push(customer)',purge);
  assert.ok(purge>=0&&add>purge,'E2E-Altlasten müssen vor dem neuen Fixture entfernt werden');
  assert.match(fixture,/purgedStaleRecords:staleState\.removed/);
  assert.match(fixture,/purgedStaleRecords:mutation\.result\.purgedStaleRecords/);
});

test('RC1222: Prepare entfernt auch verwaiste E2E-Benutzer, aber keine normalen Benutzer pauschal',()=>{
  assert.match(fixture,/team\.users=team\.users\.filter\(u=>!e2eMarked\(u\)\)/);
  assert.match(fixture,/purgedStaleUsers=beforeUsers-team\.users\.length/);
  assert.doesNotMatch(fixture,/team\.users\s*=\s*\[\]/);
});

test('RC1222: Cleanup des aktuellen Runs bleibt zusätzlich erhalten',()=>{
  assert.match(fixture,/function removeRunRecords\(state,runId\)/);
  assert.match(fixture,/text\(item\._e2eRunId\)===runId/);
  assert.match(fixture,/const cleaned=removeRunRecords\(team\.state,runId\)/);
});

test('RC1222: Release manifestiert die Gate-Stabilisierung',()=>{
  assert.match(build,/testserviceE2EStability:'RC1222 45m signed fixture session \+ stale E2E purge'/);
});

test('RC1222: Fixture bleibt syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','api/e2e-test-fixture/index.js'],{stdio:'pipe'});
});
