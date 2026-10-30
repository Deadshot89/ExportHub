import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const BASE = 'android-app/app/src/main/java/de/exporthub/test/';
const read = (file) => fs.readFileSync(BASE + file, 'utf8');

test('Android: Leistungshinweise werden in der App selbst nicht als Push angezeigt', () => {
  const helper = read('NotificationHelper.java');
  assert.match(helper, /"diagnostic"\.equals\(normalizedChannel\) && isPerformanceHint\(safeBody\)\) return false;/);
  for (const phrase of ['Langsamer API-Aufruf', 'Langsamer XHR-Aufruf', 'Browser-Hänger', 'Long Task', 'Großer Render-Vorgang', 'Häufiges Neu-Rendern']) {
    assert.ok(helper.includes(`text.contains("${phrase}")`), `${phrase} fehlt im App-Filter`);
  }
});

test('Android: Fehlerdiagnose-Detail erklärt die Meldung in Klartext', () => {
  const detail = read('NotificationDetailActivity.java');
  assert.match(detail, /class PlainDiagnostic/);
  for (const label of ['Was bedeutet das?', 'Was ist zu tun?', 'Wichtig', 'Beobachten', 'Harmlos', 'Technische Meldung']) {
    assert.ok(detail.includes(`"${label}"`), `${label} fehlt in der Diagnoseansicht`);
  }
  // the ISO timestamp from the push is shown as a readable local time
  assert.match(detail, /dd\.MM\.yyyy, HH:mm 'Uhr'/);
});

test('Android: Aufgaben werden als Karten mit Priorität, Referenz und Fälligkeit gezeigt', () => {
  const detail = read('NotificationDetailActivity.java');
  const helper = read('NotificationHelper.java');
  const receiver = read('ReminderReceiver.java');
  assert.match(detail, /EXTRA_NOTIFICATION_TASKS/);
  assert.match(detail, /private void renderTasks\(/);
  assert.match(detail, /"Referenz: "/);
  assert.match(detail, /priorityLabel\(task\.priority\)/);
  assert.match(helper, /putExtra\(NotificationDetailActivity\.EXTRA_NOTIFICATION_TASKS, tasksJson\)/);
  assert.match(receiver, /detailTask\.put\("sourceRef", sourceRef\)/);
  assert.match(receiver, /detailTask\.put\("due", dueText\)/);
  // still read-only
  assert.doesNotMatch(detail, /EnvironmentActivity\.class|Aufgabe öffnen|In ExportHUB öffnen/);
});
