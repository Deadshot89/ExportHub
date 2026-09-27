import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createTestI18n} from './helpers/i18n.mjs';

const lifecycle=fs.readFileSync('assets/rc1014-task-lifecycle.js','utf8');
const runtimeSource=fs.readFileSync('assets/rc1014-task-runtime.js','utf8');

function load(){
  const window={
    ExportHUBI18n:createTestI18n('de'),
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

test('RC1266: Mittwoch erzeugt den freigegebenen Wochenplan, erhält System- und bestehende manuelle Aufgaben',()=>{
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
  for(const title of ['Italien anmelden','BSH anmelden','O’Hare anmelden','Essentra Schweden anmelden','Contitech – ABD erstellen','Schweizer Kunden prüfen','POD ABC123 prüfen']){
    assert.ok(titles.includes(title),title+' fehlt');
  }
  assert.ok(titles.includes('Alte Aufgabe die nicht besprochen wurde'),'bestehende manuelle Aufgabe darf bei fehlendem Roster-Marker nicht gelöscht werden');
  assert.ok(state.rc1152TaskRosterAt);
  assert.ok(!state._teamSyncMeta.tombstones.some(t=>t.collection==='tasks'&&t.id==='ALT-1'),'manuelle Aufgabe darf keinen Lösch-Tombstone bekommen');
  const ohare=out.find(t=>t.title==='O’Hare anmelden');
  assert.match(ohare.dueAt,/T12:00:00$/);
});

test('RC1312: Donnerstag erzeugt Würth Industrie, Spanien, Polen plus Schweizer Bereich',()=>{
  const api=load(),state={tasks:[],_teamSyncMeta:{fields:{},tombstones:[]}};
  const out=api.prepareTasks(state.tasks,{companyId:'essentra',environment:'production',currentUserId:'tobias',now:'2026-09-17T10:00:00+02:00',state,persist(next){state.tasks=next}});
  const titles=new Set(out.map(t=>t.title));
  for(const title of ['Würth Industrie anmelden','Spanien anmelden','Polen anmelden','Schweizer Kunden prüfen'])assert.ok(titles.has(title));
  assert.ok(!titles.has('BMP anmelden'));
});

test('RC1312: Montag erzeugt Spanien, Gaggenau und FAURECIA',()=>{
  const api=load(),state={tasks:[],_teamSyncMeta:{fields:{},tombstones:[]}};
  const out=api.prepareTasks(state.tasks,{companyId:'essentra',environment:'production',currentUserId:'tobias',now:'2026-09-14T10:00:00+02:00',state,persist(next){state.tasks=next}});
  const titles=new Set(out.map(t=>t.title));
  for(const title of ['Spanien anmelden','Gaggenau anmelden','FAURECIA anmelden','Schweizer Kunden prüfen'])assert.ok(titles.has(title));
  const gaggenau=out.find(t=>t.title==='Gaggenau anmelden');
  assert.match(gaggenau.dueAt,/T13:00:00$/);
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
      {id:'managed:legacy-old:2026-09-16',managedBy:'RC1152',managedKey:'legacy-old',title:'Veraltete Automatik-Aufgabe',sourceType:'manual',status:'open'},
      {id:'NEW-MANUAL',title:'Neue manuelle Aufgabe',sourceType:'manual',status:'open'}
    ],
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
  const out=api.prepareTasks(state.tasks,{environment:'production',currentUserId:'tobias',now:'2026-09-18T10:00:00+02:00',state,persist(next){state.tasks=next}});
  assert.ok(!out.some(t=>t.id==='managed:legacy-old:2026-09-16'));
  assert.ok(out.some(t=>t.id==='NEW-MANUAL'));
  assert.ok(state._teamSyncMeta.tombstones.some(t=>t.collection==='tasks'&&t.id==='managed:legacy-old:2026-09-16'));
});

test('RC1152: gezielte Altbereinigung läuft nur einmal und löscht spätere neue manuelle Aufgaben nicht',()=>{
  const api=load(),state={tasks:[],_teamSyncMeta:{fields:{},tombstones:[]}};
  api.prepareTasks(state.tasks,{environment:'production',currentUserId:'tobias',now:'2026-09-17T10:00:00+02:00',state,persist(next){state.tasks=next}});
  state.tasks.push({id:'NEW-MANUAL',title:'Neue manuelle Aufgabe',sourceType:'manual',status:'open'});
  const out=api.prepareTasks(state.tasks,{environment:'production',currentUserId:'tobias',now:'2026-09-17T11:00:00+02:00',state,persist(next){state.tasks=next}});
  assert.ok(out.some(t=>t.id==='NEW-MANUAL'));
});


test('RC1266: fehlender Roster-Marker darf vorhandene manuelle Aufgaben nicht löschen',()=>{
  const api=load(),state={
    tasks:[{id:'KEEP-MANUAL',title:'Manuelle Aufgabe behalten',sourceType:'manual',status:'open',owner:'tobias'}],
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
  const out=api.prepareTasks(state.tasks,{companyId:'essentra',environment:'production',currentUser:{user:'tobias'},now:'2026-09-24T10:00:00+02:00',state,persist(next){state.tasks=next}});
  assert.ok(out.some(t=>t.id==='KEEP-MANUAL'),'manuelle Aufgabe wurde fälschlich entfernt');
  assert.ok(!state._teamSyncMeta.tombstones.some(t=>t.collection==='tasks'&&t.id==='KEEP-MANUAL'),'manuelle Aufgabe darf keinen Lösch-Tombstone bekommen');
  assert.ok(out.some(t=>t.title==='Würth Industrie anmelden'),'Donnerstags-Aufgabe muss selbstheilend vorhanden sein');
  assert.ok(out.some(t=>t.title==='Schweizer Kunden prüfen'),'Schweizer Bereich muss selbstheilend vorhanden sein');
});

test('RC1266: Benutzerkennung user und State-Kontext werden für Aufgaben übernommen',()=>{
  const api=load(),state={companyId:'essentra',environment:'production',currentUser:{user:'tobias'},tasks:[],_teamSyncMeta:{fields:{},tombstones:[]}};
  const out=api.prepareTasks(state.tasks,{currentUser:state.currentUser,now:'2026-09-24T10:00:00+02:00',state,persist(next){state.tasks=next}});
  const managed=out.find(t=>t.title==='Würth Industrie anmelden');
  assert.ok(managed);
  assert.equal(managed.owner,'tobias');
  assert.equal(managed.companyId,'essentra');
  assert.equal(managed.environment,'production');
});

test('RC1152: Runtime enthält echte Aufgabenansicht statt Direktöffnung der Sendung',()=>{
  assert.match(runtimeSource,/function\s+openTaskDetail\s*\(/);
  assert.match(runtimeSource,/id='rc1152TaskDetail'|panel\.id='rc1152TaskDetail'/);
  assert.match(runtimeSource,/taskDetail\.backToTasks/);
  assert.match(runtimeSource,/taskDetail\.markDone/);
  assert.match(runtimeSource,/taskDetail\.relatedShipment/);
  assert.match(runtimeSource,/data\.rc1152TaskOpen/);
});

test('RC1312: aktiver RC1112 Build cache-bustet Aufgaben-Reiter und Runtime',()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  assert.match(build,/rc1014-task-runtime\.js\?v=1312/);
  assert.match(build,/rc1014-task-ui\.css\?v=1312/);
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
  assert.doesNotMatch(runtimeSource,/sessionStorage\.setItem\([^)]*task/i);
  assert.match(runtimeSource,/history\.replaceState/);
  assert.match(runtimeSource,/exporthubTaskId/);
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


test('RC1312: Freitag erzeugt Italien, Frankreich und Neff',()=>{
  const api=load(),state={tasks:[],_teamSyncMeta:{fields:{},tombstones:[]}};
  const out=api.prepareTasks(state.tasks,{companyId:'essentra',environment:'production',currentUserId:'tobias',now:'2026-09-18T10:00:00+02:00',state,persist(next){state.tasks=next}});
  const titles=new Set(out.map(t=>t.title));
  for(const title of ['Italien anmelden','Frankreich anmelden','Neff anmelden','Schweizer Kunden prüfen'])assert.ok(titles.has(title),title+' fehlt');
  const neff=out.find(t=>t.title==='Neff anmelden');
  assert.match(neff.dueAt,/T13:00:00$/);
});

test('RC1312: kompletter hinterlegter Aufgabenstamm ist im Runtime-Vertrag vorhanden',()=>{
  for(const key of ['spanien','gaggenau','faurecia','wuerth-industrie','bmp','italien','bsh','ohare','essentra-schweden','contitech-abd','polen','frankreich','neff','swiss-area']){
    assert.ok(runtimeSource.includes("key:'"+key+"'"),key+' fehlt');
  }
});


test('RC1312: hinterlegte Aufgaben sind unabhängig vom Wochentag als persönlicher Wochenplan abrufbar',()=>{
  const api=load();
  const items=api.managedTaskPlanItems({currentUserId:'tobias',now:'2026-09-27T20:30:00+02:00'});
  assert.equal(items.length,14);
  const byKey=new Map(items.map(item=>[item.key,item]));
  assert.match(byKey.get('spanien').schedule,/Montag.*Donnerstag/);
  assert.match(byKey.get('gaggenau').schedule,/13:00/);
  assert.match(byKey.get('ohare').schedule,/12:00/);
  assert.match(byKey.get('neff').schedule,/13:00/);
  assert.equal(byKey.get('swiss-area').referenceArea,true);
  assert.deepEqual(Array.from(byKey.get('swiss-area').checklist),['Omni Ray','Bossard','Heizmann']);
});

test('RC1312: Aufgabenansicht rendert sichtbaren hinterlegten Wochenplan und ist mobil responsiv',()=>{
  assert.match(runtimeSource,/function\s+renderManagedTaskPlan\s*\(/);
  assert.match(runtimeSource,/rc1307ManagedTaskPlan/);
  assert.match(runtimeSource,/taskPlan\.title/);
  assert.match(runtimeSource,/currentView\(\)!==['"]tasks['"]/);
  const css=fs.readFileSync('assets/rc1014-task-ui.css','utf8');
  assert.match(css,/\.rc1307-managed-task-plan/);
  assert.match(css,/\.rc1307-task-plan-grid/);
  assert.match(css,/@media \(max-width:640px\)[\s\S]*\.rc1307-task-plan-grid\{grid-template-columns:1fr\}/);
});

test('RC1312: neue Aufgabenbezeichnungen sind in allen aktiven Sprachen vorhanden',()=>{
  for(const language of ['de','en','pl','es','fr','it']){
    const json=JSON.parse(fs.readFileSync('assets/i18n/'+language+'.json','utf8'));
    for(const key of ['taskManaged.gaggenau.title','taskManaged.faurecia.title','taskManaged.italien.title','taskManaged.bsh.title','taskManaged.polen.title','taskManaged.frankreich.title','taskManaged.neff.title','taskPlan.title','taskPlan.help']){
      assert.ok(String(json[key]||'').trim(),language+': '+key+' fehlt');
    }
  }
});


test('RC1312: Aufgabenplan folgt der tatsächlich sichtbaren Aufgabenansicht',()=>{
  assert.match(runtimeSource,/body\.getAttribute\('data-exporthub-view'\)/);
  assert.match(runtimeSource,/mutation\.attributeName==='data-exporthub-view'/);
  assert.match(runtimeSource,/attributeFilter:target===doc\.body\?\['data-exporthub-view'\]/);
});


test('RC1312: persönlicher hinterlegter Wochenplan wird nicht anderen Benutzern zugeordnet',()=>{
  const api=load();
  assert.equal(api.managedOwnerMatches({currentUserId:'tobias'}),true);
  assert.equal(api.managedOwnerMatches({currentUser:{id:'USER-Tobias',user:'Tobias'}}),true);
  assert.equal(api.managedOwnerMatches({currentUserId:'daniel'}),false);
  assert.equal(api.managedTaskPlanItems({currentUserId:'daniel',now:'2026-09-28T10:00:00+02:00'}).length,0);
  const state={tasks:[],_teamSyncMeta:{fields:{},tombstones:[]}};
  const out=api.prepareTasks(state.tasks,{companyId:'essentra',environment:'production',currentUserId:'daniel',now:'2026-09-28T10:00:00+02:00',state,persist(next){state.tasks=next}});
  assert.ok(!out.some(t=>t.managedBy==='RC1152'),'persönliche Tobias-Aufgaben dürfen für andere Benutzer nicht erzeugt werden');
});


test('RC1312: wiederkehrende persönliche Aufgabe bleibt nach Erledigung am selben Tag erledigt und entsteht beim nächsten Termin neu',async()=>{
  const api=load();
  const state={tasks:[],_teamSyncMeta:{fields:{},tombstones:[]}};
  const persist=next=>{state.tasks=next};
  let out=api.prepareTasks(state.tasks,{companyId:'essentra',environment:'production',currentUserId:'tobias',now:'2026-09-28T09:00:00+02:00',state,persist});
  const first=out.find(t=>t.id==='managed:gaggenau:2026-09-28');
  assert.ok(first,'Montags-Aufgabe Gaggenau fehlt');
  assert.equal(first.status,'open');

  assert.equal(await api.setTaskStatus(first,'in_progress',{state,currentUserId:'tobias',persist}),true);
  assert.equal(state.tasks.find(t=>t.id===first.id).status,'in_progress');

  assert.equal(await api.setTaskStatus(state.tasks.find(t=>t.id===first.id),'done',{state,currentUserId:'tobias',persist}),true);
  const done=state.tasks.find(t=>t.id===first.id);
  assert.equal(done.status,'done');
  assert.equal(done.done,true);
  assert.ok(done.completedAt);

  out=api.prepareTasks(state.tasks,{companyId:'essentra',environment:'production',currentUserId:'tobias',now:'2026-09-28T14:00:00+02:00',state,persist});
  assert.equal(out.filter(t=>t.id===first.id).length,1,'Erledigte Tagesaufgabe darf am selben Tag nicht neu erzeugt werden');
  assert.equal(out.find(t=>t.id===first.id).status,'done');

  out=api.prepareTasks(state.tasks,{companyId:'essentra',environment:'production',currentUserId:'tobias',now:'2026-10-05T09:00:00+02:00',state,persist});
  const next=out.find(t=>t.id==='managed:gaggenau:2026-10-05');
  assert.ok(next,'Gaggenau muss am nächsten Montag als neue Aufgabe entstehen');
  assert.equal(next.status,'open');
  assert.notEqual(next.id,first.id);
});
