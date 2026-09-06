import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const activity=fs.readFileSync('android-app/app/src/main/java/de/exporthub/test/EnvironmentActivity.java','utf8');
const html=fs.readFileSync('TESTVERSION.html','utf8');

test('RC997.1 Android startet ohne Auswahl direkt in Produktion',()=>{
  assert.match(activity,/private String selectedEnvironment = "production";/);
  assert.match(activity,/getString\(PREF_ENV, "production"\)/);
  const onCreate=(activity.match(/protected void onCreate\(Bundle savedInstanceState\) \{[\s\S]*?\n    \}\n\n    @Override\n    protected void onNewIntent/)||[])[0]||'';
  assert.match(onCreate,/else \{\s*selectEnvironment\("production", route\);\s*\}/);
  assert.doesNotMatch(onCreate,/chooseEnvironment\(\);/);
  assert.match(activity,/public void chooseEnvironment\(\)/,'Bereichswechsel muss weiterhin verfügbar bleiben');
});

test('RC997.1 Login zeigt keinen Anmeldekonfigurations-Prüfstatus mehr',()=>{
  assert.doesNotMatch(html,/Anmeldekonfiguration wird geprüft …/);
});
