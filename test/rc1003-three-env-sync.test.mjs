import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
function currentRc(){
  const match=read('production-version.js').match(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC(\d+)'/);
  assert.ok(match,'Autoritativer Produktions-RC fehlt');
  return Number(match[1]);
}

test('RC1003: historische Drei-Umgebungen-Baseline bleibt nachvollziehbar', () => {
  assert.equal(fs.existsSync('.github/rc1003/build-three-env.mjs'), true, 'RC1003 Drei-Umgebungen-Build fehlt');
  const build = read('.github/rc1003/build-three-env.mjs');
  assert.match(build, /const VERSION='RC1003'/);
  assert.match(build, /dist-rc1003/);
  assert.match(build, /write\('index\.html'/);
  assert.match(build, /write\('TESTVERSION\.html'/);
  assert.match(build, /write\('demo\.html'/);
});

test('Android-App folgt dem aktuellen gemeinsamen Release', () => {
  const rc=currentRc();
  const gradle = read('android-app/app/build.gradle.kts');
  assert.match(gradle,new RegExp(`versionCode\\s*=\\s*${rc}`));
  assert.match(gradle,new RegExp(`versionName\\s*=\\s*"1\\.0-rc${rc}"`));
});
