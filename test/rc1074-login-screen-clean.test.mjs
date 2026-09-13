import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const build=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');
const runtime=fs.readFileSync('assets/rc1074-login-clean.js','utf8');
const production=fs.readFileSync('index.html','utf8');
const testservice=fs.readFileSync('TESTVERSION.html','utf8');

test('RC1074: technische Login-Prüfhinweise sind in den Quellseiten nicht sichtbar',()=>{
  for(const [name,html] of [['Produktion',production],['TESTSERVICE',testservice]]){
    assert.doesNotMatch(html,/Anmeldekonfiguration wird geprüft/i,name);
    assert.doesNotMatch(html,/TESTSERVICE\s*·\s*Auth-Backend wird geprüft/i,name);
  }
});

test('RC1074: finaler Drei-Umgebungen-Build entfernt alte Login-Prüftexte erneut',()=>{
  assert.match(build,/function patchLoginScreenStatus\(html,file\)/);
  assert.match(build,/technischer Login-Prüfstatus noch vorhanden/);
  assert.match(build,/RC1074_LOGIN_TAG/);
  assert.match(build,/assets\/rc1074-login-clean\.js/);
});

test('RC1074: Runtime-Schutz blendet nur technische Fortschrittsmeldungen aus',()=>{
  assert.match(runtime,/Anmeldekonfiguration wird geprüft/);
  assert.match(runtime,/Auth-Backend wird geprüft/);
  assert.match(runtime,/data-rc1074-login-progress-hidden/);
  assert.doesNotMatch(runtime,/Benutzername oder Passwort ist falsch|INVALID_CREDENTIALS|ACCOUNT_DISABLED/);
});
