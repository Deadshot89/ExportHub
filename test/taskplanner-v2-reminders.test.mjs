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
