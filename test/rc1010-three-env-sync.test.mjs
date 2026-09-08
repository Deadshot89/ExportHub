import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1010 ist der gemeinsame autoritative Versionsmarker',()=>{
  assert.match(read('production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1010'/);
});

test('RC1010 Build lädt den SOP-Freigabe-Layer in Produktion TESTSERVICE und Demo',()=>{
  const build=read('.github/rc1010/build-three-env.mjs');
  for(const term of ["VERSION='RC1010'","environment=production-candidate","environment=testservice","environment=demo","dist-rc1010","rc1010-sop-release.js"]) assert.match(build,new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('gemeinsamer Deploy veröffentlicht RC1010 auf allen drei Umgebungen und prüft den SOP-Layer live',()=>{
  const flow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(flow,/ExportHUB RC1010 Drei-Umgebungen Deploy/);
  assert.match(flow,/Deploy ExportHUB production/);
  assert.match(flow,/Deploy ExportHUB TESTSERVICE/);
  assert.match(flow,/Live RC1010 Produktion TESTSERVICE und Demo prüfen/);
  assert.match(flow,/node \.github\/rc1010\/build-three-env\.mjs/);
  assert.match(flow,/rc1010-sop-release\.js/);
});

test('TESTSERVICE Einzeldeploy bleibt auch unter RC1010 nur als genehmigte Ausnahme möglich',()=>{
  const flow=read('.github/workflows/exporthub-testservice.yml');
  assert.match(flow,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(flow,/Produktion, TESTSERVICE und Demo müssen denselben Versionsstand haben/);
  assert.match(flow,/RC1010/);
});
