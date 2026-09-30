import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const api=fs.readFileSync('api/avis-upload-mail-readiness/index.js','utf8');
const workflow=fs.readFileSync('.github/workflows/avis-mail-verify.yml','utf8');

test('RC1352: manueller AVIS-Mail-Verify ist ausschließlich workflow_dispatch mit OIDC',()=>{
  assert.match(workflow,/^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow,/^  push:/m);
  assert.match(workflow,/id-token:\s*write/);
  assert.match(api,/VERIFY_WORKFLOW='avis-mail-verify\.yml'/);
  assert.match(api,/workflowRef===verifyRef&&text\(claims\.event_name\)!=='workflow_dispatch'/);
  assert.match(api,/claims\.ref!=='refs\/heads\/main'/);
});

test('RC1352: Readiness prüft TESTSERVICE und PRODUCTION ohne Deployment',()=>{
  assert.match(workflow,/TESTSERVICE Mail\.Send verifizieren/);
  assert.match(workflow,/PRODUCTION Mail\.Send verifizieren/);
  assert.match(workflow,/ashy-grass-065b7b803-testservice\.westeurope\.6\.azurestaticapps\.net/);
  assert.match(workflow,/wonderful-forest-0f315e310\.7\.azurestaticapps\.net/);
  assert.match(workflow,/mailSendGranted===true/);
  assert.match(workflow,/audience=exporthub-avis-upload-mail-readiness/);
  assert.doesNotMatch(workflow,/static-web-apps-deploy|action:\s*upload/);
});

test('RC1352: echter Sendetest ist optional, production-only und fest auf internen Empfänger begrenzt',()=>{
  assert.match(workflow,/send_test:/);
  assert.match(workflow,/if: \$\{\{ inputs\.send_test == true \}\}/);
  assert.match(workflow,/-d '\{"action":"send-test"\}'/);
  assert.match(workflow,/DespatchNettetal@essentra\.onmicrosoft\.com/);
  assert.match(api,/if\(action==='send-test'\)/);
  assert.match(api,/if\(environment!=='production'\)throw error\('PRODUCTION_ONLY'/);
  assert.match(api,/to:DEFAULT_RECIPIENT/);
  assert.match(api,/\[TEST\] ExportHUB AVIS-Mail – RC1352/);
  assert.match(api,/Keine Kundendaten und keine Kundendokumente/);
});

test('RC1352: Workflow und Readiness geben keine Graph-Secrets aus',()=>{
  assert.doesNotMatch(workflow,/EXPORTHUB_GRAPH_CLIENT_SECRET|client_secret|access_token/);
  const responseBlock=api.slice(api.indexOf("if(action==='send-test')"),api.indexOf("}catch(e)"));
  assert.doesNotMatch(responseBlock,/clientSecret\s*:|access_token/);
  assert.match(responseBlock,/mailProbe:\{ok:/);
});

test('RC1352: Readiness-Runtime bleibt syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','api/avis-upload-mail-readiness/index.js'],{stdio:'pipe'});
});
