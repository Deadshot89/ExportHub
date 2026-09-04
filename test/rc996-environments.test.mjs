import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const exists = (p) => fs.existsSync(new URL(`../${p}`, import.meta.url));

test('shared environment module defines production, testservice and demo', () => {
  assert.equal(exists('assets/exporthub-environments.js'), true, 'shared environment module missing');
  const js = read('assets/exporthub-environments.js');
  assert.match(js, /production/);
  assert.match(js, /testservice/);
  assert.match(js, /demo/);
  assert.match(js, /ExportHUBEnvironment/);
});

test('production and test candidate load shared environment UI without changing production marker', () => {
  const prod = read('index.html');
  const testPage = read('TESTVERSION.html');
  assert.match(prod, /assets\/exporthub-environments\.js/);
  assert.match(testPage, /assets\/exporthub-environments\.js/);
  assert.match(read('production-version.js'), /RC990/);
});

test('demo is isolated and visibly uses fake data only', () => {
  assert.equal(exists('demo.html'), true, 'demo.html missing');
  assert.equal(exists('assets/exporthub-demo.js'), true, 'demo data module missing');
  const html = read('demo.html');
  const js = read('assets/exporthub-demo.js');
  assert.match(html, /DEMO/i);
  assert.match(html, /exporthub-environments\.js/);
  assert.match(js, /exporthub-demo:/);
  assert.match(js, /Fake|Demo/i);
  assert.doesNotMatch(js, /\/api\/team-state|\/api\/save|pickup-init|customer-avis/);
});

test('android app is RC996 and can enter all three environments', () => {
  const activity = read('android-app/app/src/main/java/de/exporthub/test/MainActivity.java');
  const gradle = read('android-app/app/build.gradle.kts');
  assert.match(gradle, /1\.0-rc996/);
  assert.match(activity, /PROD_HOST/);
  assert.match(activity, /TEST_HOST/);
  assert.match(activity, /demo\.html/);
  assert.match(activity, /Produktion/);
  assert.match(activity, /TESTSERVICE/);
  assert.match(activity, /Demo/);
  assert.match(activity, /ehMenuBtn/);
  assert.match(activity, /MutationObserver/);
});

test('android 13 notifications are separated into tasks and warnings and deduplicated', () => {
  const manifest = read('android-app/app/src/main/AndroidManifest.xml');
  const activity = read('android-app/app/src/main/java/de/exporthub/test/MainActivity.java');
  assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/);
  assert.match(activity, /NotificationChannel/);
  assert.match(activity, /exporthub_tasks/);
  assert.match(activity, /exporthub_warnings/);
  assert.match(activity, /notificationDedupe/);
  assert.match(activity, /environmentKey/);
});
