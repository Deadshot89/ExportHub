import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

test('RC1003: historische Drei-Umgebungen-Baseline bleibt nachvollziehbar', () => {
  assert.equal(fs.existsSync('.github/rc1003/build-three-env.mjs'), true, 'RC1003 Drei-Umgebungen-Build fehlt');
  const build = read('.github/rc1003/build-three-env.mjs');
  assert.match(build, /const VERSION='RC1003'/);
  assert.match(build, /dist-rc1003/);
  assert.match(build, /write\('index\.html'/);
  assert.match(build, /write\('TESTVERSION\.html'/);
  assert.match(build, /write\('demo\.html'/);
});

test('RC1010+: Android-App bleibt an den gemeinsamen Release gekoppelt', () => {
  const gradle = read('android-app/app/build.gradle.kts');
  const code = Number((gradle.match(/versionCode\s*=\s*(\d+)/)||[])[1]);
  const name = (gradle.match(/versionName\s*=\s*"1\.0-rc(\d+)"/)||[])[1];
  const marker = (read('production-version.js').match(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC(\d+)'/)||[])[1];
  assert.ok(code >= 1010, 'Android versionCode darf nicht hinter RC1010 zurückfallen');
  assert.equal(String(code), String(name), 'versionCode und versionName müssen denselben RC tragen');
  assert.equal(String(code), String(marker), 'Android und gemeinsamer Produktionsmarker müssen denselben RC tragen');
});
