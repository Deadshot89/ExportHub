import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1010 bleibt als historische Drei-Umgebungen-Baseline reproduzierbar',()=>{
  const build=read('.github/rc1010/build-three-env.mjs');
  assert.match(build,/VERSION='RC1010'/);
  assert.match(build,/dist-rc1010/);
  assert.match(build,/environment=production-candidate/);
  assert.match(build,/environment=testservice/);
  assert.match(build,/environment=demo/);
  assert.match(build,/rc1010-sop-release\.js/);
});

test('autoritativer Produktionsmarker darf nach RC1010 nicht zurückfallen',()=>{
  const source=read('production-version.js');
  const match=source.match(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC(\d+)'/);
  assert.ok(match,'Produktionsmarker fehlt');
  assert.ok(Number(match[1])>=1010,`Produktionsmarker RC${match[1]} liegt hinter RC1010`);
});

test('aktueller Standard-Deploy hält Produktion TESTSERVICE und Demo weiterhin gemeinsam',()=>{
  const flow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(flow,/Drei-Umgebungen Deploy/);
  assert.match(flow,/Deploy ExportHUB production/);
  assert.match(flow,/Deploy ExportHUB TESTSERVICE/);
  assert.match(flow,/Produktion TESTSERVICE und Demo/);
});

test('TESTSERVICE Einzeldeploy bleibt nach RC1010 nur als genehmigte Ausnahme möglich',()=>{
  const flow=read('.github/workflows/exporthub-testservice.yml');
  assert.match(flow,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(flow,/Produktion, TESTSERVICE und Demo müssen denselben Versionsstand haben/);
});
