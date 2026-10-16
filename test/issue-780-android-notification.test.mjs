import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('Issue 780: generic task-check push is suppressed before deduplication and delivery', () => {
  const helper = read('android-app/app/src/main/java/de/exporthub/test/NotificationHelper.java');
  const guard = helper.indexOf('"ExportHUB Aufgaben prüfen".equals(safeTitle)');
  assert.ok(guard > 0, 'specific generic task notification guard missing');
  assert.match(helper, /"Prüfe deine persönlichen offenen Aufgaben in ExportHUB\\."\.equals\(safeBody\)/);
  assert.ok(guard < helper.indexOf('String signature ='), 'guard must run before deduplication');
  assert.ok(guard < helper.indexOf('manager.notify(notificationId, notification)'), 'guard must run before Android delivery');
  assert.match(helper, /"notification"\.equals\(normalizedChannel\)/, 'warnings and diagnostics must remain unaffected');
});

test('Issue 780: native notification still opens through environment route', () => {
  const detail = read('android-app/app/src/main/java/de/exporthub/test/NotificationDetailActivity.java');
  assert.match(detail, /intent\.putExtra\(EnvironmentActivity\.EXTRA_ROUTE, route\)/);
  assert.match(detail, /intent\.putExtra\(EnvironmentActivity\.EXTRA_ENVIRONMENT, environment\)/);
});
