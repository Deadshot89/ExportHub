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


test('RC1251: echter Mailprobe-Aufruf ist OIDC-geschützt, production-only und fest auf Despatch begrenzt',()=>{
  assert.match(source,/action==='send-test'/);
  assert.match(source,/environment!=='production'/);
  assert.match(source,/graphMail\.sendTextMail\(/);
  assert.match(source,/\[TEST\] ExportHUB AVIS-Upload Benachrichtigung/);
  assert.match(source,/Kein Kundenupload und kein echtes Kundendokument/);
  assert.match(source,/to:recipient/);
});

test('RC1251: Live-Mailprobe läuft nur einmalig auf dem benannten RC1251 Push und vor den übrigen Production-Livechecks',()=>{
  const readiness=workflow.indexOf('RC1249 PRODUCTION AVIS-Mail-Konfiguration prüfen');
  const probe=workflow.indexOf('RC1251 PRODUCTION AVIS-Mail Liveversand einmalig prüfen');
  const qr=workflow.indexOf('RC1233 QR-Abholung und POD-Ladelisten-Viewer live prüfen');
  assert.ok(readiness>=0&&probe>readiness&&qr>probe);
  assert.match(workflow,/contains\(github\.event\.head_commit\.message, 'RC1251'\)/);
  assert.match(workflow,/contains\(github\.event\.head_commit\.message, 'AVIS-Mail Liveversand verifizieren'\)/);
  assert.match(workflow,/-d '\{"action":"send-test"\}'/);
  assert.match(workflow,/mailProbe\.ok!==true/);
  assert.match(workflow,/DespatchNettetal@essentra\.onmicrosoft\.com/);
});
