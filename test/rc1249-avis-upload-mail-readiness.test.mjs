import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const source=fs.readFileSync('api/avis-upload-mail-readiness/index.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1249/RC1352: AVIS-Mail-Readiness akzeptiert nur signierten Release- oder manuellen Verify-Workflow auf main',()=>{
  assert.match(source,/OIDC_AUDIENCE='exporthub-avis-upload-mail-readiness'/);
  assert.match(source,/claims\.repository!==REPO/);
  assert.match(source,/claims\.ref!=='refs\/heads\/main'/);
  assert.match(source,/RELEASE_WORKFLOW='azure-static-web-apps-wonderful-forest-0f315e310\.yml'/);
  assert.match(source,/VERIFY_WORKFLOW='avis-mail-verify\.yml'/);
  assert.match(source,/workflowRef!==releaseRef&&workflowRef!==verifyRef/);
  assert.match(source,/workflowRef===verifyRef&&text\(claims\.event_name\)!=='workflow_dispatch'/);
  assert.match(source,/WORKFLOW_REQUIRED/);
  assert.doesNotMatch(source,/clientSecret/,'Readiness-Endpunkt darf Graph-Secrets nicht selbst ausgeben oder verarbeiten');
});

test('RC1249/RC1352: normale Readiness bleibt versandfrei; Testmail ist explizit, production-only und intern',()=>{
  assert.match(source,/graphMail\.readiness\(\)/);
  assert.match(source,/EXPORTHUB_AVIS_UPLOAD_NOTIFICATION_TO/);
  assert.match(source,/DespatchNettetal@essentra\.onmicrosoft\.com/);
  assert.match(source,/GRAPH_MAIL_NOT_CONFIGURED/);
  assert.match(source,/MAIL_RECIPIENT_INVALID/);
  const action=source.indexOf("if(action==='send-test')");
  const send=source.indexOf('graphMail.sendTextMail(',action);
  const normal=source.indexOf("context.res=json(200,{ok:true,configured:true,authenticated:true,audienceOk:true,mailSendGranted:true,environment,recipient,version:'RC1352'})",action);
  assert.ok(action>=0&&send>action&&normal>send,'Mailversand darf nur im expliziten send-test Zweig liegen');
  assert.match(source,/environment!=='production'/);
  assert.match(source,/to:DEFAULT_RECIPIENT/);
  assert.match(source,/\[TEST\] ExportHUB AVIS-Mail – RC1352/);
  assert.match(source,/Keine Kundendaten und keine Kundendokumente/);
});

test('RC1270/RC1352: Readiness fordert einen echten Graph-Token an ohne Token- oder Secret-Ausgabe',()=>{
  assert.match(source,/graphMail\.verifyAuthentication\(\)/);
  assert.match(source,/authenticated:false/);
  assert.match(source,/upstreamStatus/);
  assert.doesNotMatch(source,/access_token|clientSecret/,'Readiness darf weder Graph-Token noch Client-Secret ausgeben');
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
