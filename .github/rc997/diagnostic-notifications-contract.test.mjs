import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const BASE='android-app/app/src/main/java/de/exporthub/test/';

test('RC1002 Android: Fehlerdiagnose besitzt eigenen nativen Benachrichtigungskanal',()=>{
  const src=read(BASE+'NotificationHelper.java');
  assert.match(src,/CHANNEL_DIAGNOSTICS\s*=\s*"exporthub_diagnostics"/);
  assert.match(src,/ExportHUB Fehlerdiagnose/);
  assert.match(src,/"diagnostic"\.equalsIgnoreCase\(channel\)/);
  assert.match(src,/CHANNEL_DIAGNOSTICS/);
});

test('RC1002 Website-App-Brücke: nur Global Admin erhält deduplizierte Diagnose-Benachrichtigungen',()=>{
  const src=read('assets/exporthub-environment-hub.js');
  assert.match(src,/exporthub:diagnostic/);
  assert.match(src,/ExportHUBDiagnosticsCloud864/);
  assert.match(src,/isGlobalAdmin/);
  assert.match(src,/channel:'diagnostic'/);
  assert.match(src,/route:'diagnostics'/);
  assert.match(src,/exporthub-native-notify:/);
  assert.match(src,/ExportHUB Fehlerdiagnose/);
  assert.match(src,/cloud\.refresh/);
  assert.match(src,/recentRecords/);
  assert.match(src,/exporthub-native-diagnostic-last/);
});

test('RC1002 Android: Tipp auf Diagnose-Benachrichtigung öffnet den Diagnosebereich',()=>{
  const src=read('assets/exporthub-environment-hub.js');
  assert.match(src,/URLSearchParams/);
  assert.match(src,/ehRoute/);
  assert.match(src,/android-notification/);
  assert.match(src,/ExportHUBRC325\.route/);
});

test('RC1002 Android: aktuelle App-Version und Diagnosekanal sind dokumentiert',()=>{
  const gradle=read('android-app/app/build.gradle.kts');
  const versionCode=Number((gradle.match(/versionCode\s*=\s*(\d+)/)||[])[1]||0);
  assert.equal(versionCode,1002);
  assert.match(gradle,/versionName\s*=\s*"1\.0-rc1002"/);
  const info=JSON.parse(read('android-app/app-build-info.json'));
  assert.equal(info.appVersion,'1.0-rc1002');
  assert.equal(info.releaseCandidate,'RC1002');
  assert.ok(info.features.some(x=>/Fehlerdiagnose.*Benachrichtigung/i.test(String(x))), 'Diagnose-Benachrichtigung fehlt in Buildinfo');
});

test('RC1002 Android: veraltete MainActivity ist entfernt und nur EnvironmentActivity bleibt Einstieg',()=>{
  assert.equal(fs.existsSync(BASE+'MainActivity.java'),false,'veraltete MainActivity.java ist noch vorhanden');
  const manifest=read('android-app/app/src/main/AndroidManifest.xml');
  assert.doesNotMatch(manifest,/\.MainActivity/);
  assert.match(manifest,/\.EnvironmentActivity/);
});

test('RC1002 Android: aktiver Workflow veröffentlicht das aktuelle APK eindeutig als RC1002',()=>{
  const workflow=read('.github/workflows/exporthub-android-test-app.yml');
  assert.match(workflow,/Build ExportHUB Android RC1002 APK/);
  assert.match(workflow,/name:\s*ExportHUB-RC1002-Android/);
  assert.match(workflow,/ExportHUB-RC1002-Android-debug\.apk/);
});
