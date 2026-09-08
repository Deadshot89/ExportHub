import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1009 bleibt als historische Drei-Umgebungen-Baseline reproduzierbar',()=>{
  const build=read('.github/rc1009/build-three-env.mjs');
  for(const term of ["VERSION='RC1009'","environment=production-candidate","environment=testservice","environment=demo","dist-rc1009"]) assert.match(build,new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('aktueller Standard-Deploy darf RC1009 nicht mehr als Freigabestand festschreiben',()=>{
  const flow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.doesNotMatch(flow,/name:\s*ExportHUB RC1009 Drei-Umgebungen Deploy/);
  assert.doesNotMatch(flow,/Live RC1009 Produktion TESTSERVICE und Demo prüfen/);
  assert.doesNotMatch(flow,/node \.github\/rc1009\/build-three-env\.mjs/);
});

test('autoritativer Produktionsmarker darf nach RC1009 nicht auf RC1009 zurückfallen',()=>{
  const marker=read('production-version.js');
  assert.doesNotMatch(marker,/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1009'/);
  assert.match(marker,/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC\d+'/);
});

test('Einzel-TESTSERVICE-Deploy bleibt weiterhin nur als explizit genehmigte Ausnahme möglich',()=>{
  const flow=read('.github/workflows/exporthub-testservice.yml');
  assert.match(flow,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(flow,/Produktion, TESTSERVICE und Demo müssen denselben Versionsstand haben/);
  assert.match(flow,/workflow_dispatch/);
});
