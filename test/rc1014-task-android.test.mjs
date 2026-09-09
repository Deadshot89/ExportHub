import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=rel=>fs.readFileSync(rel,'utf8');
const scheduler=read('android-app/app/src/main/java/de/exporthub/test/ReminderScheduler.java');
const receiver=read('android-app/app/src/main/java/de/exporthub/test/ReminderReceiver.java');
const helper=read('android-app/app/src/main/java/de/exporthub/test/NotificationHelper.java');
const runtime=read('assets/rc1014-task-runtime.js');

test('RC1014 Android behält exakt die regulären Erinnerungszeiten 09 12 15',()=>{
  assert.match(scheduler,/HOURS\s*=\s*new int\[\]\s*\{9,\s*12,\s*15\}/);
  const hours=(scheduler.match(/HOURS\s*=\s*new int\[\]\s*\{([^}]*)\}/)||[])[1]||'';
  assert.deepEqual(hours.split(',').map(x=>Number(x.trim())).filter(Number.isFinite),[9,12,15]);
});

test('RC1014 Website sendet nur sichtbare datensparsame Aufgaben als lokalen Android-Snapshot',()=>{
  assert.match(runtime,/function\s+syncAndroidSnapshot\s*\(/);
  assert.match(runtime,/reminderCandidates|visibleTasks/);
  assert.match(runtime,/task_snapshot/);
  assert.match(runtime,/bridge\.notify\s*\(/);
  for(const field of ['id','title','sourceRef','priority','dueAt','dueBucket','group','effectiveAssignee','environment','route']){
    assert.match(runtime,new RegExp(`\\b${field}\\b`),`${field} fehlt im Snapshot-Vertrag`);
  }
  assert.doesNotMatch(runtime,/pickupToken|qrToken|customerAvisToken|password|authorization|signature/i);
});

test('RC1014 NotificationHelper behandelt task_snapshot als Store-only Kanal mit Größenlimit',()=>{
  assert.match(helper,/task_snapshot/);
  assert.match(helper,/131072|128\s*\*\s*1024/);
  assert.match(helper,/task_snapshot_/);
  assert.match(helper,/storeTaskSnapshot\s*\(/);
  assert.match(helper,/readTaskSnapshot\s*\(/);
  assert.match(helper,/return\s+true\s*;/,'Snapshot muss ohne Systembenachrichtigung erfolgreich angenommen werden');
});

test('RC1014 ReminderReceiver verwendet echten persönlichen Task statt generischem Prüfhinweis',()=>{
  assert.match(receiver,/readTaskSnapshot\s*\(/);
  assert.match(receiver,/org\.json|JSONObject|JSONArray/);
  assert.match(receiver,/taskId|task\.optString\("id"/);
  assert.match(receiver,/priority|Priorität|P1/);
  assert.match(receiver,/sourceRef|Referenz/);
  assert.match(receiver,/userId/);
  assert.match(receiver,/NotificationHelper\.show\s*\(/);
  assert.doesNotMatch(receiver,/Prüfe deine persönlichen offenen Aufgaben in ExportHUB\./);
});

test('RC1014 Reminder-Dedupe enthält Aufgabe Tag Slot Umgebung und Benutzer',()=>{
  assert.match(receiver,/taskId[\s\S]{0,800}day[\s\S]{0,800}hour[\s\S]{0,800}env[\s\S]{0,800}userId|taskId\s*\+[^;]*day[^;]*hour[^;]*env[^;]*userId/);
});

test('RC1014 Aufgabenbenachrichtigung bleibt auf nativer Detailansicht und bestehendem NotificationHelper',()=>{
  assert.match(helper,/new Intent\(context, NotificationDetailActivity\.class\)/);
  assert.match(helper,/EXTRA_NOTIFICATION_ROUTE/);
  assert.match(receiver,/"notification"/);
  assert.doesNotMatch(receiver,/new Intent\(context, EnvironmentActivity\.class\)/);
});
