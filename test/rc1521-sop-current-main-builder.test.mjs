import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// RC1523 FINAL-Checkpoint: aktuelles Main bis 2e433e7c + TaskPlanner + Pack-Prefill-Fix + SOPMaster über den stabilen RC1112-Pfad; sechs Sprachen und i18n-Release-Gate sind integriert und verifiziert.
const builder='.github/rc1521/build-three-env.mjs';
const read=p=>fs.readFileSync(p,'utf8');

test('RC1521 baut zuerst die aktuelle Main-/Packbasis und legt SOPMaster ausschließlich additiv darüber',()=>{
  assert.ok(fs.existsSync(builder),'RC1521 Final-Builder fehlt');
  const src=read(builder);
  assert.match(src,/build as buildPack.*packmeldungen\/build-three-env\.mjs/s);
  assert.match(src,/integrateTour.*rc1501\/build-three-env\.mjs/s);
  assert.match(src,/integrateEditor.*rc1502\/build-three-env\.mjs/s);
  assert.match(src,/integrateTraining.*rc1503\/build-three-env\.mjs/s);
  assert.match(src,/integrateCoverageAdmin.*rc1506\/build-three-env\.mjs/s);
  assert.doesNotMatch(src,/build as buildRc1506/);
  assert.doesNotMatch(src,/rc1112\/build-three-env\.mjs/);
});

test('RC1521 erzwingt die sichere Overlay-Reihenfolge Pack vor Tour vor Editor vor Training vor Coverage',()=>{
  const src=read(builder);
  const order=[
    'buildPack(root)',
    'integrateTour(root,out)',
    'integrateEditor(root,out)',
    'integrateTraining(root,out)',
    'integrateCoverageAdmin(root,out)'
  ].map(token=>src.indexOf(token));
  assert.ok(order.every(pos=>pos>=0),'RC1521 Buildstufen fehlen');
  for(let i=1;i<order.length;i++)assert.ok(order[i]>order[i-1],`RC1521 Buildreihenfolge ist an Position ${i} falsch`);
});

test('RC1521 validiert Main-, Pack- und SOPMaster-Marker gemeinsam statt nur SOP-Tags',()=>{
  const src=read(builder);
  for(const marker of [
    'assets/rc1027-lieferavis-immediate.js?v=20261005',
    'exporthub-pack-notification-nav',
    'exporthub-rc1501-sop-tour-runtime',
    'exporthub-rc1502-sop-editor',
    'exporthub-rc1503-sop-training',
    'exporthub-rc1505-sop-function-registry',
    'exporthub-rc1506-sop-coverage-runtime'
  ]) assert.ok(src.includes(marker),`RC1521 Pflichtmarker fehlt: ${marker}`);
  assert.match(src,/index\.html.*TESTVERSION\.html.*demo\.html/s);
});

test('RC1521 bleibt ein Build-Wrapper ohne Deployment oder produktive Mutation',()=>{
  const src=read(builder);
  assert.doesNotMatch(src,/Azure\/static-web-apps-deploy/i);
  assert.doesNotMatch(src,/PRODUCTION FREIGEBEN/);
  assert.doesNotMatch(src,/fetch\s*\(/);
  assert.doesNotMatch(src,/https?:\/\//);
});
