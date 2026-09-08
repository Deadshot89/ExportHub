import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1010 bleibt als historische Drei-Umgebungen- und SOP-Baseline reproduzierbar',()=>{
  assert.equal(fs.existsSync('.github/rc1010/build-three-env.mjs'),true,'historischer RC1010 Build fehlt');
  const build=read('.github/rc1010/build-three-env.mjs');
  for(const term of ["VERSION='RC1010'","environment=production-candidate","environment=testservice","environment=demo","dist-rc1010","rc1010-sop-release.js"]) assert.match(build,new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('aktueller gemeinsamer Versionsmarker darf nicht auf RC1010 zurückfallen',()=>{
  const marker=Number((read('production-version.js').match(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC(\d+)'/)||[])[1]);
  assert.ok(marker>=1010,'gemeinsamer Versionsmarker liegt vor RC1010');
});

test('aktueller Standard-Deploy darf RC1010 nicht mehr als Freigabestand festschreiben',()=>{
  const flow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.doesNotMatch(flow,/name:\s*ExportHUB RC1010 Drei-Umgebungen Deploy/);
  assert.match(flow,/Deploy ExportHUB production/);
  assert.match(flow,/Deploy ExportHUB TESTSERVICE/);
});

test('TESTSERVICE Einzeldeploy bleibt weiterhin nur als genehmigte Ausnahme möglich',()=>{
  const flow=read('.github/workflows/exporthub-testservice.yml');
  assert.match(flow,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(flow,/Produktion, TESTSERVICE und Demo müssen denselben Versionsstand haben/);
});
