import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const lifecycle=fs.readFileSync('assets/rc1014-task-lifecycle.js','utf8');
const runtimeSource=fs.readFileSync('assets/rc1014-task-runtime.js','utf8');

function load(){
  const window={
    addEventListener(){},
    dispatchEvent(){return true;},
    setTimeout(){return 1;},
    clearTimeout(){},
    document:null,
    location:{hostname:'example.azurestaticapps.net',pathname:'/',href:'https://example.azurestaticapps.net/'}
  };
  const sandbox={window,globalThis:window,console,Date,Intl,CustomEvent:function(type,init){this.type=type;this.detail=init&&init.detail;}};
  vm.runInNewContext(lifecycle,sandbox,{filename:'rc1014-task-lifecycle.js'});
  vm.runInNewContext(runtimeSource,sandbox,{filename:'rc1014-task-runtime.js'});
  return window.ExportHUBRC1014TaskRuntime;
}

test('RC1152: Mittwoch erzeugt nur den besprochenen Wochenplan plus Schweizer Bereich und erhält Systemaufgaben',()=>{
  const api=load();
  const state={
    tasks:[
      {id:'ALT-1',title:'Alte Aufgabe die nicht besprochen wurde',sourceType:'manual',status:'open'},
      {id:'SYS-1',title:'POD ABC123 prüfen',group:'Fehlende POD',sourceType:'pod',sourceId:'S-1',sourceRef:'ABC123',linkedShipmentId:'S-1',linkedShipmentRef:'ABC123',status:'open'}
    ],
    shipments:[{id:'S-1',ref:'ABC123',status:'Bereit zur Abholung'}],
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
  const out=api.prepareTasks(state.tasks,{
    companyId:'essentra',environment:'production',currentUserId:'tobias',
    now:'2026-09-16T10:00:00+02:00',state,
    persist(next){state.tasks=next}
  });
  const titles=out.map(t=>t.title);
  for(const title of ['O’Hare anmelden','Essentra Schweden anmelden','Contitech – ABD erstellen','Italien anmelden','BSH anmelden','Schweizer Kunden prüfen','POD ABC123 prüfen']){
    assert.ok(titles.includes(title),title+' fehlt');
  }
  assert.ok(!titles.includes('Alte Aufgabe die nicht besprochen wurde'));
  assert.ok(state.rc1152TaskRosterAt);
  assert.ok(state._teamSyncMeta.tombstones.some(t=>t.collection==='tasks'&&t.id==='ALT-1'));
  const ohare=out.find(t=>t.title==='O’Hare anmelden');
  const bsh=out.find(t=>t.title==='BSH anmelden');
  assert.match(ohare.dueAt,/T12:00:00$/);
  assert.match(bsh.dueAt,/T13:00:00$/);
});

test('RC1152: Donnerstag erzeugt Würth Industrie, Spanien und Polen',()=>{
  const api=load(),state={tasks:[],_teamSyncMeta:{fields:{},tombstones:[]}};
  const out=api.prepareTasks(state.tasks,{companyId:'essentra',environment:'production',currentUserId:'tobias',now:'2026-09-17T10:00:00+02:00',state,persist(next){state.tasks=next}});
  const titles=new Set(out.map(t=>t.title));
  for(const title of ['Würth Industrie anmelden','Spanien anmelden','Polen anmelden','Schweizer Kunden prüfen'])assert.ok(titles.has(title));
  assert.ok(!titles.has('BMP anmelden'));
});

test('RC1152: gezielte Altbereinigung läuft nur einmal und löscht spätere neue manuelle Aufgaben nicht',()=>{
  const api=load(),state={tasks:[],_teamSyncMeta:{fields:{},tombstones:[]}};
  api.prepareTasks(state.tasks,{environment:'production',currentUserId:'tobias',now:'2026-09-17T10:00:00+02:00',state,persist(next){state.tasks=next}});
  state.tasks.push({id:'NEW-MANUAL',title:'Neue manuelle Aufgabe',sourceType:'manual',status:'open'});
  const out=api.prepareTasks(state.tasks,{environment:'production',currentUserId:'tobias',now:'2026-09-17T11:00:00+02:00',state,persist(next){state.tasks=next}});
  assert.ok(out.some(t=>t.id==='NEW-MANUAL'));
});

test('RC1152: Runtime enthält echte Aufgabenansicht statt Direktöffnung der Sendung',()=>{
  assert.match(runtimeSource,/function\s+openTaskDetail\s*\(/);
  assert.match(runtimeSource,/id='rc1152TaskDetail'|panel\.id='rc1152TaskDetail'/);
  assert.match(runtimeSource,/Zurück zu Aufgaben/);
  assert.match(runtimeSource,/Als erledigt markieren/);
  assert.match(runtimeSource,/Zugehörige Sendung/);
  assert.match(runtimeSource,/card\.dataset\.rc1152TaskOpen/);
});

test('RC1152: aktiver RC1112 Build cache-bustet und kopiert Aufgaben-Runtime sowie CSS',()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  assert.match(build,/rc1014-task-runtime\.js\?v=1152/);
  assert.match(build,/rc1014-task-ui\.css\?v=1152/);
  assert.match(build,/'assets\/rc1014-task-runtime\.js'/);
  assert.match(build,/'assets\/rc1014-task-ui\.css'/);
});

test('RC1152: responsive Aufgabenansicht ist im CSS definiert',()=>{
  const css=fs.readFileSync('assets/rc1014-task-ui.css','utf8');
  assert.match(css,/\.rc1152-task-detail/);
  assert.match(css,/\.rc1152-task-grid/);
  assert.match(css,/@media \(max-width:640px\)/);
});
