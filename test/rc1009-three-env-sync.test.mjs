import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1009 ist der gemeinsame autoritative Versionsmarker',()=>{
  assert.match(read('production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1009'/);
});

test('RC1009 Build erzeugt Produktion TESTSERVICE und Demo aus demselben Release',()=>{
  const build=read('.github/rc1009/build-three-env.mjs');
  for(const term of ["VERSION='RC1009'","environment=production-candidate","environment=testservice","environment=demo","dist-rc1009"]) assert.match(build,new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('gemeinsamer Deploy veröffentlicht RC1009 auf allen drei Umgebungen und prüft sie live',()=>{
  const flow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(flow,/ExportHUB RC1009 Drei-Umgebungen Deploy/);
  assert.match(flow,/Deploy ExportHUB production/);
  assert.match(flow,/Deploy ExportHUB TESTSERVICE/);
  assert.match(flow,/Live RC1009 Produktion TESTSERVICE und Demo prüfen/);
  assert.match(flow,/node \.github\/rc1009\/build-three-env\.mjs/);
});

test('TESTSERVICE Einzeldeploy bleibt auch unter RC1009 nur als genehmigte Ausnahme möglich',()=>{
  const flow=read('.github/workflows/exporthub-testservice.yml');
  assert.match(flow,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(flow,/Produktion, TESTSERVICE und Demo müssen denselben Versionsstand haben/);
  assert.match(flow,/RC1009/);
});
