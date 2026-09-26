import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const store=fs.readFileSync('api/shared/loader-pin-store.js','utf8');
const admin=fs.readFileSync('api/loader-pins-admin/index.js','utf8');
const ui=fs.readFileSync('assets/rc1075-loader-pin-admin.js','utf8');
const i18nDe=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));

test('RC1076: Repository enthält keine fest codierten produktiven Verlader-PINs mehr',()=>{
  for(const legacy of ['4466','2050','2258','7530']) assert.doesNotMatch(store,new RegExp("\\b"+legacy+"\\b"));
  assert.match(store,/function envDefaults\(\)[\s\S]*return rows;/);
  assert.match(store,/function bridgePin\(\)[\s\S]*return '';/);
});

test('RC1076: optionale Serverkonfiguration bleibt als expliziter Bootstrap erhalten',()=>{
  assert.match(store,/process\.env\.EXPORTHUB_LOADER_PINS/);
  assert.match(store,/process\.env\.EXPORTHUB_LOADER_BRIDGE_PIN/);
  assert.match(store,/validPin\(direct\)/);
  assert.match(store,/envDefaults\(\)\.map\(makeRecord\)/);
});

test('RC1076: PIN-Admin gewährt keine Rechte über einen fest codierten Benutzernamen',()=>{
  assert.doesNotMatch(admin,/tobias(?:\.limberg)?|t\.limberg/i);
  assert.match(admin,/require\('\.\.\/shared\/user-policy'\)/);
  assert.match(admin,/const \{ isAdmin \}/);
  assert.doesNotMatch(admin,/function isGlobalAdmin\(/);
  assert.doesNotMatch(admin,/user\.isAdmin === true|user\.admin === true/);
  assert.match(admin,/Nur globale Administratoren dürfen Verlader-PINs verwalten/);
  assert.match(admin,/version: 'RC1087'/);
});

test('RC1076: Admin-Oberfläche kann leeren PIN-Bestand sicher initialisieren',()=>{
  assert.match(ui,/loaderPin\.empty/);
  assert.match(ui,/call\('create'/);
  assert.match(ui,/loaderPin\.newPinInvalid/);
  assert.equal(i18nDe['loaderPin.newPinInvalid'],'Die neue Verlader-PIN muss genau vier Ziffern enthalten.');
});
