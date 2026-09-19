import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function pos(name){
  const i=workflow.indexOf('- name: '+name);
  assert.ok(i>=0,name+' fehlt');
  return i;
}

test('RC1172: TESTSERVICE-Browser- und Mutationstests laufen vor Kundenportal-Readiness',()=>{
  const deploy=pos('Deploy ExportHUB TESTSERVICE');
  const activate=pos('Release-Center aktive Testversion auf deployten Stand setzen');
  const browser=pos('RC1124 TESTSERVICE Browser Gate');
  const readiness=pos('RC1170 TESTSERVICE Kundenportal-Verschlüsselung prüfen');
  const production=pos('Deploy ExportHUB production');
  assert.ok(deploy<activate);
  assert.ok(activate<browser);
  assert.ok(browser<readiness);
  assert.ok(readiness<production);
});

test('RC1172: RC1171 Sendung-erstellen-UI-Test bleibt im Browser-Gate',()=>{
  const browser=pos('RC1124 TESTSERVICE Browser Gate');
  const readiness=pos('RC1170 TESTSERVICE Kundenportal-Verschlüsselung prüfen');
  const gate=workflow.slice(browser,readiness);
  assert.match(gate,/e2e\/specs\/shipment-create\.spec\.mjs/);
  assert.match(gate,/EXPORTHUB_E2E_MUTATION='1'/);
  assert.match(gate,/fixture prepare/);
  assert.match(gate,/fixture cleanup/);
});

test('RC1172: fehlende Kundenportal-Verschlüsselung blockiert weiterhin Produktion',()=>{
  const readiness=pos('RC1170 TESTSERVICE Kundenportal-Verschlüsselung prüfen');
  const production=pos('Deploy ExportHUB production');
  const block=workflow.slice(readiness,production);
  assert.match(block,/v\.configured!==true/);
  assert.match(block,/process\.exit\(3\)/);
  assert.match(block,/x-exporthub-environment: testservice/);
});

test('RC1172: Produktions-Readiness bleibt nach Produktionsdeploy erhalten',()=>{
  const production=pos('Deploy ExportHUB production');
  const prodReadiness=pos('RC1170 PRODUCTION Kundenportal-Verschlüsselung prüfen');
  assert.ok(production<prodReadiness);
  const block=workflow.slice(prodReadiness);
  assert.match(block,/v\.configured!==true/);
  assert.match(block,/x-exporthub-environment: production/);
});

test('RC1172: Manifest dokumentiert die Gate-Reihenfolge',()=>{
  assert.match(build,/testserviceGateOrder:'RC1172 browser\/mutation gate before external readiness blocker, production still protected'/);
});
