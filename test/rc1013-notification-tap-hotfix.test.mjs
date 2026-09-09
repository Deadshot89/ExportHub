import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const BASE = 'android-app/app/src/main/java/de/exporthub/test/';
const read = (p) => fs.readFileSync(p, 'utf8');

test('Handy-Benachrichtigungen erzwingen einen frischen nativen Detail-PendingIntent', () => {
  const helper = read(BASE + 'NotificationHelper.java');
  assert.match(helper, /new Intent\(context, NotificationDetailActivity\.class\)/);
  assert.match(helper, /OPEN_NOTIFICATION\.NATIVE_DETAIL_V2/);
  assert.match(helper, /FLAG_CANCEL_CURRENT\s*\|\s*PendingIntent\.FLAG_IMMUTABLE/);
  assert.doesNotMatch(helper, /new Intent\(context, EnvironmentActivity\.class\)/);
});

test('Benachrichtigungs-PendingIntent benutzt eine neue Identitaet und kann nicht mit altem WebView-Ziel kollidieren', () => {
  const helper = read(BASE + 'NotificationHelper.java');
  assert.match(helper, /native-detail-v2:/);
  assert.match(helper, /NotificationDetailActivity\.EXTRA_NOTIFICATION_TITLE/);
  assert.match(helper, /NotificationDetailActivity\.EXTRA_NOTIFICATION_BODY/);
  assert.match(helper, /NotificationDetailActivity\.EXTRA_NOTIFICATION_CHANNEL/);
  assert.match(helper, /NotificationDetailActivity\.EXTRA_NOTIFICATION_ROUTE/);
});
