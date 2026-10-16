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

test('Issue 780: environment hub no longer creates count-only Android task pushes', () => {
  const hub = read('assets/exporthub-environment-hub.js');
  assert.doesNotMatch(hub, /notificationCount/);
  assert.doesNotMatch(hub, /key:`tasks:\$\{/);
  assert.doesNotMatch(hub, /android\.taskOpenOne|android\.taskOpenMany/);
  assert.match(hub, /snapshot\s*->\s*native ReminderReceiver path/);
  assert.match(hub, /channel:'warning'/, 'warning notifications must remain active');
  assert.match(hub, /channel:'diagnostic'/, 'diagnostic notifications must remain active');
});

test('Issue 780: task-specific snapshot path remains active', () => {
  const runtime = read('assets/rc1014-task-runtime.js');
  const receiver = read('android-app/app/src/main/java/de/exporthub/test/ReminderReceiver.java');
  assert.match(runtime, /bridge\.notify\('task_snapshot'/);
  assert.match(runtime, /\bid\b/);
  assert.match(runtime, /\btitle\b/);
  assert.match(runtime, /\bpriority\b/);
  assert.match(runtime, /\bdueBucket\b/);
  assert.match(receiver, /readTaskSnapshot\s*\(/);
  assert.match(receiver, /"ExportHUB Aufgabe · " \+ priority/);
  assert.match(receiver, /String body = title/);
});

test('Issue 780: native notification still opens through environment route', () => {
  const detail = read('android-app/app/src/main/java/de/exporthub/test/NotificationDetailActivity.java');
  assert.match(detail, /intent\.putExtra\(EnvironmentActivity\.EXTRA_ROUTE, route\)/);
  assert.match(detail, /intent\.putExtra\(EnvironmentActivity\.EXTRA_ENVIRONMENT, environment\)/);
});
