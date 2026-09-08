import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const BASE = 'android-app/app/src/main/java/de/exporthub/test/';

test('RC1010: Diagnose-Benachrichtigung öffnet native Detailansicht statt WebView', () => {
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

test('RC1010: normale ExportHUB-Navigation bleibt geschützt und getrennt', () => {
  const helper = read(BASE + 'NotificationHelper.java');
  const detail = read(BASE + 'NotificationDetailActivity.java');
  assert.match(helper, /NotificationDetailActivity\.class/);
  assert.match(detail, /EXTRA_ENVIRONMENT/);
  assert.match(detail, /EXTRA_ROUTE/);
  assert.match(detail, /startActivity\(intent\)/);
  assert.doesNotMatch(detail, /CookieManager|addJavascriptInterface|loadUrl/);
});

test('RC1010: App ist als installierbares Update auf demselben Release wie Produktion versioniert', () => {
  const gradle = read('android-app/app/build.gradle.kts');
  assert.match(gradle, /versionCode\s*=\s*1010/);
  assert.match(gradle, /versionName\s*=\s*"1\.0-rc1010"/);
  const info = JSON.parse(read('android-app/app-build-info.json'));
  assert.equal(info.appVersion, '1.0-rc1010');
  assert.equal(info.releaseCandidate, 'RC1010');
  assert.match(read('android-app/APP_BUILD_INFO.txt'), /App-Version:\s*1\.0-rc1010/);
  assert.match(read('production-version.js'), /RC1010/);
});
