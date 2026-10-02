import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const browser=fs.readFileSync('e2e/specs/rc1306-layout-redesign.spec.mjs','utf8');

test('RC1412: Builder begrenzt Root-Clear und Router auf einen echten Ansichtsaufbau',()=>{
  assert.match(build,/function patchRc1412ShipmentCreateDomPreserve\(html,file\)/);
  assert.match(build,/preserveMountedShipment=!!\(r&&mountedLayout&&r\.contains\(mountedLayout\)\)/);
  assert.match(build,/if\(r&&!preserveMountedShipment\)/);
  assert.match(build,/if\(preserveMountedShipment\)\{try\{patch\(\)\}/);
  assert.match(build,/html=patchRc1412ShipmentCreateDomPreserve\(html,file\)/);
});

test('RC1412: Browserregression prüft echte DOM-Identität statt nur sichtbaren Text',()=>{
  assert.match(browser,/__RC1412_LAYOUT_NODE__/);
  assert.match(browser,/layoutPreserved/);
  assert.match(browser,/customerPreserved/);
  assert.match(browser,/contentPreserved/);
  assert.match(browser,/Sendungs-Layout wurde beim neuen Entwurf ersetzt/);
});

test('RC1412: Fachlicher Fresh-Draft-Zustand bleibt Bestandteil des Browsertests',()=>{
  assert.match(browser,/__rc562Fresh===true/);
  assert.match(browser,/expect\(after\.ref\)\.toMatch\(\/\^\[A-Z0-9\]\{6\}\$\//);
});
