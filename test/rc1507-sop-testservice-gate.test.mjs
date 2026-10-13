import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path='.github/workflows/sopmaster-testservice-verify.yml';
const read=()=>fs.readFileSync(path,'utf8');

test('RC1507 TESTSERVICE-Prüfung baut ausschließlich den integrierten RC1506 Stand',()=>{
  assert.ok(fs.existsSync(path),'TESTSERVICE-Prüfworkflow fehlt');
  const src=read();
  assert.match(src,/node \.github\/rc1506\/build-three-env\.mjs/);
  assert.match(src,/TESTVERSION\.html/);
  assert.match(src,/environment=testservice/);
});

test('RC1507 prüft TESTVERSION im Browser und öffentliche read-only Seiten',()=>{
  const src=read();
  assert.match(src,/sopmaster-testservice-package\.spec\.mjs/);
  assert.match(src,/public-smoke\.spec\.mjs/);
  assert.match(src,/EXPORTHUB_E2E_ENTRY:\s*['"]?\/TESTVERSION\.html['"]?/);
  assert.match(src,/EXPORTHUB_E2E_PUBLIC_ENV:\s*testservice/);
  assert.match(src,/--project=laptop/);
  assert.match(src,/--project=mobile-standard/);
});

test('RC1507 bleibt read-only und kann weder TESTSERVICE noch Produktion deployen',()=>{
  const src=read();
  assert.match(src,/EXPORTHUB_E2E_STATIC:\s*['"]?1['"]?/);
  assert.doesNotMatch(src,/EXPORTHUB_E2E_LIVE:\s*['"]?1['"]?/);
  assert.doesNotMatch(src,/EXPORTHUB_E2E_MUTATION:\s*['"]?1['"]?/);
  assert.doesNotMatch(src,/Azure\/static-web-apps-deploy/i);
  assert.doesNotMatch(src,/shipment-create\.spec\.mjs/);
  assert.doesNotMatch(src,/testservice-mutation\.spec\.mjs/);
});

test('RC1507 verändert den geschützten Einzel-Deploy-Vertrag nicht',()=>{
  const deploy=fs.readFileSync('.github/workflows/exporthub-testservice.yml','utf8');
  assert.match(deploy,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(deploy,/Deploy TESTSERVICE explicit only/);
});
