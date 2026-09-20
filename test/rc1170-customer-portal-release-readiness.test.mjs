import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const api=fs.readFileSync('api/customer-portal-readiness/index.js','utf8');
const fn=JSON.parse(fs.readFileSync('api/customer-portal-readiness/function.json','utf8'));
const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1170: Readiness-Probe ist ausschließlich GitHub-OIDC Main-Releaseworkflow',()=>{
  assert.match(api,/OIDC_AUDIENCE='exporthub-customer-portal-readiness'/);
  assert.match(api,/WORKFLOW='azure-static-web-apps-wonderful-forest-0f315e310\.yml'/);
  assert.match(api,/claims\.repository!==REPO/);
  assert.match(api,/claims\.ref!=='refs\/heads\/main'/);
  assert.match(api,/claims\.workflow_ref!==REPO\+'\/\.github\/workflows\/'\+WORKFLOW\+'@refs\/heads\/main'/);
  assert.match(api,/WORKFLOW_REQUIRED/);
  assert.match(api,/crypto\.verify\('RSA-SHA256'/);
});

test('RC1170: Probe liefert nur Readiness-Bool und niemals Schlüsselmaterial',()=>{
  assert.match(api,/keyStatus=typeof store\.keyStatus/);
  assert.match(api,/code:keyStatus\.code/);
  assert.match(api,/configured:false/);
  assert.match(api,/configured:true/);
  assert.doesNotMatch(api,/EXPORTHUB_CUSTOMER_PORTAL_KEY/);
  assert.doesNotMatch(api,/process\.env/);
  assert.doesNotMatch(api,/secret/i);
  assert.doesNotMatch(api,/keyConfigured\(\).*key\s*:/s);
});

test('RC1170: Host und angeforderte Umgebung müssen übereinstimmen',()=>{
  assert.match(api,/ENVIRONMENT_MISMATCH/);
  assert.match(api,/hostTest&&requested!=='testservice'/);
  assert.match(api,/hostProd&&requested!=='production'/);
});

test('RC1170: Azure Function erlaubt nur POST und OPTIONS',()=>{
  const trigger=fn.bindings.find(x=>x.type==='httpTrigger');
  assert.deepEqual(trigger.methods,['post','options']);
  assert.equal(trigger.route,'customer-portal-readiness');
});

test('RC1170: TESTSERVICE Readiness blockiert Produktionsdeploy bei fehlender Verschlüsselung',()=>{
  const testDeploy=workflow.indexOf('- name: Deploy ExportHUB TESTSERVICE');
  const testReady=workflow.indexOf('- name: RC1170 TESTSERVICE Kundenportal-Verschlüsselung prüfen');
  const prodDeploy=workflow.indexOf('- name: Deploy ExportHUB production');
  assert.ok(testDeploy>=0&&testReady>testDeploy&&prodDeploy>testReady);
  const block=workflow.slice(testReady,prodDeploy);
  assert.match(block,/audience=exporthub-customer-portal-readiness/);
  assert.match(block,/customer-portal-readiness/);
  assert.match(block,/v\.configured!==true/);
  assert.match(block,/v\.environment!=='testservice'/);
  assert.match(block,/::add-mask::\$oidc_token/);
});

test('RC1170: Produktion wird nach Deploy separat live bestätigt',()=>{
  const prodDeploy=workflow.indexOf('- name: Deploy ExportHUB production');
  const prodReady=workflow.indexOf('- name: RC1170 PRODUCTION Kundenportal-Verschlüsselung prüfen');
  assert.ok(prodDeploy>=0&&prodReady>prodDeploy);
  const block=workflow.slice(prodReady,workflow.indexOf('- name: Live RC1122 HTML-Integrität prüfen'));
  assert.match(block,/x-exporthub-environment: production/);
  assert.match(block,/v\.configured!==true/);
  assert.match(block,/v\.environment!=='production'/);
});

test('RC1170: Workflow-Log enthält nur sichere Readiness-Felder',()=>{
  const blocks=workflow.match(/RC1170 (?:TESTSERVICE|PRODUCTION) customer portal readiness[^\n]*/g)||[];
  assert.ok(blocks.length>=2);
  assert.doesNotMatch(workflow,/customer portal readiness[^\n]*(?:secret|keyValue|keyName)/i);
  assert.match(workflow,/httpStatus:status,ok:v\.ok===true,configured:v\.configured===true,environment:v\.environment,code:v\.code,version:v\.version/);
});

test('RC1170: finaler Build enthält Readiness-API und Manifestmarker',()=>{
  assert.match(build,/customer-portal-readiness\/index\.js/);
  assert.match(build,/customer-portal-readiness\/function\.json/);
  assert.match(build,/customerPortalReleaseReadiness:'RC1170 OIDC live configured=true gate in TESTSERVICE and PRODUCTION'/);
});

test('RC1170: neue API ist syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','api/customer-portal-readiness/index.js'],{stdio:'pipe'});
});
