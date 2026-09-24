import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const auth=fs.readFileSync('api/exporthub-auth/index.js','utf8');
const runtime=fs.readFileSync('assets/rc1079-profile-settings.js','utf8');
const build=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');

test('RC1079: jeder angemeldete Benutzer kann nur den eigenen Anzeigenamen ändern',()=>{
  assert.match(auth,/async function updateProfile\(req, payload\)/);
  assert.match(auth,/await auth\.validateSession\(req\)/);
  assert.match(auth,/action === 'update-profile'/);
  assert.match(auth,/user\.name = nextName/);
  assert.match(auth,/user\.displayName = nextName/);
  assert.match(auth,/PROFILE_DISPLAY_NAME_UPDATED/);
  assert.doesNotMatch(auth,/updateProfile[\s\S]{0,1800}globalAdmin/);
});

test('RC1079: Benutzername bleibt unverändert und Anzeigename ist begrenzt',()=>{
  const block=auth.slice(auth.indexOf('async function updateProfile'),auth.indexOf('async function adminList'));
  assert.doesNotMatch(block,/user\.user\s*=/);
  assert.doesNotMatch(block,/user\.login\s*=/);
  assert.doesNotMatch(block,/user\.username\s*=/);
  assert.match(block,/slice\(0, 80\)/);
  assert.match(block,/DISPLAY_NAME_REQUIRED/);
});

test('RC1079: Einstellungen zeigen Benutzername, Anzeigename und persönliche Programmsprache',()=>{
  assert.match(runtime,/Mein Profil/);
  assert.match(runtime,/Benutzername<input data-rc1079-user readonly/);
  assert.match(runtime,/Anzeigename<input data-rc1079-name maxlength="80"/);
  assert.match(runtime,/Programmsprache<select data-rc1079-language/);
  assert.match(runtime,/Profil speichern/);
  assert.match(runtime,/language:language/);
  assert.match(runtime,/action:'update-profile'/);
  assert.match(runtime,/exporthub:user-profile-updated/);
});

test('RC1079: Sprache wird im Benutzerprofil gespeichert und Deutsch ist der sichere Standard',()=>{
  const block=auth.slice(auth.indexOf('async function updateProfile'),auth.indexOf('async function adminList'));
  assert.match(block,/user\.language = nextLanguage/);
  assert.match(block,/normalizeProfileLanguage\(requestedLanguage, previousLanguage\)/);
  assert.match(auth,/de\|en\|pl\|es\|fr\|it/);
  assert.match(runtime,/SUPPORTED_LANGUAGES=\['de','en','pl','es','fr','it'\]/);
  assert.match(runtime,/applyProfileLanguage/);
  assert.match(runtime,/ExportHUBI18n/);
  assert.match(runtime,/rc455SetLanguage/);
});

test('RC1079: finaler Build lädt die Profilfunktion in allen Umgebungen',()=>{
  assert.match(build,/RC1079_PROFILE_TAG/);
  assert.match(build,/assets\/rc1079-profile-settings\.js\?v=1079/);
  assert.match(build,/profileSettings:\{version:'RC1079'/);
});
