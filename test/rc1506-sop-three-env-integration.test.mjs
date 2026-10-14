import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1506 baut auf dem aktuellsten RC1503 Drei-Umgebungs-Builder auf',()=>{
  const src=read('.github/rc1506/build-three-env.mjs');
  assert.match(src,/from ['"]\.\.\/rc1503\/build-three-env\.mjs['"]/);
  assert.match(src,/buildRc1503\(root\)/);
  assert.match(src,/index\.html/);
  assert.match(src,/TESTVERSION\.html/);
  assert.match(src,/demo\.html/);
});

test('RC1506 integriert Registry, Coverage, Dashboard, Runtime und CSS in alle Umgebungen',()=>{
  const src=read('.github/rc1506/build-three-env.mjs');
  for(const asset of [
    'rc1505-sop-function-registry.js',
    'rc1505-sop-coverage.js',
    'rc1506-sop-coverage-dashboard.js',
    'rc1506-sop-coverage-runtime.js',
    'rc1506-sop-coverage-dashboard.css'
  ]) assert.match(src,new RegExp(asset.replaceAll('.','\\.')));
  assert.match(src,/exporthub-rc1506-sop-coverage-runtime/);
  assert.match(src,/exporthub-rc1506-sop-coverage-dashboard-style/);
  assert.match(src,/version:'RC1506'/);
});

test('RC1506 Runtime mountet nur die bestehende Dashboard-API und berechnet keinen zweiten Coverage-Status',()=>{
  const src=read('assets/sop/rc1506-sop-coverage-runtime.js');
  assert.match(src,/ExportHubSopCoverageDashboard/);
  assert.match(src,/\.mount\(/);
  assert.doesNotMatch(src,/STATUS\s*=/);
  assert.doesNotMatch(src,/percentage\s*=.*green/);
  assert.match(src,/data-sop-open/);
  assert.match(src,/data-sop-approve/);
  assert.match(src,/MutationObserver/);
});

test('RC1506 Builder erzwingt eindeutige Tags und korrekte Lade-Reihenfolge',()=>{
  const src=read('.github/rc1506/build-three-env.mjs');
  assert.match(src,/count!==1/);
  assert.match(src,/RC1505 Registry muss vor Coverage geladen werden/);
  assert.match(src,/RC1505 Coverage muss vor RC1506 Dashboard geladen werden/);
  assert.match(src,/RC1506 Dashboard muss vor Runtime geladen werden/);
});
