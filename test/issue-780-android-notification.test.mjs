import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('Issue 780: generic task-check push is suppressed before deduplication and delivery', () => {
  const helper = read('android-app/app/src/main/java/de/exporthub/test/NotificationHelper.java');
  const guard = helper.indexOf('"ExportHUB Aufgaben prüfen".equals(safeTitle)');
  const delivery = helper.indexOf('manager.notify(notificationId, builder.build())');
  assert.ok(guard > 0, 'specific generic task notification guard missing');
  assert.match(helper, /"Prüfe deine persönlichen offenen Aufgaben in ExportHUB\."\.equals\(safeBody\)/);
  assert.ok(delivery > 0, 'Android delivery call missing');
  assert.ok(guard < helper.indexOf('String signature ='), 'guard must run before deduplication');
  assert.ok(guard < delivery, 'guard must run before Android delivery');
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

test('Issue 780: reminder carries exact task id through the existing route extra', () => {
  const receiver = read('android-app/app/src/main/java/de/exporthub/test/ReminderReceiver.java');
  const detail = read('android-app/app/src/main/java/de/exporthub/test/NotificationDetailActivity.java');
  assert.match(receiver, /String directRoute = route\.isEmpty\(\) \|\| "tasks"\.equalsIgnoreCase\(route\)/);
  assert.match(receiver, /\? "tasks:" \+ taskId/);
  assert.match(receiver, /NotificationHelper\.show\([\s\S]{0,500}directRoute\)/);
  assert.match(detail, /intent\.putExtra\(EnvironmentActivity\.EXTRA_ROUTE, route\)/);
  assert.match(detail, /intent\.putExtra\(EnvironmentActivity\.EXTRA_ENVIRONMENT, environment\)/);
});

test('Issue 780: website routes first and opens only the matching rendered task card', () => {
  const hub = read('assets/exporthub-environment-hub.js');
  assert.match(hub, /function requestedRouteSpec\s*\(/);
  assert.match(hub, /route!==['"]tasks['"]/);
  assert.match(hub, /\[A-Za-z0-9_\.:@-\]\{1,200\}/);
  assert.match(hub, /function openTaskCard\s*\(taskId\)/);
  assert.match(hub, /querySelectorAll\('\[data-task-id\]'\)/);
  assert.match(hub, /getAttribute\('data-task-id'\).*taskId/);
  assert.match(hub, /ExportHUBRC325\.route\(spec\.route,'android-notification'\)/);
  assert.match(hub, /spec\.taskId\?openTaskCard\(spec\.taskId\):true/);
});

test('Issue 780: scheduled receiver processes every valid snapshot task, not only tasks[0]', () => {
  const receiver = read('android-app/app/src/main/java/de/exporthub/test/ReminderReceiver.java');
  assert.doesNotMatch(receiver, /tasks\.optJSONObject\(0\)/, 'receiver must not be limited to the first task');
  assert.match(receiver, /for\s*\(int\s+i\s*=\s*0;\s*i\s*<\s*tasks\.length\(\);\s*i\+\+\)/);
  assert.match(receiver, /JSONObject task = tasks\.optJSONObject\(i\)/);
  assert.match(receiver, /if\s*\(task\s*==\s*null\)\s*continue/);
  assert.match(receiver, /if\s*\(taskId\.isEmpty\(\)\s*\|\|\s*title\.isEmpty\(\)\)\s*continue/);
});

test('Issue 780: each task keeps its own slot-scoped dedupe key and task-specific route', () => {
  const receiver = read('android-app/app/src/main/java/de/exporthub/test/ReminderReceiver.java');
  assert.match(receiver, /String key = taskId \+ "\\|" \+ day \+ "\\|" \+ hour \+ "\\|" \+ env \+ "\\|" \+ userId/);
  assert.match(receiver, /\? "tasks:" \+ taskId/);
  assert.match(receiver, /NotificationHelper\.show\([\s\S]{0,700}key,[\s\S]{0,700}directRoute\)/);
});

test('Issue 780: task notification dedupe is isolated per safeKey while warning and diagnostic semantics stay unchanged', () => {
  const helper = read('android-app/app/src/main/java/de/exporthub/test/NotificationHelper.java');
  assert.match(helper, /String dedupeKey = "last:" \+ env \+ ":" \+ normalizedChannel/);
  assert.match(helper, /"notification"\.equals\(normalizedChannel\)[\s\S]{0,180}safeKey/);
  assert.match(helper, /prefs\.getString\(dedupeKey/);
});

test('Issue 780: multiple tasks get an Android group summary without replacing individual task notifications', () => {
  const receiver = read('android-app/app/src/main/java/de/exporthub/test/ReminderReceiver.java');
  const helper = read('android-app/app/src/main/java/de/exporthub/test/NotificationHelper.java');
  assert.match(receiver, /validTaskCount\+\+/);
  assert.match(receiver, /if\s*\(validTaskCount\s*>\s*1\)/);
  assert.match(receiver, /NotificationHelper\.showTaskSummary\s*\(/);
  assert.match(receiver, /highestPriority/);
  assert.match(helper, /showTaskSummary\s*\(/);
  assert.match(helper, /setGroup\s*\(/);
  assert.match(helper, /setGroupSummary\s*\(true\)/);
  assert.match(helper, /offene Aufgaben/);
  // the summary carries every task line, readable without opening anything
  assert.match(receiver, /taskLines\.append\("\\n• "\)/);
  assert.match(receiver, /highestPriority,\s*taskLines\.toString\(\)\)/);
  assert.match(helper, /BigTextStyle\(\)\.bigText\(fullBody\)/);
});
