import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const workflow='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';

test('RC1112 ist der aktuelle sichtbare Standarddeploy auf der historischen RC1048-Buildkette',()=>{
  const flow=read(workflow),wrapper=read('.github/rc1112/build-three-env.mjs'),r1048=read('.github/rc1048/build-three-env.mjs'),r1047=read('.github/rc1047/build-three-env.mjs'),r1046=read('.github/rc1046/build-three-env.mjs'),r1045=read('.github/rc1045/build-three-env.mjs'),r1044=read('.github/rc1044/build-three-env.mjs');
  assert.match(read('production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1112'/);
  assert.match(flow,/name:\s*ExportHUB RC1112 Drei-Umgebungen Deploy/);
  assert.match(flow,/node \.github\/rc1112\/build-three-env\.mjs/);
  assert.match(flow,/dist-rc1112\/index\.html/);
  assert.match(flow,/dist-rc1112\/TESTVERSION\.html/);
  assert.match(flow,/dist-rc1112\/demo\.html/);
  assert.match(wrapper,/\.github\/rc1048\/build-three-env\.mjs/);
  assert.match(wrapper,/dist-rc1048/);
  assert.match(r1048,/\.github\/rc1047\/build-three-env\.mjs/);
  assert.match(r1048,/dist-rc1047/);
  assert.match(r1047,/\.github\/rc1046\/build-three-env\.mjs/);
  assert.match(r1046,/\.github\/rc1045\/build-three-env\.mjs/);
  assert.match(r1045,/\.github\/rc1044\/build-three-env\.mjs/);
  assert.match(r1044,/\.github\/rc1018\/build-three-env\.mjs/);
  assert.match(flow,/Deploy ExportHUB production/);
  assert.match(flow,/Deploy ExportHUB TESTSERVICE/);
});

test('RC1112 bewahrt die RC1018 Mail- und Sprachruntime unverändert',()=>{
  const flow=read(workflow);
  assert.match(flow,/test\/rc1018-mail-language-standard\.test\.mjs/);
  assert.match(flow,/test\/rc1018-production-deploy\.test\.mjs/);
  assert.match(flow,/test\/rc1015-lieferavis-mail-flow\.test\.mjs/);
  assert.match(flow,/npm test/);
  assert.match(flow,/assets\/rc1015-lieferavis-mail-flow\.js\?v=1291/);
  assert.match(flow,/assets\/rc1018-mail-language-standard\.js\?v=1018/);
  assert.match(flow,/assets\/rc1018-public-language\.js\?v=1018/);
});

test('RC1112 Deploypakete und Liveprüfung verwenden überall denselben sichtbaren Release',()=>{
  const flow=read(workflow);
  assert.match(flow,/\.rc1112_production_app/);
  assert.match(flow,/\.rc1112_testservice_app/);
  assert.match(flow,/Live RC1112 Produktion TESTSERVICE und Demo prüfen/);
  assert.match(flow,/ExportHUB RC1112 environment=production-candidate/);
  assert.match(flow,/ExportHUB RC1112 environment=testservice/);
  assert.match(flow,/ExportHUB RC1112 environment=demo/);
  assert.match(flow,/version:'RC1112'/);
  assert.match(flow,/rc1112=\$GITHUB_SHA-\$attempt/);
});
