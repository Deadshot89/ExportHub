import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

test('RC1003: Produktion TESTSERVICE und Demo werden aus demselben Release-Build erzeugt', () => {
  assert.equal(fs.existsSync('.github/rc1003/build-three-env.mjs'), true, 'RC1003 Drei-Umgebungen-Build fehlt');
  const build = read('.github/rc1003/build-three-env.mjs');
  assert.match(build, /const VERSION='RC1003'/);
  assert.match(build, /dist-rc1003/);
  assert.match(build, /write\('index\.html'/);
  assert.match(build, /write\('TESTVERSION\.html'/);
  assert.match(build, /write\('demo\.html'/);
});

test('RC1003: Produktionsfreigabe und Android-App tragen dieselbe RC-Version', () => {
  assert.match(read('production-version.js'), /__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1003'/);
  const gradle = read('android-app/app/build.gradle.kts');
  assert.match(gradle, /versionCode\s*=\s*1003/);
  assert.match(gradle, /versionName\s*=\s*"1\.0-rc1003"/);
});

test('RC1003: Produktionsworkflow veröffentlicht Produktion und TESTSERVICE gemeinsam', () => {
  const workflow = read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(workflow, /RC1003/);
  assert.match(workflow, /\.github\/rc1003\/build-three-env\.mjs/);
  assert.match(workflow, /Deploy ExportHUB production/);
  assert.match(workflow, /Deploy ExportHUB TESTSERVICE/);
  assert.match(workflow, /deployment_environment:\s*testservice/);
  assert.match(workflow, /dist-rc1003\/demo\.html/);
});
