import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const HUB='assets/exporthub-environment-hub.js';
const ANDROID='android-app/app/src/main/java/de/exporthub/test/EnvironmentActivity.java';
const source=fs.readFileSync(HUB,'utf8');
const android=fs.readFileSync(ANDROID,'utf8');

test('RC1018 entfernt die sichtbare Bereichswechsel-Leiste vollständig',()=>{
  assert.doesNotMatch(source,/eh996-env-hub/);
  assert.doesNotMatch(source,/eh996-env-switch/);
  assert.doesNotMatch(source,/eh996-app-open/);
  assert.doesNotMatch(source,/eh996-env-panel/);
  assert.doesNotMatch(source,/eh996-app-dialog/);
  assert.doesNotMatch(source,/Bereich wechseln/);
});

test('RC1018 entfernt die Bereichswechsel-Funktion, behält aber die Android-Benachrichtigungsbrücke',()=>{
  assert.doesNotMatch(source,/function go\(/);
  assert.doesNotMatch(source,/function appAction\(/);
  assert.doesNotMatch(source,/selectEnvironment/);
  assert.doesNotMatch(source,/chooseEnvironment/);
  assert.doesNotMatch(source,/openApp:appAction/);
  assert.match(source,/function sendAndroid\(/);
  assert.match(source,/function notifyAndroid\(/);
  assert.match(source,/function installNotificationBridge\(/);
  assert.match(source,/function openRequestedRoute\(/);
});

test('RC1018 behält die automatische Umgebungserkennung für Benachrichtigungsdaten',()=>{
  assert.match(source,/function currentEnvironment\(/);
  assert.match(source,/data-exporthub-environment/);
  assert.match(source,/current:currentEnvironment/);
});

test('RC1018 entfernt auch den benutzerseitigen Android-Bereichswechsler',()=>{
  assert.doesNotMatch(android,/private void chooseEnvironment\(\)/);
  assert.doesNotMatch(android,/public void chooseEnvironment\(\)/);
  assert.doesNotMatch(android,/public void selectEnvironment\(String environment\)/);
  assert.doesNotMatch(android,/Wähle den Bereich/);
  assert.match(android,/private void selectEnvironment\(String environment, String route\)/);
  assert.match(android,/public void notify\(String channel, String key, String title, String body, String route\)/);
});
