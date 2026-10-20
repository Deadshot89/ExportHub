import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createTestI18n} from './helpers/i18n.mjs';

const lifecycle=fs.readFileSync('assets/rc1014-task-lifecycle.js','utf8');
const runtimeSource=fs.readFileSync('assets/rc1014-task-runtime.js','utf8');

function load(){
  const window={ExportHUBI18n:createTestI18n('de'),addEventListener(){},dispatchEvent(){return true;},setTimeout(){return 1;},clearTimeout(){},document:null,
    location:{hostname:'example.azurestaticapps.net',pathname:'/',href:'https://example.azurestaticapps.net/'}};
  const sandbox={window,globalThis:window,console,Date,Intl,CustomEvent:function(type,init){this.type=type;this.detail=init&&init.detail;}};
  vm.runInNewContext(lifecycle,sandbox,{filename:'rc1014-task-lifecycle.js'});
  vm.runInNewContext(runtimeSource,sandbox,{filename:'rc1014-task-runtime.js'});
  return window.ExportHUBRC1014TaskRuntime;
}

test('RC1568 Wochenplan-Aufgaben in Systemgruppen ohne Sendungsbezug werden nicht gelöscht und nicht als gelöscht markiert',()=>{
  const api=load();
  const weekly=[
    {id:'M848:mo-sendungen:2026-W42',title:'Offene Sendungen prüfen',group:'Offene Sendungen',day:'Montag',recurrence:'weekly',masterTaskRC848:true,weeklySeriesId:'mo-sendungen',owner:'Sevastian',status:'open'},
    {id:'M848:di-picks:2026-W42',title:'Picks bearbeiten',group:'Picks',day:'Dienstag',recurrence:'weekly',seriesId:'di-picks',owner:'Tobias',status:'open'},
    {id:'M848:mi-abd:2026-W42',title:'ABDs anfordern',group:'Offene ABDs',day:'Mittwoch',masterSourceId:'mi-abd',owner:'Tobias',status:'open'},
    {id:'M848:do-kunde:2026-W42',title:'Kunde anmelden',group:'Kunde angemeldet',day:'Donnerstag',recurrence:'biweekly',owner:'Sevastian',status:'open'}
  ];
  const stale={id:'SYS-OLD',title:'POD XYZ999 prüfen',group:'Fehlende POD',sourceType:'pod',sourceId:'S-GONE',sourceRef:'XYZ999',status:'open'};
  const state={tasks:[...weekly,stale],shipments:[],rc1152TaskRosterAt:'2026-10-01T00:00:00Z',_teamSyncMeta:{fields:{},tombstones:[]}};
  const out=api.prepareTasks(state.tasks,{companyId:'essentra',environment:'production',currentUserId:'sevastian',now:'2026-10-18T10:00:00+02:00',state,persist(next){state.tasks=next}});
  const ids=new Set(out.map(t=>t.id));
  for(const t of weekly)assert.ok(ids.has(t.id),t.id+' wurde entfernt');
  const tomb=state._teamSyncMeta.tombstones.map(t=>t.id);
  for(const t of weekly)assert.ok(!tomb.includes(t.id),t.id+' hat einen Lösch-Tombstone bekommen');
  assert.ok(!ids.has('SYS-OLD'),'veraltete Sendungs-Aufgabe ohne Sendung wird weiterhin bereinigt');
  assert.ok(tomb.includes('SYS-OLD'));
});

test('RC1568 einmalige Aufgaben ohne Serie bleiben Systemaufgaben',()=>{
  const api=load();
  const state={tasks:[{id:'SYS-2',title:'Offene Sendung ABC',group:'Offene Sendungen',recurrence:'einmalig',sourceType:'shipment',sourceRef:'ABC123',status:'open'}],shipments:[],rc1152TaskRosterAt:'2026-10-01T00:00:00Z',_teamSyncMeta:{fields:{},tombstones:[]}};
  const out=api.prepareTasks(state.tasks,{companyId:'essentra',environment:'production',currentUserId:'sevastian',now:'2026-10-18T10:00:00+02:00',state,persist(next){state.tasks=next}});
  assert.ok(!out.some(t=>t.id==='SYS-2'),'einmalige Sendungs-Aufgabe ohne Sendung wird bereinigt');
});
