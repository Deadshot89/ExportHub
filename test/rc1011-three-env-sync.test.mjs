import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1011 ist der gemeinsame autoritative Versionsmarker',()=>{
  assert.match(read('production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1011'/);
});

test('RC1011 baut Produktion TESTSERVICE und Demo aus demselben Quellstand',()=>{
  const build=read('.github/rc1011/build-three-env.mjs');
  for(const term of ["VERSION='RC1011'","environment=production-candidate","environment=testservice","environment=demo","dist-rc1011"]) {
    assert.match(build,new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
  assert.match(build,/read\('index\.html'\)/);
  assert.match(build,/read\('TESTVERSION\.html'\)/);
});

test('Standarddeploy veröffentlicht RC1011 gemeinsam und prüft alle drei Umgebungen live',()=>{
  const flow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(flow,/ExportHUB RC1011 Drei-Umgebungen Deploy/);
  assert.match(flow,/node \.github\/rc1011\/build-three-env\.mjs/);
  assert.match(flow,/Deploy ExportHUB production/);
  assert.match(flow,/Deploy ExportHUB TESTSERVICE/);
  assert.match(flow,/Live RC1011 Produktion TESTSERVICE und Demo prüfen/);
  assert.match(flow,/test\/rc1011-core-open-issues\.test\.mjs/);
  assert.match(flow,/test\/rc1011-three-env-sync\.test\.mjs/);
  assert.match(flow,/dist-rc1011\/index\.html/);
  assert.match(flow,/dist-rc1011\/TESTVERSION\.html/);
  assert.match(flow,/dist-rc1011\/demo\.html/);
});

test('TESTSERVICE Einzeldeploy bleibt unter RC1011 ausschließlich genehmigte Ausnahme',()=>{
  const flow=read('.github/workflows/exporthub-testservice.yml');
  assert.match(flow,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(flow,/Produktion, TESTSERVICE und Demo müssen denselben Versionsstand haben/);
  assert.match(flow,/RC1011/);
  assert.match(flow,/node \.github\/rc1011\/build-three-env\.mjs/);
});
