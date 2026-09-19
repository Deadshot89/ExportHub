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
  for(const title of ['O’Hare anmelden','Essentra Schweden anmelden','Contitech – ABD erstellen','Schweizer Kunden prüfen','POD ABC123 prüfen']){
    assert.ok(titles.includes(title),title+' fehlt');
  }
  for(const title of ['Italien anmelden','BSH anmelden','Gaggenau anmelden','FAURECIA anmelden','Polen anmelden','Frankreich anmelden','Neff anmelden'])assert.ok(!titles.includes(title),title+' darf nicht mehr automatisch erzeugt werden');
  assert.ok(!titles.includes('Alte Aufgabe die nicht besprochen wurde'));
  assert.ok(state.rc1152TaskRosterAt);
  assert.ok(state._teamSyncMeta.tombstones.some(t=>t.collection==='tasks'&&t.id==='ALT-1'));
  const ohare=out.find(t=>t.title==='O’Hare anmelden');
  assert.match(ohare.dueAt,/T12:00:00$/);
});

test('RC1156: Donnerstag erzeugt nur Würth Industrie plus Schweizer Bereich',()=>{
  const api=load(),state={tasks:[],_teamSyncMeta:{fields:{},tombstones:[]}};
  const out=api.prepareTasks(state.tasks,{companyId:'essentra',environment:'production',currentUserId:'tobias',now:'2026-09-17T10:00:00+02:00',state,persist(next){state.tasks=next}});
  const titles=new Set(out.map(t=>t.title));
  for(const title of ['Würth Industrie anmelden','Schweizer Kunden prüfen'])assert.ok(titles.has(title));
  for(const title of ['Spanien anmelden','Polen anmelden','BMP anmelden'])assert.ok(!titles.has(title));
});

test('RC1156: Montag erzeugt Spanien nur montags und keine alten Automatik-Aufgaben',()=>{
  const api=load(),state={tasks:[],_teamSyncMeta:{fields:{},tombstones:[]}};
  const out=api.prepareTasks(state.tasks,{companyId:'essentra',environment:'production',currentUserId:'tobias',now:'2026-09-14T10:00:00+02:00',state,persist(next){state.tasks=next}});
  const titles=new Set(out.map(t=>t.title));
  assert.ok(titles.has('Spanien anmelden'));
  assert.ok(titles.has('Schweizer Kunden prüfen'));
  for(const title of ['Gaggenau anmelden','FAURECIA anmelden','Italien anmelden','BSH anmelden','Polen anmelden','Frankreich anmelden','Neff anmelden'])assert.ok(!titles.has(title));
});

test('RC1156: Dienstag erzeugt Würth Industrie und BMP',()=>{
  const api=load(),state={tasks:[],_teamSyncMeta:{fields:{},tombstones:[]}};
  const out=api.prepareTasks(state.tasks,{companyId:'essentra',environment:'production',currentUserId:'tobias',now:'2026-09-15T10:00:00+02:00',state,persist(next){state.tasks=next}});
  const titles=new Set(out.map(t=>t.title));
  for(const title of ['Würth Industrie anmelden','BMP anmelden','Schweizer Kunden prüfen'])assert.ok(titles.has(title));
  assert.ok(!titles.has('Spanien anmelden'));
});

test('RC1156: nicht mehr freigegebene frühere Managed-Aufgaben werden auch nach der Erstbereinigung entfernt',()=>{
  const api=load(),state={
    rc1152TaskRosterAt:'2026-09-17T08:00:00.000Z',
    tasks:[
      {id:'managed:bsh:2026-09-16',managedBy:'RC1152',managedKey:'bsh',title:'BSH anmelden',sourceType:'manual',status:'open'},
      {id:'NEW-MANUAL',title:'Neue manuelle Aufgabe',sourceType:'manual',status:'open'}
    ],
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
  const out=api.prepareTasks(state.tasks,{environment:'production',currentUserId:'tobias',now:'2026-09-18T10:00:00+02:00',state,persist(next){state.tasks=next}});
  assert.ok(!out.some(t=>t.id==='managed:bsh:2026-09-16'));
  assert.ok(out.some(t=>t.id==='NEW-MANUAL'));
  assert.ok(state._teamSyncMeta.tombstones.some(t=>t.collection==='tasks'&&t.id==='managed:bsh:2026-09-16'));
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
  assert.match(runtimeSource,/data\.rc1152TaskOpen/);
});

test('RC1179: aktiver RC1112 Build cache-bustet Aufgaben-Reiter und Runtime',()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  assert.match(build,/rc1014-task-runtime\.js\?v=1179/);
  assert.match(build,/rc1014-task-ui\.css\?v=1179/);
  assert.match(build,/taskdetail/);
  assert.match(build,/Aufgabenansicht/);
  assert.match(build,/right:['"]tasks['"]/);
  assert.match(build,/renderTaskDetailView/);
  assert.match(build,/'assets\/rc1014-task-runtime\.js'/);
  assert.match(build,/'assets\/rc1014-task-ui\.css'/);
});

test('RC1152: responsive Aufgabenansicht ist im CSS definiert',()=>{
  const css=fs.readFileSync('assets/rc1014-task-ui.css','utf8');
  assert.match(css,/\.rc1152-task-detail/);
  assert.match(css,/\.rc1152-task-grid/);
  assert.match(css,/@media \(max-width:640px\)/);
});


test('RC1179: Aufgabenöffnung wechselt in den eigenen Aufgabenansicht-Reiter und merkt die Aufgabe für Reload',()=>{
  assert.match(runtimeSource,/TASK_DETAIL_STORAGE='exporthub_rc1179_task_detail'/);
  assert.match(runtimeSource,/rememberTaskDetail\(t\)/);
  assert.match(runtimeSource,/root\.setView\('taskdetail'\)/);
  assert.match(runtimeSource,/function\s+renderTaskDetailView\s*\(/);
  assert.match(runtimeSource,/rememberedTask\(mergedCtx\)/);
  assert.match(runtimeSource,/data-rc1179-task-view/);
});

test('RC1179: Aufgabenansicht ist kein Vollbild-Overlay mehr',()=>{
  const css=fs.readFileSync('assets/rc1014-task-ui.css','utf8');
  assert.match(css,/RC1179 Aufgabenansicht als eigener Reiter/);
  assert.match(css,/\.rc1152-task-detail\{[\s\S]*position:relative/);
  assert.doesNotMatch(css,/\.rc1152-task-detail\{[\s\S]{0,160}position:fixed/);
});
