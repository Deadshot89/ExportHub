import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const context={console,Date,Intl,setTimeout,clearTimeout};context.globalThis=context;
  for(const file of ['assets/taskplanner-v2-core.js','assets/taskplanner-v2-recurrence.js','assets/taskplanner-v2-planner.js','assets/taskplanner-v2-ui.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  return context.ExportHUBTaskUIV2;
}
const plain=value=>JSON.parse(JSON.stringify(value));

function task(extra={}){
  return {id:'t1',title:'Aufgabe',status:'open',ownerId:'u1',dueAt:'2026-10-12T16:15:00+02:00',...extra};
}

test('Standard-Erinnerungsslots sind 09:00, 13:00 und 15:30',()=>{
  const api=load();
  assert.deepEqual(Array.from(api.DEFAULT_REMINDER_SLOTS),['09:00','13:00','15:30']);
});

test('reminderCandidates berücksichtigt Aufgabenslots und Website/E-Mail-Kanäle',()=>{
  const api=load();
  const state={tasks:[task({reminders:[{time:'13:00',channels:{website:true,email:false}}]})],taskSettings:{reminderLedger:{}}};
  const rows=plain(api.reminderCandidates('2026-10-12T13:00:30+02:00',state,{id:'u1',environment:'production'}));
  assert.equal(rows.length,1);
  assert.equal(rows[0].taskId,'t1');
  assert.equal(rows[0].slot,'13:00');
  assert.deepEqual(rows[0].channels,{website:true,email:false});
});

test('Aufgabe ohne eigene Reminder verwendet die drei Standardslots',()=>{
  const api=load();
  const state={tasks:[task()],taskSettings:{reminderLedger:{}}};
  const rows=plain(api.reminderCandidates('2026-10-12T15:30:15+02:00',state,{id:'u1',environment:'testservice'}));
  assert.equal(rows.length,1);
  assert.equal(rows[0].slot,'15:30');
});

test('Benutzereinstellung darf Kanalstandard setzen, aber explizit deaktivierte Task-E-Mail nicht reaktivieren',()=>{
  const api=load();
  const state={
    tasks:[task({reminders:[{time:'09:00',channels:{website:true,email:false}}]})],
    taskSettings:{users:{u1:{reminderChannels:{website:true,email:true}}},reminderLedger:{}}
  };
  const rows=plain(api.reminderCandidates('2026-10-12T09:00:05+02:00',state,{id:'u1',environment:'production'}));
  assert.equal(rows[0].channels.website,true);
  assert.equal(rows[0].channels.email,false);
});

test('Reminder-Key enthält Task, Vorkommen/Tag, Slot, Benutzer und Umgebung',()=>{
  const api=load();
  const key=api.reminderKey(task({occurrenceKey:'series|2026-10-12'}),'2026-10-12','09:00','u1','production');
  assert.equal(key,'t1|series|2026-10-12|2026-10-12|09:00|u1|production');
});

test('bereits ausgelieferter Reminder wird bei Render/Fokus/Sync nicht erneut geliefert',()=>{
  const api=load();
  const t=task({occurrenceKey:'series|2026-10-12',reminders:[{time:'09:00',channels:{website:true,email:false}}]});
  const key=api.reminderKey(t,'2026-10-12','09:00','u1','production');
  const state={tasks:[t],taskSettings:{reminderLedger:{[key]:{deliveredAt:'2026-10-12T09:00:01+02:00'}}}};
  for(const reason of ['render','focus','sync']){
    const rows=api.reminderCandidates('2026-10-12T09:00:30+02:00',state,{id:'u1',environment:'production',reason});
    assert.equal(rows.length,0,reason);
  }
});

test('markReminderDelivered schreibt idempotenten Ledger-Eintrag und persistiert nur beim ersten Mal',()=>{
  const api=load(),state={taskSettings:{reminderLedger:{}}};let saves=0;
  const row={key:'t1|2026-10-12|09:00|u1|production'};
  assert.equal(api.markReminderDelivered(row,{state,persist:()=>saves++,now:'2026-10-12T09:00:01+02:00'}).changed,true);
  assert.equal(api.markReminderDelivered(row,{state,persist:()=>saves++,now:'2026-10-12T09:00:10+02:00'}).changed,false);
  assert.equal(saves,1);
});

test('erledigte, stornierte und fremde Aufgaben erzeugen keine Reminder',()=>{
  const api=load(),state={tasks:[task({id:'done',status:'done'}),task({id:'cancel',status:'cancelled'}),task({id:'other',ownerId:'u2'})],taskSettings:{reminderLedger:{}}};
  assert.equal(api.reminderCandidates('2026-10-12T09:00:00+02:00',state,{id:'u1',environment:'production'}).length,0);
});

test('Nachholen: nach verpasster Zeit kommt pro Aufgabe genau eine Erinnerung für den letzten fälligen Slot',()=>{
  const api=load(),state={tasks:[task()],taskSettings:{reminderLedger:{}}};
  assert.equal(api.reminderCandidates('2026-10-12T14:10:00+02:00',state,{id:'u1'}).length,0,'ohne Nachholen nur zur exakten Minute');
  const rows=plain(api.reminderCandidates('2026-10-12T14:10:00+02:00',state,{id:'u1'},{catchUp:true}));
  assert.equal(rows.length,1);
  assert.equal(rows[0].slot,'13:00');
  assert.equal(rows[0].key,api.reminderKey(task(),'2026-10-12','13:00','u1','production'));
  state.taskSettings.reminderLedger[rows[0].key]={deliveredAt:'2026-10-12T14:10:01+02:00'};
  assert.equal(api.reminderCandidates('2026-10-12T14:40:00+02:00',state,{id:'u1'},{catchUp:true}).length,0,'derselbe Slot kommt nicht noch einmal');
  assert.equal(plain(api.reminderCandidates('2026-10-12T15:31:00+02:00',state,{id:'u1'},{catchUp:true}))[0].slot,'15:30');
  assert.equal(api.reminderCandidates('2026-10-12T08:59:00+02:00',state,{id:'u1'},{catchUp:true}).length,0,'vor 09:00 nichts');
});

test('Nachholen erinnert nur an Aufgaben, die heute oder früher fällig sind, und nicht am Wochenende',()=>{
  const api=load(),state={tasks:[task({id:'today'}),task({id:'late',dueAt:'2026-10-09T16:15:00+02:00'}),task({id:'future',dueAt:'2026-10-20T16:15:00+02:00'}),task({id:'nodate',dueAt:''}),task({id:'snoozed',snoozeUntil:'2026-10-14'})],taskSettings:{reminderLedger:{}}};
  const rows=plain(api.reminderCandidates('2026-10-12T09:05:00+02:00',state,{id:'u1'},{catchUp:true}));
  assert.deepEqual(rows.map(r=>r.taskId).sort(),['late','today']);
  assert.equal(api.reminderCandidates('2026-10-10T09:05:00+02:00',{tasks:[task({dueAt:'2026-10-09T16:15:00+02:00'})]},{id:'u1'},{catchUp:true}).length,0,'Samstag');
});

test('Erinnerungen pro Aufgabe: Slot abschalten und E-Mail gezielt setzen',()=>{
  const api=load(),state={tasks:[task()],taskSettings:{reminderLedger:{}}};let saves=0;
  const ctx={state,persist:()=>saves++,now:'2026-10-12T08:00:00+02:00'};
  assert.deepEqual(plain(api.taskReminderSettings(state.tasks[0])),[{time:'09:00',enabled:true,email:false},{time:'13:00',enabled:true,email:false},{time:'15:30',enabled:true,email:false}]);
  api.toggleTaskReminder('t1','13:00','enabled',ctx);
  api.toggleTaskReminder('t1','09:00','email',ctx);
  const settings=plain(api.taskReminderSettings(state.tasks[0]));
  assert.deepEqual(settings.map(r=>r.enabled),[true,false,true]);
  assert.equal(settings[0].email,true);
  assert.equal(state.tasks[0].history.at(-1).action,'reminders_changed');
  assert.equal(saves,2);
  assert.equal(api.reminderCandidates('2026-10-12T13:00:00+02:00',state,{id:'u1'}).length,0,'abgeschalteter Slot erinnert nicht');
  const nine=plain(api.reminderCandidates('2026-10-12T09:00:00+02:00',state,{id:'u1'}));
  assert.deepEqual(nine[0].channels,{website:true,email:true});
  assert.equal(api.toggleTaskReminder('t1','12:00','enabled',ctx).changed,false,'nur bekannte Slots');
});

test('Ledger wird nach 14 Tagen bereinigt',()=>{
  const api=load(),state={taskSettings:{reminderLedger:{old:{deliveredAt:'2026-09-20T09:00:00+02:00'},fresh:{deliveredAt:'2026-10-11T09:00:00+02:00'}}}};
  assert.equal(api.pruneReminderLedger({state,persist:()=>{},now:'2026-10-12T09:00:00+02:00'}),1);
  assert.deepEqual(Object.keys(state.taskSettings.reminderLedger),['fresh']);
});

function loadRunner(state,user,extra={}){
  const context={console,Date,Intl,setTimeout,clearTimeout,...extra};context.globalThis=context;
  context.__EXPORTHUB_GET_STATE__=()=>state;context.__EXPORTHUB_GET_CURRENT_USER__=()=>user;
  for(const file of ['assets/taskplanner-v2-core.js','assets/taskplanner-v2-recurrence.js','assets/taskplanner-v2-planner.js','assets/taskplanner-v2-ui.js','assets/taskplanner-v2-planner-ui.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  return context;
}

test('Erinnerungs-Runner liefert einmal, schreibt den Ledger in den gemeinsamen Zustand und speichert',()=>{
  const state={tasks:[task({title:'Zollprüfung'})],taskSettings:{}};let saves=0,notes=[];
  class FakeNotification{constructor(title,opts){notes.push({title,opts});}static permission='granted';}
  const ctx=loadRunner(state,{id:'u1'},{Notification:FakeNotification,ExportHUBClean:{queueSave:()=>{saves++;}}});
  const runner=ctx.ExportHUBTaskRemindersV2;
  assert.equal(runner.active(),false,'ohne document kein Autostart');
  const first=runner.check('2026-10-12T13:02:00+02:00');
  assert.equal(first.length,1);
  assert.equal(Object.keys(state.taskSettings.reminderLedger).length,1);
  assert.ok(saves>=1);
  assert.equal(notes.length,1);
  assert.match(notes[0].title,/Zollprüfung/);
  assert.equal(runner.check('2026-10-12T13:03:00+02:00').length,0,'kein zweites Mal');
  assert.equal(state.tasks.length,1,'Ledger-Speichern überschreibt die Aufgaben nicht');
});

test('Erinnerungs-Runner ohne angemeldeten Benutzer tut nichts',()=>{
  const state={tasks:[task()]},ctx=loadRunner(state,{});
  assert.equal(ctx.ExportHUBTaskRemindersV2.check('2026-10-12T13:02:00+02:00').length,0);
  assert.equal(state.taskSettings,undefined);
});

test('Erinnerungshinweis enthält Öffnen und Erledigt pro Aufgabe',()=>{
  const ctx=loadRunner({tasks:[]},{id:'u1'});
  const html=ctx.ExportHUBTaskRemindersV2.toastHtml([{taskId:'t1',title:'A',slot:'09:00',key:'k1'},{taskId:'t2',title:'B',slot:'09:00',key:'k2'},{taskId:'t3',title:'C',slot:'09:00',key:'k3'},{taskId:'t4',title:'D',slot:'09:00',key:'k4'}]);
  assert.match(html,/data-tpv2-reminder-open="t1"/);
  assert.match(html,/data-tpv2-reminder-done="t3"/);
  assert.doesNotMatch(html,/data-tpv2-reminder-open="t4"/);
  assert.match(html,/\+1 more/);
});

test('Build: Benachrichtigungscenter nutzt V2-Erinnerungen und V2-Erledigen, Quelltext passt genau einmal',()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8').replace(/\r\n/g,'\n');
  assert.match(build,/html=patchWorkspaceTaskOwnership\(html,file\);\n\s*html=patchNotificationTaskPlannerV2\(html,file\);/);
  const html=fs.readFileSync('index.html','utf8'),a=html.indexOf('<script id="index236-notification-controller">'),b=html.indexOf('<!-- INDEX 236 NOTIFICATION CENTER END -->',a),block=html.slice(a,b);
  for(const before of [
    "{id:'1200',label:'12:00 Uhr',minutes:720},",
    "{id:'1500',label:'15:00 Uhr',minutes:900}",
    "function checkSchedule(manual){var c=counts();if(manual){showHint(c,'Manuelle Prüfung',true);renderView();return false}",
    "function completeTask(id){var t=findTask(id);if(!t)return false;",
    'ExportHUB erinnert an Arbeitstagen um 09:00, 12:00 und 15:00 Uhr.',
    'Erinnerungen erscheinen um 09:00, 12:00 und 15:00 Uhr, solange ExportHUB geöffnet ist.'
  ]){
    assert.equal(block.split(before).length-1,1,before);
    assert.ok(build.includes(before),before);
  }
  assert.match(build,/ExportHUBTaskRemindersV2\.active\(\)\)\{updateBadge\(\);return false\}/);
  assert.match(build,/v2\.completeTask\(taskId\(t\)/);
});
