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

test('Android: Warncenter-Push nennt die Sendungen hinter der Zahl, gruppiert', () => {
  const hub = fs.readFileSync('assets/exporthub-environment-hub.js', 'utf8');
  const fnSrc = (hub.match(/function warningDetailLines\(\)\{[\s\S]*?\n\}\n/) || [])[0];
  assert.ok(fnSrc, 'warningDetailLines fehlt');
  const run = (summary) => new Function('window', fnSrc + 'return warningDetailLines();')({ __EXPORTHUB_WARNING_SUMMARY__: summary });
  assert.equal(run(undefined), '');
  const text = run({ total: 5, groups: [
    { label: 'POD fehlt', count: 4, items: ['Sendung A', '  Kunde   B ', 'C', 'D'] },
    { label: 'Dokumente', count: 0, items: [] },
    { label: 'Abholung', count: 1, items: ['E'] }
  ] });
  assert.equal(text, '\n\nPOD fehlt: 4\n• Sendung A\n• Kunde B\n• C\n\nAbholung: 1\n• E');
  assert.match(hub, /\+warningDetailLines\(\),route:'warnings'/);
  for (const page of ['index.html', 'TESTVERSION.html']) {
    assert.match(fs.readFileSync(page, 'utf8'), /window\.__EXPORTHUB_WARNING_SUMMARY__=\{total:d\.total/);
  }
  const detail = read('NotificationDetailActivity.java');
  const helper = read('NotificationHelper.java');
  assert.match(detail, /renderWarnings\(root, title, body\)/);
  assert.match(detail, /"und " \+ more \+ " weitere"/);
  assert.match(helper, /notificationIntent\(context, env, normalizedChannel, safeKey, safeTitle, detailBody,/);
});
