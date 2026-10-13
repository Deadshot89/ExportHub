import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const migration='scripts/rc1521-wire-release.mjs';
const main='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const production='.github/workflows/exporthub-production-release.yml';
const testservice='.github/workflows/exporthub-testservice.yml';

test('RC1521 Release-Verdrahtung liegt als explizite fail-closed Migration vor',()=>{
  assert.ok(fs.existsSync(migration),'RC1521 Verdrahtungsmigration fehlt');
  const src=read(migration);
  assert.match(src,/replaceExact/);
  assert.match(src,/insertAfter/);
  assert.match(src,/erwartete \$\{count\} Vorkommen nicht gefunden/);
  assert.match(src,/Unerwartete Patch-Dateien|RC1521 Verdrahtung fehlt nach Migration/);
});

test('RC1521 Migration zielt ausschließlich auf die drei Releasepfade und zwei historischen Verträge plus RC1520',()=>{
  const src=read(migration);
  for(const path of [
    '.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml',
    '.github/workflows/exporthub-production-release.yml',
    '.github/workflows/exporthub-testservice.yml',
    '.github/workflows/sopmaster-release-candidate.yml',
    'test/rc1018-production-deploy.test.mjs',
    'test/pack-notification-production.test.mjs'
  ]) assert.ok(src.includes(path),`RC1521 Migrationsziel fehlt: ${path}`);
});

test('RC1521 Migration ersetzt alte Release-Buildaufrufe durch den finalen Kombinations-Builder',()=>{
  const src=read(migration);
  assert.match(src,/node \.github\/rc1521\/build-three-env\.mjs/);
  assert.match(src,/node \.github\/rc1112\/build-three-env\.mjs/);
  assert.match(src,/node \.github\/packmeldungen\/build-three-env\.mjs/);
  assert.match(src,/Production würde Packmeldungen nach RC1521 erneut bauen/);
  for(const asset of [
    'rc1501-sop-tour-runtime.js',
    'rc1502-sop-editor.js',
    'rc1503-sop-training.js',
    'rc1506-sop-coverage-runtime.js'
  ]) assert.ok(src.includes(asset),`RC1521 Pflichtasset fehlt in Migration: ${asset}`);
});

test('Aktuelle Release-Schutzregeln bleiben bis zur expliziten Anwendung der Migration unverändert',()=>{
  const mainSrc=read(main);
  const productionSrc=read(production);
  const testserviceSrc=read(testservice);
  assert.match(mainSrc,/Deploy ExportHUB TESTSERVICE/);
  assert.doesNotMatch(mainSrc,/Deploy ExportHUB production/);
  assert.match(productionSrc,/release_sha:/);
  assert.match(productionSrc,/PRODUCTION FREIGEBEN/);
  assert.match(productionSrc,/git merge-base --is-ancestor "\$RELEASE_SHA" origin\/main/);
  assert.match(testserviceSrc,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(testserviceSrc,/Deploy TESTSERVICE explicit only/);
});
