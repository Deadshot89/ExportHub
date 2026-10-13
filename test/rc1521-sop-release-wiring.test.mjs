import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const builder='.github/rc1112/build-three-env.mjs';
const main='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const production='.github/workflows/exporthub-production-release.yml';
const testservice='.github/workflows/exporthub-testservice.yml';
const pack='.github/packmeldungen/build-three-env.mjs';

test('RC1521 verdrahtet SOPMaster additiv in die stabile RC1112-Buildbasis',()=>{
  const src=read(builder);
  assert.match(src,/integrateTour.*rc1501\/build-three-env\.mjs/s);
  assert.match(src,/integrateEditor.*rc1502\/build-three-env\.mjs/s);
  assert.match(src,/integrateTraining.*rc1503\/build-three-env\.mjs/s);
  assert.match(src,/integrateCoverageAdmin.*rc1506\/build-three-env\.mjs/s);
  const order=[
    'integrateTour(ROOT,OUT)',
    'integrateEditor(ROOT,OUT)',
    'integrateTraining(ROOT,OUT)',
    'integrateCoverageAdmin(ROOT,OUT)'
  ].map(token=>src.indexOf(token));
  assert.ok(order.every(pos=>pos>=0),'RC1521 SOPMaster-Hook fehlt in RC1112');
  for(let i=1;i<order.length;i++)assert.ok(order[i]>order[i-1],`RC1521 Overlay-Reihenfolge ist an Position ${i} falsch`);
});

test('RC1521 lässt Main-, Production- und TESTSERVICE-Workflows auf ihren bewährten Buildaufrufen',()=>{
  const mainSrc=read(main),productionSrc=read(production),testserviceSrc=read(testservice);
  assert.match(mainSrc,/node \.github\/rc1112\/build-three-env\.mjs/);
  assert.match(productionSrc,/node \.github\/rc1112\/build-three-env\.mjs/);
  assert.match(productionSrc,/node \.github\/packmeldungen\/build-three-env\.mjs/);
  assert.match(testserviceSrc,/node \.github\/rc1112\/build-three-env\.mjs/);
  assert.doesNotMatch(mainSrc,/node \.github\/rc1521\/build-three-env\.mjs/);
  assert.doesNotMatch(productionSrc,/node \.github\/rc1521\/build-three-env\.mjs/);
  assert.doesNotMatch(testserviceSrc,/node \.github\/rc1521\/build-three-env\.mjs/);
});

test('RC1521 erhält alle bestehenden Release-Schutzregeln unverändert',()=>{
  const mainSrc=read(main),productionSrc=read(production),testserviceSrc=read(testservice);
  assert.match(mainSrc,/Deploy ExportHUB TESTSERVICE/);
  assert.doesNotMatch(mainSrc,/Deploy ExportHUB production/);
  assert.match(productionSrc,/release_sha:/);
  assert.match(productionSrc,/PRODUCTION FREIGEBEN/);
  assert.match(productionSrc,/git merge-base --is-ancestor "\$RELEASE_SHA" origin\/main/);
  assert.match(testserviceSrc,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(testserviceSrc,/Deploy TESTSERVICE explicit only/);
});

test('Packmeldungen bauen weiterhin auf RC1112 auf und entfernen keine SOPMaster-Schicht',()=>{
  const src=read(pack);
  assert.match(src,/rc1112\/build-three-env\.mjs/);
  assert.doesNotMatch(src,/rmSync\([^\n]*assets\/sop/);
  assert.doesNotMatch(src,/unlinkSync\([^\n]*assets\/sop/);
});

test('RC1112 SOPMaster-Hook bleibt ein lokaler Buildschritt ohne Deployment oder Netzwerkzugriff',()=>{
  const src=read(builder);
  assert.doesNotMatch(src,/Azure\/static-web-apps-deploy/i);
  assert.doesNotMatch(src,/PRODUCTION FREIGEBEN/);
  assert.doesNotMatch(src,/fetch\s*\(/);
});
