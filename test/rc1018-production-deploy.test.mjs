import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const workflow='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';

test('RC1047 ist der aktuelle gemeinsame Standarddeploy auf der geprüften RC1045/RC1044/RC1018-Buildkette',()=>{
  const flow=read(workflow),wrapper=read('.github/rc1047/build-three-env.mjs'),previous=read('.github/rc1046/build-three-env.mjs'),base=read('.github/rc1045/build-three-env.mjs'),foundation=read('.github/rc1044/build-three-env.mjs');
  assert.match(read('production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1047'/);
  assert.match(flow,/name:\s*ExportHUB RC1047 Drei-Umgebungen Deploy/);
  assert.match(flow,/node \.github\/rc1047\/build-three-env\.mjs/);
  assert.match(flow,/dist-rc1047\/index\.html/);
  assert.match(flow,/dist-rc1047\/TESTVERSION\.html/);
  assert.match(flow,/dist-rc1047\/demo\.html/);
  assert.match(wrapper,/\.github\/rc1046\/build-three-env\.mjs/,'RC1047 muss den vollständig geprüften RC1046-Vorgänger übernehmen');
  assert.match(wrapper,/dist-rc1046/);
  assert.match(previous,/\.github\/rc1045\/build-three-env\.mjs/,'RC1046 muss weiterhin RC1045 übernehmen');
  assert.match(base,/\.github\/rc1044\/build-three-env\.mjs/,'RC1045 muss weiterhin RC1044 übernehmen');
  assert.match(foundation,/\.github\/rc1018\/build-three-env\.mjs/,'RC1044 muss weiterhin die geprüfte RC1018-Buildbasis übernehmen');
  assert.match(flow,/Deploy ExportHUB production/);
  assert.match(flow,/Deploy ExportHUB TESTSERVICE/);
});

test('RC1047 bewahrt die RC1018 Mail- und Sprachruntime unverändert',()=>{
  const flow=read(workflow);
  assert.match(flow,/test\/rc1018-mail-language-standard\.test\.mjs/);
  assert.match(flow,/test\/rc1018-production-deploy\.test\.mjs/);
  assert.match(flow,/test\/rc1015-lieferavis-mail-flow\.test\.mjs/);
  assert.match(flow,/npm test/);
  assert.match(flow,/assets\/rc1015-lieferavis-mail-flow\.js\?v=1021/);
  assert.match(flow,/assets\/rc1018-mail-language-standard\.js\?v=1018/);
  assert.match(flow,/assets\/rc1018-public-language\.js\?v=1018/);
});

test('RC1047 Deploypakete und Liveprüfung verwenden überall denselben sichtbaren Release',()=>{
  const flow=read(workflow);
  assert.match(flow,/\.rc1047_production_app/);
  assert.match(flow,/\.rc1047_testservice_app/);
  assert.match(flow,/Live RC1047 Produktion TESTSERVICE und Demo prüfen/);
  assert.match(flow,/ExportHUB RC1047 environment=production-candidate/);
  assert.match(flow,/ExportHUB RC1047 environment=testservice/);
  assert.match(flow,/ExportHUB RC1047 environment=demo/);
  assert.match(flow,/version:'RC1047'/);
  assert.match(flow,/rc1047=\$GITHUB_SHA-\$attempt/);
});
