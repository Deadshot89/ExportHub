import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const source=fs.readFileSync('api/avis-upload-mail-readiness/index.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1249: AVIS-Mail-Readiness ist ausschließlich für signierten Release-Workflow vorgesehen',()=>{
  assert.match(source,/OIDC_AUDIENCE='exporthub-avis-upload-mail-readiness'/);
  assert.match(source,/claims\.repository!==REPO/);
  assert.match(source,/claims\.ref!=='refs\/heads\/main'/);
  assert.match(source,/claims\.workflow_ref!==REPO\+'\/\.github\/workflows\/'\+WORKFLOW\+'@refs\/heads\/main'/);
  assert.match(source,/WORKFLOW_REQUIRED/);
  assert.doesNotMatch(source,/clientSecret/,'Readiness-Endpunkt darf Graph-Secrets nicht selbst ausgeben oder verarbeiten');
});

test('RC1249: AVIS-Mail-Readiness prüft Graph-Konfiguration und Despatch-Empfänger ohne Testmail',()=>{
  assert.match(source,/graphMail\.readiness\(\)/);
  assert.match(source,/EXPORTHUB_AVIS_UPLOAD_NOTIFICATION_TO/);
  assert.match(source,/DespatchNettetal@essentra\.onmicrosoft\.com/);
  assert.match(source,/GRAPH_MAIL_NOT_CONFIGURED/);
  assert.match(source,/MAIL_RECIPIENT_INVALID/);
  assert.doesNotMatch(source,/sendTextMail/,'Readiness darf keine Testmail senden');
});

test('RC1270: Readiness fordert einen echten Graph-Token an ohne Testmail oder Secret-Ausgabe',()=>{
  assert.match(source,/graphMail\.verifyAuthentication\(\)/);
  assert.match(source,/authenticated:false/);
  assert.match(source,/upstreamStatus/);
  assert.doesNotMatch(source,/access_token|clientSecret/,'Readiness darf weder Graph-Token noch Client-Secret ausgeben');
  assert.doesNotMatch(source,/sendTextMail/,'Auth-Probe darf keine Testmail senden');
  assert.match(workflow,/v\.authenticated===true/);
  assert.match(workflow,/v\.audienceOk===true/);
  assert.match(workflow,/console\.error\('RC1249 '\+env\+' readiness unerwartet'/);
});

test('RC1271/RC1279: Mail.Send bleibt geprüft und der bekannte Permission-Blocker sichtbar',()=>{
  assert.match(source,/mailSendGranted/);
  assert.match(source,/GRAPH_MAIL_PERMISSION_MISSING/);
  assert.match(workflow,/v\.mailSendGranted===true/);
  assert.match(workflow,/v\.mailSendGranted===false/);
  assert.match(workflow,/knownMailSendBlocker/);
  assert.match(workflow,/GRAPH_MAIL_PERMISSION_MISSING/);
  assert.match(workflow,/::warning title=RC1290 AVIS-Mail P2::/);
});

test('RC1249: finaler Build verlangt den Readiness-Endpunkt',()=>{
  assert.match(build,/avis-upload-mail-readiness\/index\.js/);
  assert.match(build,/avis-upload-mail-readiness\/function\.json/);
});

test('RC1249: anonymer Readiness-Aufruf wird abgewiesen',async()=>{
  const handler=require('../api/avis-upload-mail-readiness/index.js');
  const context={res:null};
  await handler(context,{method:'POST',headers:{host:'wonderful-forest-0f315e310.7.azurestaticapps.net','x-exporthub-environment':'production'}});
  assert.equal(context.res.status,403);
  const body=JSON.parse(context.res.body);
  assert.equal(body.ok,false);
  assert.equal(body.code,'WORKFLOW_REQUIRED');
});


test('RC1249: Release prüft TESTSERVICE und PRODUCTION Mail-Readiness in sicherer Reihenfolge',()=>{
  const testReady=workflow.indexOf('RC1249 TESTSERVICE AVIS-Mail-Konfiguration prüfen');
  const prodDeploy=workflow.indexOf('Deploy ExportHUB production');
  const prodReady=workflow.indexOf('RC1249 PRODUCTION AVIS-Mail-Konfiguration prüfen');
  const liveQr=workflow.indexOf('RC1233 QR-Abholung und POD-Ladelisten-Viewer live prüfen');
  assert.ok(testReady>=0&&prodDeploy>testReady,'TESTSERVICE Mail-Readiness muss Produktion blockieren können');
  assert.ok(prodReady>prodDeploy&&liveQr>prodReady,'PRODUCTION Mail-Readiness muss direkt nach Deployment verifiziert werden');
  assert.match(workflow,/audience=exporthub-avis-upload-mail-readiness/);
  assert.match(workflow,/DespatchNettetal@essentra\.onmicrosoft\.com/);
});
