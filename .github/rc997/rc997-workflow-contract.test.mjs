import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW='.github/workflows/rc997-website-final.yml';
const src=fs.readFileSync(WORKFLOW,'utf8');

test('RC997 Workflow: baut Android und deployt ausschließlich TESTSERVICE per SWA CLI',()=>{
  assert.match(src,/android_build:/);
  assert.match(src,/deploy_testservice:/);
  assert.match(src,/\.rc997_testservice_app/);
  assert.match(src,/swa deploy \.\/\.rc997_testservice_app/);
  assert.match(src,/--env testservice/);
  assert.match(src,/--api-location \.\/api/);
  assert.match(src,/test ! -d \.rc997_testservice_app\/api/);
  assert.doesNotMatch(src,/deployment_environment:\s*testservice/);
  assert.doesNotMatch(src,/uses:\s*Azure\/static-web-apps-deploy@v1/);
});

test('RC997 Workflow: erzeugt APK-Artefakt und übernimmt externe Seiten in TESTSERVICE',()=>{
  assert.match(src,/ExportHUB-RC997\.1-Android/);
  assert.match(src,/android-app\/app\/build\/outputs\/apk\/debug\/app-debug\.apk/);
  assert.match(src,/pickup\.html/);
  assert.match(src,/customer-avis\.html/);
  assert.match(src,/location\.html/);
  assert.match(src,/pod-notfall\.html/);
});

test('RC997 Workflow: Live-Gate prüft statische Seiten begrenzt und API ohne Redirect-Following',()=>{
  assert.match(src,/test_code=.*curl -sS -L --max-redirs 5/);
  assert.match(src,/demo_code=.*curl -sS -L --max-redirs 5/);
  assert.match(src,/pickup_code=.*curl -sS -L --max-redirs 5/);
  assert.match(src,/avis_code=.*curl -sS -L --max-redirs 5/);
  assert.match(src,/api_code=.*curl -sS --connect-timeout/);
  assert.doesNotMatch(src,/api_code=.*curl -sS -L/);
  assert.match(src,/ExportHUB RC997 environment=testservice/);
  assert.match(src,/ExportHUB RC997 environment=demo/);
  assert.match(src,/Abholung bestätigen/);
  assert.match(src,/Kunden-Avis/);
});

test('RC997 Workflow: Produktionsguard erlaubt nur Vorfreigabe RC990 oder freigegebenes RC997',()=>{
  assert.match(src,/rc997-website-final/);
  assert.match(src,/RC990\|RC997/);
  assert.match(src,/staticwebapp\.config\.json/);
  assert.match(src,/azure-static-web-apps-wonderful-forest-0f315e310\.yml/);
});
