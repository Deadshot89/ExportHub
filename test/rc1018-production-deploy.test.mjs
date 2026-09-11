import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const workflow='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';

test('RC1043 ist der aktuelle gemeinsame Standarddeploy auf stabiler RC1018-Buildbasis',()=>{
  const flow=read(workflow),wrapper=read('.github/rc1043/build-three-env.mjs');
  assert.match(read('production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1043'/);
  assert.match(flow,/name:\s*ExportHUB RC1043 Drei-Umgebungen Deploy/);
  assert.match(flow,/node \.github\/rc1043\/build-three-env\.mjs/);
  assert.match(flow,/dist-rc1043\/index\.html/);
  assert.match(flow,/dist-rc1043\/TESTVERSION\.html/);
  assert.match(flow,/dist-rc1043\/demo\.html/);
  assert.match(wrapper,/\.github\/rc1018\/build-three-env\.mjs/,'RC1043 muss die geprüfte RC1018-Buildbasis übernehmen');
  assert.match(wrapper,/dist-rc1018/);
  assert.match(wrapper,/dist-rc1043/);
  assert.match(flow,/Deploy ExportHUB production/);
  assert.match(flow,/Deploy ExportHUB TESTSERVICE/);
});

test('RC1043 bewahrt die RC1018 Mail- und Sprachruntime unverändert',()=>{
  const flow=read(workflow);
  assert.match(flow,/test\/rc1018-mail-language-standard\.test\.mjs/);
  assert.match(flow,/test\/rc1018-production-deploy\.test\.mjs/);
  assert.match(flow,/test\/rc1015-lieferavis-mail-flow\.test\.mjs/);
  assert.match(flow,/npm test/);
  assert.match(flow,/assets\/rc1015-lieferavis-mail-flow\.js\?v=1021/);
  assert.match(flow,/assets\/rc1018-mail-language-standard\.js\?v=1018/);
  assert.match(flow,/assets\/rc1018-public-language\.js\?v=1018/);
});

test('RC1043 Deploypakete und Liveprüfung verwenden überall denselben sichtbaren Release',()=>{
  const flow=read(workflow);
  assert.match(flow,/\.rc1043_production_app/);
  assert.match(flow,/\.rc1043_testservice_app/);
  assert.match(flow,/Live RC1043 Produktion TESTSERVICE und Demo prüfen/);
  assert.match(flow,/ExportHUB RC1043 environment=production-candidate/);
  assert.match(flow,/ExportHUB RC1043 environment=testservice/);
  assert.match(flow,/ExportHUB RC1043 environment=demo/);
  assert.match(flow,/version:'RC1043'/);
  assert.match(flow,/rc1043=\$GITHUB_SHA-\$attempt/);
});
