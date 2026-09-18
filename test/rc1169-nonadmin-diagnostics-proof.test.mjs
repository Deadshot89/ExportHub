import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const fixture=fs.readFileSync('api/e2e-test-fixture/index.js','utf8');
const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
const navigation=fs.readFileSync('e2e/specs/navigation.spec.mjs','utf8');
const stateApi=fs.readFileSync('api/exporthub-state/index.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1169: Fixture erzeugt separaten echten Nicht-Admin mit Benutzeransicht',()=>{
  assert.match(fixture,/function e2eNonAdminUser\(runId\)/);
  assert.match(fixture,/globalAdmin:false/);
  assert.match(fixture,/isGlobalAdmin:false/);
  assert.match(fixture,/permissions:\[\]/);
  assert.match(fixture,/['"]rights['"]/);
  assert.match(fixture,/level:view\?'view':'none'|level:view\?'view'/);
  assert.match(fixture,/nonAdminToken/);
  assert.match(fixture,/nonAdminUser:publicUser/);
});

test('RC1169: Nicht-Admin-Session bleibt TESTSERVICE-isoliert und kurzlebig',()=>{
  assert.match(fixture,/signedSessionFor\(nonAdminUser,runId,'NONADMIN'\)/);
  assert.match(fixture,/environment:'testservice'/);
  assert.match(fixture,/15\*60\*1000/);
  assert.match(fixture,/_e2eRunId:runId/);
});

test('RC1169: Release-Gate übergibt Nicht-Admin-Session maskiert an Playwright',()=>{
  assert.match(workflow,/EXPORTHUB_E2E_NONADMIN_SESSION_TOKEN/);
  assert.match(workflow,/EXPORTHUB_E2E_NONADMIN_USER_B64/);
  assert.match(workflow,/::add-mask::\$nonadmin_session_token/);
});

test('RC1169: Live-Browser prüft UI-Isolation und echten 403-Serverpfad',()=>{
  assert.match(navigation,/RC1169 P0: Nicht-Admin sieht in Benutzer keine Diagnose und erhält serverseitig 403/);
  assert.match(navigation,/EXPORTHUB_E2E_NONADMIN_SESSION_TOKEN/);
  assert.match(navigation,/\[data-view="diagnostics"\]:visible/);
  assert.match(navigation,/mode=diagnostics-read/);
  assert.match(navigation,/expect\(denied\.status\)\.toBe\(403\)/);
  assert.match(navigation,/ADMIN_REQUIRED/);
});

test('RC1169: Server schützt Diagnose weiterhin ausschließlich per Global-Admin-Prüfung',()=>{
  const start=stateApi.indexOf("if(mode==='diagnostics-read')");
  assert.ok(start>=0,'diagnostics-read fehlt');
  const block=stateApi.slice(start,start+700);
  assert.match(block,/if\(!isAdmin\(current\.user\)\)throw error\('ADMIN_REQUIRED'/);
  assert.match(block,/403/);
});

test('RC1169: geänderte E2E-Dateien sind syntaktisch gültig und Release manifestiert den Nachweis',()=>{
  execFileSync(process.execPath,['--check','api/e2e-test-fixture/index.js'],{stdio:'pipe'});
  execFileSync(process.execPath,['--check','e2e/specs/navigation.spec.mjs'],{stdio:'pipe'});
  assert.match(build,/diagnosticsNonAdminProof:'RC1169/);
});
