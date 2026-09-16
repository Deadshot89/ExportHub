import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const API='api/e2e-test-fixture/index.js';
const WF='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';

test('RC1141: E2E-Fixture hängt nicht von unzuverlässigen Azure-Proxy-Hostheadern ab',()=>{
  const source=fs.readFileSync(API,'utf8');
  assert.doesNotMatch(source,/function requestHost\(/,'öffentlicher Host darf nicht mehr Sicherheitsanker sein');
  assert.doesNotMatch(source,/TESTSERVICE_HOST/,'statischer Testservice-Host darf nicht mehr benötigt werden');
  assert.match(source,/headerEnvironment\s*!==\s*['"]testservice['"]/,'TESTSERVICE-Header muss Pflicht sein');
  assert.match(source,/payloadEnvironment\s*!==\s*['"]testservice['"]/,'TESTSERVICE-Payload muss Pflicht sein');
  assert.match(source,/TESTSERVICE_ONLY/,'fail-closed Testservice-Sperre muss erhalten bleiben');
});

test('RC1141: Fixture kann ausschließlich den TESTSERVICE-Teamblob öffnen',()=>{
  const source=fs.readFileSync(API,'utf8');
  assert.match(source,/const TEST_TEAM_BLOB=/,'dedizierter Testservice-Blob fehlt');
  assert.match(source,/getBlockBlobClient\(TEST_TEAM_BLOB\)/,'Fixture muss direkt den Testservice-Blob verwenden');
  assert.doesNotMatch(source,/getBlockBlobClient\(TEAM_BLOB\)/,'Fixture darf den Produktionsblob niemals direkt öffnen');
  assert.match(source,/testservice\//,'Fallback-Testservice-Präfix fehlt');
});

test('RC1141: OIDC bleibt zwingend und Workflow fordert explizit testservice an',()=>{
  const api=fs.readFileSync(API,'utf8');
  const workflow=fs.readFileSync(WF,'utf8');
  assert.match(api,/githubOidcAuthorized/,'GitHub-OIDC muss Pflicht bleiben');
  assert.match(api,/E2E_FIXTURE_FORBIDDEN/,'OIDC-Fehler muss fail-closed bleiben');
  const gate=workflow.slice(workflow.indexOf('- name: RC1124 TESTSERVICE Browser Gate'),workflow.indexOf('- name: Deploy ExportHUB production'));
  assert.match(gate,/x-exporthub-environment: testservice/,'Workflow muss Testservice-Umgebung mitsenden');
  assert.match(gate,/-d[^\n]*environment[^\n]*testservice/,'Payload muss Testservice-Umgebung binden');
});
