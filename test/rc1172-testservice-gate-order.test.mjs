import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainWorkflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
const productionWorkflow=fs.readFileSync('.github/workflows/exporthub-production-release.yml','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function pos(text,name){
  const i=text.indexOf('- name: '+name);
  assert.ok(i>=0,name+' fehlt');
  return i;
}

test('RC1505/RC1172: TESTSERVICE-Browser- und Mutationstests laufen vor Kundenportal-Readiness',()=>{
  const deploy=pos(mainWorkflow,'Deploy ExportHUB TESTSERVICE');
  const browser=pos(mainWorkflow,'RC1124 TESTSERVICE Browser Gate');
  const readiness=pos(mainWorkflow,'RC1170 TESTSERVICE Kundenportal-Verschlüsselung prüfen');
  assert.ok(deploy<browser);
  assert.ok(browser<readiness);
  assert.doesNotMatch(mainWorkflow,/Deploy ExportHUB production/);
});

test('RC1172: RC1171 Sendung-erstellen-UI-Test bleibt im Browser-Gate',()=>{
  const browser=pos(mainWorkflow,'RC1124 TESTSERVICE Browser Gate');
  const readiness=pos(mainWorkflow,'RC1170 TESTSERVICE Kundenportal-Verschlüsselung prüfen');
  const gate=mainWorkflow.slice(browser,readiness);
  assert.match(gate,/e2e\/specs\/shipment-create\.spec\.mjs/);
  assert.match(gate,/EXPORTHUB_E2E_MUTATION='1'/);
  assert.match(gate,/fixture prepare/);
  assert.match(gate,/fixture cleanup/);
});

test('RC1505/RC1172: fehlende TESTSERVICE-Kundenportal-Verschlüsselung verhindert einen erfolgreichen Main-Verification-Lauf',()=>{
  const readiness=pos(mainWorkflow,'RC1170 TESTSERVICE Kundenportal-Verschlüsselung prüfen');
  const block=mainWorkflow.slice(readiness);
  assert.match(block,/v\.configured!==true/);
  assert.match(block,/process\.exit\(3\)/);
  assert.match(block,/x-exporthub-environment: testservice/);
  const verify=pos(productionWorkflow,'RC1505 Erfolgreiche Main Verification für Release-SHA verlangen');
  const production=pos(productionWorkflow,'Deploy ExportHUB production');
  assert.ok(verify<production,'Production muss einen erfolgreichen Main-Verification-Lauf voraussetzen');
});

test('RC1505/RC1172: Produktions-Readiness bleibt nach Produktionsdeploy erhalten',()=>{
  const production=pos(productionWorkflow,'Deploy ExportHUB production');
  const prodReadiness=pos(productionWorkflow,'RC1170 PRODUCTION Kundenportal-Verschlüsselung prüfen');
  assert.ok(production<prodReadiness);
  const block=productionWorkflow.slice(prodReadiness);
  assert.match(block,/v\.configured!==true/);
  assert.match(block,/x-exporthub-environment: production/);
});

test('RC1172: Manifest dokumentiert die Gate-Reihenfolge',()=>{
  assert.match(build,/testserviceGateOrder:'RC1172 browser\/mutation gate before external readiness blocker, production still protected'/);
});
