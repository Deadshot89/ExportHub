import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const activity=fs.readFileSync('android-app/app/src/main/java/de/exporthub/test/EnvironmentActivity.java','utf8');
const manifest=fs.readFileSync('android-app/app/src/main/AndroidManifest.xml','utf8');

test('RC1288: Android-Kaltstart verwendet die zuletzt gespeicherte Umgebung statt Produktion zu erzwingen',()=>{
  assert.match(activity,/selectedEnvironment\s*=\s*normalizeEnvironment\([\s\S]*?getSharedPreferences\(PREFS, MODE_PRIVATE\)\.getString\(PREF_ENV, "production"\)\)/);
  assert.match(activity,/if \(isEnvironment\(requested\)\) \{[\s\S]*?selectEnvironment\(requested, route\);[\s\S]*?\} else \{[\s\S]*?selectEnvironment\(selectedEnvironment, route\);/);
  assert.doesNotMatch(activity,/\} else \{\s*selectEnvironment\("production", route\);\s*\}/);
});

test('RC1288: Umgebungswechsel wird vor dem Laden dauerhaft gespeichert',()=>{
  const start=activity.indexOf('private void selectEnvironment(String environment, String route)');
  const end=activity.indexOf('public static String normalizeEnvironment',start);
  assert.ok(start>=0&&end>start,'selectEnvironment(environment, route) fehlt');
  const block=activity.slice(start,end);
  const persist=block.indexOf('putString(PREF_ENV, env).apply()');
  const load=block.indexOf('webView.loadUrl(target)');
  assert.ok(persist>=0,'Umgebung wird nicht in SharedPreferences gespeichert');
  assert.ok(load>persist,'Umgebung muss vor dem WebView-Laden gespeichert werden');
});

test('RC1288: WebView-Sitzung bleibt persistent und Cookies werden beim Hintergrundwechsel auf Datenträger geschrieben',()=>{
  assert.match(activity,/settings\.setDomStorageEnabled\(true\)/);
  assert.match(activity,/cookies\.setAcceptCookie\(true\)/);
  assert.match(activity,/protected void onPause\(\) \{\s*CookieManager\.getInstance\(\)\.flush\(\);\s*super\.onPause\(\);\s*\}/);
  assert.doesNotMatch(activity,/removeAllCookies|removeSessionCookies|deleteAllData|clearCache\(true\)/);
});

test('RC1288: normaler Activity-Recreate-Pfad behält zusätzlich den WebView-Zustand',()=>{
  assert.match(activity,/webView\.restoreState\(savedInstanceState\)/);
  assert.match(activity,/webView\.saveState\(outState\)/);
  assert.match(manifest,/android:configChanges="keyboard\|keyboardHidden\|orientation\|screenLayout\|screenSize\|smallestScreenSize\|uiMode"/);
});
