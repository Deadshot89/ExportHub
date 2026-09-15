import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const build=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');
const auth=fs.readFileSync('api/shared/auth-store.js','utf8');

test('RC1116: SESSION_IDLE_TIMEOUT wird beim Start wie eine abgelaufene Sitzung behandelt',()=>{
  assert.match(auth,/SESSION_IDLE_TIMEOUT/);
  assert.match(build,/idleSessionOld/);
  assert.match(build,/idleSessionNew/);
  assert.match(build,/'SESSION_INVALID','SESSION_REVOKED','SESSION_IDLE_TIMEOUT','AUTH_REQUIRED'/);
  assert.match(build,/RC1116 SESSION_IDLE_TIMEOUT wird beim Start nicht als abgelaufene Sitzung behandelt/);
});

test('RC1116: der Hotfix bleibt Teil des Drei-Umgebungen-Builds',()=>{
  assert.match(build,/function patchRc1069Performance\(html,file\)/);
  assert.match(build,/html=patchRc1069Performance\(html,file\)/);
});
