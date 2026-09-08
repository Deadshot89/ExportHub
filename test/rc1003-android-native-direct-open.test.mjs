import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const BASE = 'android-app/app/src/main/java/de/exporthub/test/';

test('RC1003: Diagnose-Benachrichtigung öffnet native Detailansicht statt WebView', () => {
  assert.equal(fs.existsSync(BASE + 'NotificationDetailActivity.java'), true, 'NotificationDetailActivity.java fehlt');
  const helper = read(BASE + 'NotificationHelper.java');
  const detail = read(BASE + 'NotificationDetailActivity.java');
  const manifest = read('android-app/app/src/main/AndroidManifest.xml');

  assert.match(helper, /new Intent\(context, NotificationDetailActivity\.class\)/);
  assert.match(helper, /EXTRA_NOTIFICATION_TITLE/);
  assert.match(helper, /EXTRA_NOTIFICATION_BODY/);
  assert.match(helper, /EXTRA_NOTIFICATION_CHANNEL/);
  assert.match(helper, /EXTRA_NOTIFICATION_ROUTE/);
  assert.match(manifest, /\.NotificationDetailActivity/);
  assert.doesNotMatch(detail, /WebView/);
  assert.match(detail, /ExportHUB Fehlerdiagnose/);
  assert.match(detail, /In ExportHUB öffnen/);
  assert.match(detail, /EnvironmentActivity/);
});

test('RC1003: normale ExportHUB-Navigation bleibt geschützt und getrennt', () => {
  const helper = read(BASE + 'NotificationHelper.java');
  const detail = read(BASE + 'NotificationDetailActivity.java');
  assert.match(helper, /NotificationDetailActivity\.class/);
  assert.match(detail, /EXTRA_ENVIRONMENT/);
  assert.match(detail, /EXTRA_ROUTE/);
  assert.match(detail, /startActivity\(intent\)/);
  assert.doesNotMatch(detail, /CookieManager|addJavascriptInterface|loadUrl/);
});

test('RC1003: App ist als installierbares Update eindeutig versioniert', () => {
  const gradle = read('android-app/app/build.gradle.kts');
  assert.match(gradle, /versionCode\s*=\s*1003/);
  assert.match(gradle, /versionName\s*=\s*"1\.0-rc1003"/);
  const info = JSON.parse(read('android-app/app-build-info.json'));
  assert.equal(info.appVersion, '1.0-rc1003');
  assert.equal(info.releaseCandidate, 'RC1003');
  assert.match(read('android-app/APP_BUILD_INFO.txt'), /App-Version:\s*1\.0-rc1003/);
});
