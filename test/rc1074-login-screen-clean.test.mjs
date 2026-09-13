import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const build=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');
const runtime=fs.readFileSync('assets/rc1074-login-clean.js','utf8');

test('RC1074: finaler Drei-Umgebungen-Build entfernt alte Login-Prüftexte erneut',()=>{
  assert.match(build,/function patchLoginScreenStatus\(html,file\)/);
  assert.match(build,/Anmeldekonfiguration wird geprüft/);
  assert.match(build,/Zugangsdaten eingeben/);
  assert.match(build,/technischer Login-Prüfstatus noch vorhanden/);
  assert.match(build,/RC1074_LOGIN_TAG/);
  assert.match(build,/assets\/rc1074-login-clean\.js/);
});

test('RC1074: Runtime-Schutz hält den Login frei und lässt echte Fehler wieder sichtbar werden',()=>{
  assert.match(runtime,/Anmeldekonfiguration wird geprüft/);
  assert.match(runtime,/Auth-Backend wird geprüft/);
  assert.match(runtime,/Zugangsdaten eingeben/);
  assert.match(runtime,/data-rc1074-login-progress-hidden/);
  assert.match(runtime,/function showNode\(el\)/);
  assert.doesNotMatch(runtime,/Benutzername oder Passwort ist falsch|INVALID_CREDENTIALS|ACCOUNT_DISABLED/);
});
