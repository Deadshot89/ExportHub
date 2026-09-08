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

test('RC1010: Android-App folgt dem aktuellen gemeinsamen Release', () => {
  const gradle = read('android-app/app/build.gradle.kts');
  assert.match(gradle, /versionCode\s*=\s*1010/);
  assert.match(gradle, /versionName\s*=\s*"1\.0-rc1010"/);
  assert.match(read('production-version.js'), /RC1010/);
});
