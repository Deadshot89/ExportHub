import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1570-tasks-focus.js','utf8');
const texts=fs.readFileSync('assets/i18n/rc1570-tasks-focus.js','utf8');
const css=fs.readFileSync('assets/rc1570-tasks-focus.css','utf8').replace(/\r\n/g,'\n');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8').replace(/\r\n/g,'\n');

function load(tasks,user,now){
  const RealDate=Date,fixed=new RealDate(now);
  class FakeDate extends RealDate{constructor(...a){super(...(a.length?a:[fixed.getTime()]))}static now(){return fixed.getTime()}}
  const window={__EXPORTHUB_GET_STATE__:()=>({tasks,users:[]}),__EXPORTHUB_GET_CURRENT_USER__:()=>user,document:null,localStorage:{getItem:()=>null,setItem(){}}};
  const ctx={window,Date:FakeDate,Intl,console};vm.runInNewContext(texts,ctx);vm.runInNewContext(source,ctx);
  return window.ExportHUBTasksFocus1570;
}
const me={id:'U-1',name:'Tobias Limberg',user:'tobias'};
const ids=rows=>Array.from(rows,r=>r.id);

test('RC1570 Überfällig, Heute, Rest der Woche, Später und ohne Datum werden richtig einsortiert',()=>{
  // Mittwoch, 14.10.2026
  const api=load([
    {id:'mo',title:'Montagsaufgabe',day:'Montag',weekKey:'2026-W42',owner:'Tobias'},
    {id:'mi',title:'Mittwochsaufgabe',day:'Mittwoch',weekKey:'2026-W42',owner:'Tobias'},
    {id:'fr',title:'Freitagsaufgabe',day:'Freitag',weekKey:'2026-W42',owner:'Tobias'},
    {id:'due',title:'Mit Datum heute',dueAt:'2026-10-14T08:00:00',assignedTo:'U-1'},
    {id:'next',title:'Nächste Woche',dueDate:'2026-10-21',owner:'Tobias'},
    {id:'none',title:'Ohne Datum',owner:'Tobias'},
    {id:'done',title:'Erledigt',day:'Montag',weekKey:'2026-W42',owner:'Tobias',done:true,completedAt:'2026-10-14T07:00:00'},
    {id:'tpl',title:'Vorlage',isTemplate:true,owner:'Tobias'}
  ],me,'2026-10-14T10:00:00');
  const m=api.buildModel();
  assert.deepEqual(ids(m.overdue),['mo']);
  assert.deepEqual(ids(m.today).sort(),['due','mi']);
  assert.deepEqual(Object.keys(m.week),['2026-10-16']);
  assert.deepEqual(ids(m.later),['next']);
  assert.deepEqual(ids(m.none),['none']);
  assert.deepEqual(ids(m.doneToday),['done']);
  assert.equal(m.total,6,'erledigte und Vorlagen zählen nicht als offen');
});

test('RC1570 Meine Aufgaben erkennt ID, Name und Vertretung; fremde Aufgaben nur unter Alle',()=>{
  const api=load([],me,'2026-10-14T10:00:00');
  assert.equal(api.isMine({assignedTo:'U-1'}),true);
  assert.equal(api.isMine({owner:'Tobias'}),true);
  assert.equal(api.isMine({owner:'Sevastian'}),false);
  assert.equal(api.isMine({owner:'U-1',effectiveAssignee:'U-9'}),false,'bei Vertretung zählt die Vertretung');
  assert.equal(api.isMine({owner:'Alle'}),true);
});

test('RC1570 neue Wochenaufgabe ohne Planwoche liegt auf dem nächsten passenden Tag, nie in der Vergangenheit',()=>{
  const api=load([],me,'2026-10-18T10:00:00'); // Sonntag
  const d=api.taskDate({day:'Mittwoch'});
  assert.equal(d.getDate(),21);
  assert.equal(api.taskDate({day:'Sonntag'}).getDate(),18);
});

test('RC1570 Ansicht: Abhaken, Öffnen, Bearbeiten, neue Aufgabe; nur dringende Prioritäten als Markierung',()=>{
  const api=load([{id:'a',title:'ABD <prüfen>',dueDate:'2026-10-13',owner:'Tobias',priority:'P1'},{id:'b',title:'Bericht',dueDate:'2026-10-14',owner:'Tobias',priority:'P4'}],me,'2026-10-14T10:00:00');
  const html=api.renderHtml(api.buildModel());
  assert.match(html,/data-rc1570-toggle="a"/);
  assert.match(html,/data-rc1570-open="a"/);
  assert.match(html,/data-rc1570-edit="a"/);
  assert.match(html,/data-rc1570-new="1"/);
  assert.match(html,/ABD &lt;prüfen&gt;/,'Titel werden escaped');
  assert.match(html,/data-p="P1"/);
  assert.doesNotMatch(html,/data-p="P4"/);
  assert.match(html,/data-rc1570-section="overdue"/);
});

test('RC1570 Aufgabenansicht speichert direkt in state.tasks, neue Aufgaben sind manuell, Rechte werden geprüft',()=>{
  assert.doesNotMatch(source,/rc524OpenTaskEditor|rc524SaveTask/,'kein Umweg mehr über den alten RC524-Editor');
  assert.match(source,/task=\{id:'task-'\+Date\.now\(\)\.toString\(36\)/);
  assert.match(source,/sourceType:'manual',createdAt:/);
  assert.match(source,/function openForm\(\)\{if\(!canWrite\(\)\)\{alert\(t\('noRights'\)\);return\}/);
  assert.match(source,/<form class="rc1570-tv-form" novalidate data-rc1570-tv-form="1">/);
  assert.match(source,/if\(v==='taskdetail'&&root\)\{/);
});

test('RC1570 Aufgabenansicht: Kunde und Kundennummer werden gespeichert, Termin und Zuständig in alle Alias-Felder',()=>{
  const api=load([],me,'2026-10-14T10:00:00');
  const task=api.applyForm({},{title:'Würth picken',area:'Picken',owner:'Tobias',weekly:false,date:'2026-10-16',weekday:5,time:'09:30',priority:'P2',status:'open',customer:'Würth',customerNo:'3019105826',ref:'AB12CD',note:'Rampe 3'},true);
  assert.equal(task.title,'Würth picken');assert.equal(task.name,'Würth picken');
  assert.equal(task.customerName,'Würth');assert.equal(task.linkedCustomer,'Würth');
  assert.equal(task.customerNumber,'3019105826');assert.equal(task.linkedAccount,'3019105826');
  assert.equal(task.dueDate,'2026-10-16');assert.equal(task.plannedDate,'2026-10-16');assert.equal(task.dueAt,'2026-10-16T09:30:00');
  assert.equal(task.day,'Freitag');assert.equal(task.owner,'Tobias');assert.equal(task.effectiveAssignee,'Tobias');
  assert.equal(task.linkedShipmentRef,'AB12CD');assert.equal(task.status,'open');
  const weekly=api.applyForm({id:'w',title:'Alt',dueDate:'2026-10-14',weekKey:'2026-W42'},{title:'UK',area:'Picken',owner:'',weekly:true,date:'',weekday:1,time:'',priority:'Normal',status:'done',customer:'',customerNo:'',ref:'',note:''},false);
  assert.equal(weekly.day,'Montag');assert.equal(weekly.recurrence,'weekly');assert.equal(weekly.dueDate,'');
  assert.equal(weekly.done,true);assert.equal(weekly.status,'done');
});

test('RC1570 Aufgabenansicht zeigt Liste, Detail und Formular mit Kundenfeldern',()=>{
  const api=load([{id:'a',title:'ABD <prüfen>',dueDate:'2026-10-14',owner:'Tobias',customerName:'Kunde A',customerNumber:'K-1'},{id:'x',owner:'Tobias',status:'open'}],me,'2026-10-14T10:00:00');
  let html=api.taskViewHtml();
  assert.match(html,/data-rc1570-tv-open="a"/);
  assert.doesNotMatch(html,/data-rc1570-tv-open="x"/,'Aufgaben ohne Titel erscheinen nicht');
  api.openTask('a');html=api.taskViewHtml();
  assert.match(html,/data-rc1570-tv-task="a"/);assert.match(html,/K-1/);assert.match(html,/ABD &lt;prüfen&gt;/);
  api.editTask('a');html=api.taskViewHtml();
  assert.match(html,/name="customer"/);assert.match(html,/name="customerNo"[^>]*value="K-1"/);assert.match(html,/name="status"/);
  api.openForm();html=api.taskViewHtml();
  assert.match(html,/name="title" required[^>]*value=""/);
});

test('RC1570 Texte liegen in der Sprachdatei, alle sechs Sprachen haben dieselben Schlüssel',()=>{
  const window={};vm.runInNewContext(texts,{window});
  const packs=window.ExportHUBTasksFocus1570I18n.packs,keys=Object.keys(packs.de).sort();
  for(const l of ['en','pl','es','fr','it'])assert.deepEqual(Object.keys(packs[l]).sort(),keys,l);
  assert.equal(window.ExportHUBTasksFocus1570I18n.days.de[3],'Mittwoch');
  assert.doesNotMatch(source,/Neue Aufgabe|Was ist zu tun/,'keine deutschen Texte im Modul-Code');
  assert.ok(build.indexOf("RC1570_TASKS_I18N_TAG,'exporthub-rc1570-tasks-i18n'")>0&&build.indexOf("RC1570_TASKS_I18N_TAG,'exporthub-rc1570-tasks-i18n'")<build.indexOf("RC1570_TASKS_SCRIPT_TAG,'exporthub-rc1570-tasks-script'"),'Sprachdatei vor dem Modul');
  assert.match(build,/'assets\/i18n\/rc1570-tasks-focus\.js',/);
});

test('RC1570 Heute ist nach Arbeitsgruppen wie in der alten Liste gruppiert, Karten bleiben erhalten',()=>{
  const day={day:'Mittwoch',weekKey:'2026-W42',owner:'Tobias'};
  const api=load([
    {id:'abd',title:'ABD prüfen',area:'Zoll',...day},
    {id:'pick',title:'Ware picken',area:'Lager',...day},
    {id:'avis',title:'Avis an Spedition',area:'Versand',...day},
    {id:'pod',title:'POD anfordern',area:'Versand',pickedUp:true,...day},
    {id:'podok',title:'POD anfordern',area:'Versand',pickedUp:true,podUrl:'x',...day},
    {id:'ship',title:'Sendung vorbereiten',area:'Versand',...day}
  ],me,'2026-10-14T10:00:00');
  assert.equal(api.workGroup({title:'MRN eintragen'}),'abds');
  assert.equal(api.workGroup({area:'Pickup',title:'Abholung'}),'shipments','Pickup ist kein Pick');
  assert.equal(api.workGroup({area:'Aufträge kontrollieren',title:'Aufträge prüfen'}),'check');
  assert.equal(api.workGroup({area:'Zusatzaufgaben',title:'Etiketten drucken'}),'extra');
  assert.equal(api.workGroup({title:'POD fehlt',requiresPod:true,pickedUp:true}),'pod','Fehlende POD bleibt erhalten');
  const html=api.renderHtml(api.buildModel(),new Date('2026-10-14T10:00:00'));
  const order=[...html.matchAll(/data-rc1570-group="(\w+)"/g)].map(m=>m[1]);
  assert.deepEqual(order,['shipments','pod','customer','picks','abds']);
  assert.match(html,/<h4>Fehlende POD <span>1<\/span><\/h4><ul class="rc1570-cards"><li class="rc1570-card" data-rc1570-task="pod">/);
  assert.match(html,/<h4>Offene Sendungen <span>2<\/span>/);
  assert.match(source,/function card\(r,opts\)\{/);
  assert.match(source,/function cards\(rows,opts\)\{/);
  assert.doesNotMatch(source,/areaBlocks|byArea/);
});

test('RC1570 Filter kombinieren Kunde, Bereich, Prozess, Priorität, Status, Zuständig und Zeitraum',()=>{
  const api=load([
    {id:'a',title:'ABD Kunde A',customerName:'Kunde A',area:'Export',processId:'abd',priority:'P1',status:'open',dueDate:'2026-10-14',owner:'Tobias'},
    {id:'b',title:'Pick Kunde B',customerName:'Kunde B',area:'Lager',processId:'pick',priority:'P2',status:'in_progress',dueDate:'2026-10-14',owner:'Tobias'},
    {id:'c',title:'Alt Kunde A',customerName:'Kunde A',area:'Export',processId:'abd',priority:'P1',status:'blocked',dueDate:'2026-10-12',owner:'Tobias'},
    {id:'d',title:'Später Kunde A',customerName:'Kunde A',area:'Export',priority:'P3',status:'open',dueDate:'2026-10-30',owner:'Tobias'}
  ],me,'2026-10-14T10:00:00');
  let m=api.buildModel();
  assert.deepEqual([...m.filterOptions.customer],['Kunde A','Kunde B']);
  assert.deepEqual([...m.filterOptions.process],['abd','pick']);
  api.setFilter('customer','Kunde A');
  m=api.buildModel();
  assert.deepEqual(ids(m.today),['a']);assert.deepEqual(ids(m.overdue),['c']);assert.deepEqual(ids(m.later),['d']);
  assert.deepEqual([...m.filterOptions.customer],['Kunde A','Kunde B'],'Optionen bleiben trotz Filter wählbar');
  api.setFilter('priority','P1');
  m=api.buildModel();
  assert.equal(m.total,2);
  api.setFilter('status','blocked');
  m=api.buildModel();
  assert.deepEqual(ids(m.overdue),['c']);assert.equal(m.today.length,0);
  api.resetFilters();
  api.setFilter('period','today');
  m=api.buildModel();
  assert.deepEqual(ids(m.today).sort(),['a','b']);
  assert.equal(m.overdue.length+m.later.length+m.none.length,0);
  assert.equal(m.total,2);
  api.resetFilters();api.setFilter('process','pick');
  assert.deepEqual(ids(api.buildModel().today),['b']);
  api.resetFilters();
});

test('RC1570 Filterleiste rendert nur sinnvolle Auswahlen und einen Zurücksetzen-Button',()=>{
  const api=load([
    {id:'a',title:'Aufgabe A',area:'Export',priority:'P1',status:'open',dueDate:'2026-10-14',owner:'Tobias'}
  ],me,'2026-10-14T10:00:00');
  let html=api.renderHtml(api.buildModel());
  assert.match(html,/data-rc1570-filter="area"/);
  assert.match(html,/data-rc1570-filter="priority"/);
  assert.match(html,/data-rc1570-filter="status"/);
  assert.match(html,/data-rc1570-filter="period"/);
  assert.doesNotMatch(html,/data-rc1570-filter="customer"/,'ohne Kunden kein Kundenfilter');
  assert.doesNotMatch(html,/data-rc1570-filter="owner"/,'Zuständig nur bei Alle Aufgaben');
  assert.doesNotMatch(html,/data-rc1570-filter-reset/);
  api.setFilter('area','Lager');
  html=api.renderHtml(api.buildModel());
  assert.match(html,/data-rc1570-filter-reset/);
  assert.match(html,/Keine Treffer/);
  assert.match(html,/<option value="Lager" selected>/);
  api.resetFilters();
});

test('RC1570 Filtertexte existieren in allen sechs Sprachen',()=>{
  const ctx={window:{}};vm.runInNewContext(texts,ctx);
  const packs=ctx.window.ExportHUBTasksFocus1570I18n.packs;
  for(const l of ['de','en','pl','es','fr','it'])for(const k of ['filters','filterAll','filterReset','filter_customer','filter_area','filter_process','filter_priority','filter_status','filter_owner','filter_period','stOpen','stInProgress','stBlocked'])assert.ok(packs[l][k],l+':'+k);
});

test('RC1570 Aufgabenansicht entfernt den Listen-Fokus, sonst blendet das CSS die Detailansicht aus',()=>{
  const start=source.indexOf("if(v==='taskdetail'&&root){");
  const branch=source.slice(start,source.indexOf('var rt=w.ExportHUBRC1014TaskRuntime;',start));
  assert.match(branch,/removeAttribute\(BODY_FLAG\)/);
  assert.match(branch,/getElementById\(SECTION_ID\)/);
});


/* RC1811: real task-view form writes must be confirmed, not merely queued. */
function editorHarness(tasks,flushSave,runtime){
  const store={tasks,users:[],taskSeries:[]},calls=[];
  const win={
    __EXPORTHUB_GET_STATE__:()=>store,
    __EXPORTHUB_GET_CURRENT_USER__:()=>me,
    document:null,
    localStorage:{getItem:()=>null,setItem(){}},
    ExportHUBClean:{
      queueSave(reason){calls.push(['queue',reason]);return true},
      flushSave(reason,opts){calls.push(['flush',reason,opts]);return flushSave(reason,opts)},
      operationStatus(){}
    }
  };
  if(runtime)win.ExportHUBRC1014TaskRuntime=runtime;
  const context={window:win,Date,Intl,console:{...console,error(){}}};
  vm.runInNewContext(texts,context);
  vm.runInNewContext(source,context);
  return{api:win.ExportHUBTasksFocus1570,store,calls};
}
function editorForm(overrides={}){
  const vals={title:'Neue Beschreibung',area:'Versand',owner:'Tobias',date:'2026-11-09',time:'10:00',priority:'P1',
    status:'open',customer:'Testkunde',customerNo:'1001',ref:'REF1001',note:'Bearbeitung'};
  Object.assign(vals,overrides);
  const fields=Object.fromEntries(Object.entries(vals).map(([k,v])=>[k,{value:v}]));
  fields.autoDone={checked:true};
  const error={hidden:true,textContent:''},submit={disabled:false};
  return{
    elements:fields,error,submit,
    querySelector(selector){
      if(selector==='[name="repeat"]:checked')return{value:overrides.weekly?'weekly':'once'};
      if(selector==='[type="submit"]')return submit;
      if(selector==='.rc1570-error')return error;
      return null;
    },
    querySelectorAll(selector){return selector==='[name="weekdays"]:checked'?(overrides.weekdays||[]).map(value=>({value})):[]}
  };
}
test('RC1811: editing preserves unrelated tasks and reports success only after confirmed flush',async()=>{
  const{api,store,calls}=editorHarness([
    {id:'a',title:'Aufgabe A',owner:'Tobias',status:'open'},
    {id:'b',title:'Aufgabe B',owner:'Tobias',status:'open'}
  ],()=>true);
  api.editTask('a');
  const result=await api._saveForm(editorForm());
  assert.equal(result,true);
  assert.equal(store.tasks.length,2);
  assert.equal(store.tasks.find(row=>row.id==='a').title,'Neue Beschreibung');
  assert.equal(store.tasks.find(row=>row.id==='b').title,'Aufgabe B');
  assert.equal(calls.length,2);
  assert.equal(calls[0][0],'queue');
  assert.equal(calls[1][0],'flush');
  assert.equal(calls[1][2].force,true);
  assert.equal(api._tv.mode,'show');
  assert.match(api.taskViewHtml(),/data-rc1570-tv-open="b"/);
});
test('RC1811: rejected flush rolls back all task and series changes and preserves the form',async()=>{
  const tasks=[{id:'a',title:'Unverändert',owner:'Tobias',status:'open'},{id:'b',title:'Andere Aufgabe',owner:'Tobias'}];
  const{api,store}=editorHarness(tasks,()=>false);
  api.editTask('a');
  const form=editorForm();
  const result=await api._saveForm(form);
  assert.equal(result,false);
  assert.strictEqual(store.tasks,tasks);
  assert.equal(tasks[0].title,'Unverändert');
  assert.equal(store.tasks[1].title,'Andere Aufgabe');
  assert.equal(api._tv.mode,'edit');
  assert.equal(form.error.hidden,false);
  assert.equal(form.submit.disabled,false);
  assert.equal(api._tv.saved,'');
});
test('RC1811: weekly master and completed entries stay visible in management list',async()=>{
  const{api,store}=editorHarness([
    {id:'w',title:'Wiederkehrend',owner:'Tobias',sourceType:'manual',status:'open'},
    {id:'d',title:'Erledigt aber verwaltbar',owner:'Tobias',status:'done',done:true}
  ],()=>true);
  api.editTask('w');
  const result=await api._saveForm(editorForm({weekly:true,weekdays:[1,3],date:''}));
  assert.equal(result,true);
  assert.equal(store.tasks.find(row=>row.id==='w').isTemplate,true);
  const html=api.taskViewHtml();
  assert.match(html,/data-rc1570-tv-open="w"/);
  assert.match(html,/data-rc1570-tv-open="d"/);
});
test('RC1811: detail status action confirms server flush and rolls back on failure',async()=>{
  let permitted=true;
  const{api,store}=editorHarness([{id:'s',title:'Statusaufgabe',owner:'Tobias',status:'open'}],()=>permitted);
  api.openTask('s');
  assert.equal(await api._changeTaskStatus('done'),true);
  assert.equal(store.tasks[0].status,'done');
  assert.equal(store.taskStatusLedger['id:s'].done,true);
  const before=store.tasks;
  permitted=false;
  assert.equal(await api._changeTaskStatus('open'),false);
  assert.strictEqual(store.tasks,before);
  assert.equal(store.tasks[0].status,'done');
  assert.equal(store.taskStatusLedger['id:s'].done,true);
});


test('RC1811: edited task has a fresh sync timestamp so server merge cannot prefer old data',async()=>{
  const{api,store}=editorHarness([{id:'m',title:'Vorher',owner:'Tobias',status:'open',
    updatedAt:'2026-11-01T10:00:00.000Z',_syncUpdatedAt:'2026-11-01T10:00:00.000Z'}],()=>true);
  api.editTask('m');
  assert.equal(await api._saveForm(editorForm({status:'done'})),true);
  const task=store.tasks[0];
  assert.equal(task.status,'done');
  assert.equal(task.title,'Neue Beschreibung');
  assert.equal(task._syncUpdatedAt,task.updatedAt);
  assert.equal(task.statusUpdatedAt,task.updatedAt);
  assert.equal(store.taskStatusLedger['id:m'].done,true);
});


test('Aufgabenansicht: persönlicher kompletter Bestand und Überfälligkeit nach POD, AV, Sendung',()=>{
  const tasks=[
    {id:'pod',title:'POD fehlt',group:'Fehlende POD',dueDate:'2026-11-05',owner:'Tobias'},
    {id:'av',title:'AV hochladen',sourceType:'av_missing',group:'Ausgangsvermerk',dueDate:'2026-11-06',owner:'Tobias'},
    {id:'shipment',title:'Offene Sendung',group:'Offene Sendungen',dueDate:'2026-11-07',owner:'Tobias'},
    {id:'weekly',title:'Kontrolle Montag',recurrence:'weekly',dueDate:'2026-11-09',owner:'Tobias'},
    {id:'once',title:'Einzelaufgabe',dueDate:'2026-11-10',owner:'Tobias'},
    {id:'done',title:'Schon erledigt',status:'done',done:true,owner:'Tobias'},
    {id:'other',title:'Fremde Aufgabe',owner:'Sevastian',dueDate:'2026-11-08'}
  ];
  const api=load(tasks,me,'2026-11-09T08:45:00');
  const roster=api.managedRows();
  assert.equal(roster.counts.all,6,'Meine Aufgaben umfassen auch erledigte und einmalige');
  assert.equal(roster.counts.overdue,3);
  assert.equal(roster.counts.weekly,1);
  assert.equal(roster.counts.once,5);
  assert.equal(roster.counts.done,1);
  assert.deepEqual(ids(api.buildModel().overdue),['pod','av','shipment']);
  assert.equal(api.workGroup(tasks[1]),'av','AV ist keine Kundenavisierung');
  const html=api.taskViewHtml();
  assert.match(html,/data-rc1570-tv-kind="overdue"/);
  assert.match(html,/data-rc1570-tv-kind="weekly"/);
  assert.match(html,/data-rc1570-tv-kind="once"/);
  assert.match(html,/data-rc1570-tv-kind="done"/);
  assert.doesNotMatch(html,/data-rc1570-tv-open="other"/,'Standardansicht zeigt persönliche Aufgaben');
});

test('Aufgabenansicht: nicht nach 200 Aufgaben abschneiden; stückweise alle laden',()=>{
  const tasks=Array.from({length:245},(_,i)=>({id:'t'+i,title:'Aufgabe '+i,owner:'Tobias',sourceType:'manual'}));
  const api=load(tasks,me,'2026-11-09T08:45:00');
  let html=api.taskViewHtml();
  assert.match(html,/data-rc1570-tv-more="1"/);
  assert.match(html,/245 Aufgaben/);
  assert.doesNotMatch(html,/data-rc1570-tv-open="t244"/);
  api._tv.moreCount=300;
  html=api.taskViewHtml();
  assert.match(html,/data-rc1570-tv-open="t244"/);
  assert.doesNotMatch(html,/data-rc1570-tv-more="1"/);
});

test('Aufgabenansicht: manuelle Einzelaufgabe dauerhaft löschen und serverseitig quittieren',async()=>{
  const {api,store,calls}=editorHarness([
    {id:'manual1',title:'Einmalig',owner:'Tobias',sourceType:'manual',dueDate:'2026-11-09'},
    {id:'manual2',title:'Bleibt erhalten',owner:'Tobias',sourceType:'manual'}
  ],()=>true);
  assert.equal(await api._deleteManagedTask('manual1'),true);
  assert.deepEqual(store.tasks.map(x=>x.id),['manual2']);
  assert.equal(store._teamSyncMeta.tombstones[0].collection,'tasks');
  assert.equal(store._teamSyncMeta.tombstones[0].id,'manual1');
  assert.equal(store._teamSyncMeta.tombstones[0].explicitUserAction,true);
  assert.equal(calls[1][0],'flush');
  assert.equal(calls[1][2].userInitiated,true);
});

test('Aufgabenansicht: wenn Speichern fehlschlägt, Löschung vollständig zurückrollen',async()=>{
  const tasks=[{id:'manual1',title:'Bleibt',sourceType:'manual',owner:'Tobias'}];
  const {api,store}=editorHarness(tasks,()=>false);
  const before=store.tasks;
  assert.equal(await api._deleteManagedTask('manual1'),false);
  assert.strictEqual(store.tasks,before);
  assert.strictEqual(store._teamSyncMeta,undefined);
});

test('Aufgabenansicht: manuelle Wochenserie samt Instanzen und Stammsatz entfernen',async()=>{
  const sid='rc1570-series:abc';
  const {api,store}=editorHarness([
    {id:'abc',title:'Wochenstamm',sourceType:'manual',seriesId:sid,isTemplate:true,owner:'Tobias'},
    {id:'occ1',title:'Diese Woche',sourceType:'manual',seriesId:sid,owner:'Tobias'},
    {id:'occ2',title:'Nächste Woche',sourceType:'manual',seriesId:sid,owner:'Tobias'},
    {id:'other',title:'Bleibt',sourceType:'manual',owner:'Tobias'}
  ],()=>true);
  store.taskSeries=[{id:sid,rule:{type:'weekly',weekdays:[1]}}];
  assert.equal(await api._deleteManagedTask('occ1'),true);
  assert.deepEqual(store.tasks.map(x=>x.id),['other']);
  assert.equal(store.taskSeries.length,0);
  assert.equal(store._teamSyncMeta.tombstones.filter(x=>x.collection==='tasks').length,3);
  assert.equal(store._teamSyncMeta.tombstones.filter(x=>x.collection==='taskSeries').length,1);
});

test('Aufgabenansicht: echte Pflichtaufgaben bleiben geschützt statt unbemerkt zu verschwinden',async()=>{
  const tasks=[
    {id:'task:av-missing:ABC123',title:'AV fehlt',sourceType:'av_missing',owner:'Tobias'},
    {id:'pod1',title:'POD fehlt',group:'Fehlende POD',owner:'Tobias'},
    {id:'sys1',title:'Offene Sendung',group:'Offene Sendungen',owner:'Tobias'}
  ];
  const {api,store}=editorHarness(tasks,()=>true);
  for(const x of tasks)assert.equal(await api._deleteManagedTask(x.id),false);
  assert.strictEqual(store.tasks,tasks);
  assert.match(api.taskViewHtml(),/data-rc1570-tv-open="pod1"/);
  assert.doesNotMatch(api.taskViewHtml(),/data-rc1570-tv-delete="pod1"/);
});


test('Aufgabenansicht: verwaltete Wochenroutine dauerhaft abschalten, nicht nur Tagesinstanz löschen',async()=>{
  const {api,store}=editorHarness([
    {id:'managed:wuerth-industrie:2026-11-10',title:'Würth Industrie',managedBy:'RC1152',managedKind:'recurring',managedKey:'wuerth-industrie',sourceType:'manual',owner:'Tobias'},
    {id:'managed:wuerth-industrie:2026-11-12',title:'Würth Industrie',managedBy:'RC1152',managedKind:'recurring',managedKey:'wuerth-industrie',sourceType:'manual',owner:'Tobias'},
    {id:'manual',title:'Manuell',sourceType:'manual',owner:'Tobias'}
  ],()=>true);
  assert.equal(api.managedRows().counts.weekly,2);
  assert.equal(await api._deleteManagedTask('managed:wuerth-industrie:2026-11-10'),true);
  assert.deepEqual(store.tasks.map(x=>x.id),['manual']);
  assert.ok(store.taskManagedDisabled['wuerth-industrie'].disabledAt);
  assert.equal(store._teamSyncMeta.tombstones.filter(x=>x.collection==='tasks').length,2);
});


test('Aufgabenansicht: alle Wochenstämme auch ohne Instanz an einem anderen Wochentag sichtbar und löschbar',async()=>{
  const runtime={managedTaskPlanItems:({state})=>state.taskManagedDisabled&&state.taskManagedDisabled['wuerth-industrie']?[]:[
    {key:'wuerth-industrie',title:'Würth Industrie',group:'Anmeldung',weekdays:[2,4],dueTime:'13:00'}
  ]};
  const {api,store}=editorHarness([{id:'manual',title:'Einmalig',owner:'Tobias',sourceType:'manual'}],()=>true,runtime);
  assert.equal(api.managedRows().counts.weekly,1,'Wochenregel ohne heute erzeugte Instanz sichtbar');
  let html=api.taskViewHtml();
  assert.match(html,/data-rc1570-tv-open="managed:template:wuerth-industrie"/);
  assert.match(html,/data-rc1570-tv-delete="managed:template:wuerth-industrie"/);
  assert.equal(await api._deleteManagedTask('managed:template:wuerth-industrie'),true);
  assert.ok(store.taskManagedDisabled['wuerth-industrie'].disabledAt);
  assert.deepEqual(store.tasks.map(t=>t.id),['manual']);
  assert.equal(api.managedRows().counts.weekly,0,'dauerhaft abgeschaltete Serie ist nicht wieder sichtbar');
});


test('Aufgabenansicht: V2 Wochenserie erscheint ohne heutige Instanz und wird vollständig deaktiviert',async()=>{
  const {api,store}=editorHarness([{id:'remain',title:'Einmalig',sourceType:'manual',owner:'Tobias'}],()=>true);
  store.taskSeries=[{id:'series-uk',title:'UK anmelden',owner:'Tobias',rule:{type:'weekly',weekdays:[1,4]},task:{sourceType:'manual'}}];
  const html=api.taskViewHtml();
  assert.match(html,/data-rc1570-tv-open="series:template:series-uk"/);
  assert.match(html,/data-rc1570-tv-delete="series:template:series-uk"/);
  assert.equal(api.managedRows().counts.weekly,1);
  assert.equal(await api._deleteManagedTask('series:template:series-uk'),true);
  assert.equal(store.taskSeries.length,0);
  assert.deepEqual(store.tasks.map(t=>t.id),['remain']);
  assert.ok(store._teamSyncMeta.tombstones.some(t=>t.collection==='taskSeries'&&t.id==='series-uk'));
  assert.equal(api.managedRows().counts.weekly,0);
});

test('Aufgabenansicht: Wochenstamm kann weder als Tagesinstanz erledigt noch fälschlich bearbeitet werden',async()=>{
  const {api,store}=editorHarness([],
    ()=>true,{managedTaskPlanItems:()=>[{key:'sweden',title:'Schweden anmelden',weekdays:[3]}]});
  const html=api.taskViewHtml();
  assert.match(html,/data-rc1570-tv-open="managed:template:sweden"/);
  api.openTask('managed:template:sweden');
  const detail=api.taskViewHtml();
  assert.doesNotMatch(detail,/data-rc1570-tv="edit"/);
  assert.doesNotMatch(detail,/data-rc1570-tv-status="done"/);
  assert.equal(await api._changeTaskStatus('done'),false);
  assert.equal(store.tasks.length,0);
});


test('Aufgaben: POD wird nach expliziter Systemgruppe klassifiziert, auch wenn Bereich Versand lautet',()=>{
  const api=load([],me,'2026-11-09T08:45:00');
  assert.equal(api.workGroup({title:'POD fehlt',area:'Versand',group:'Fehlende POD',status:'offen'}),'pod');
  assert.equal(api.workGroup({title:'POD hochgeladen',area:'Versand',group:'Fehlende POD',status:'done',podUrl:'x'}),'pod');
  assert.equal(api.workGroup({title:'AV hochladen',area:'Versand',sourceType:'av_missing'}),'av');
});


test('RC1985: identical shipment tasks count once in dashboard but remain reviewable in management',()=>{
  const tasks=[
    {id:'legacy',title:'AV hochladen',group:'Ausgangsvermerk',sourceType:'av_missing',
      linkedShipmentRef:'ABC123',dueDate:'2026-11-11',status:'offen',owner:'Tobias'},
    {id:'complete',title:'AV hochladen',group:'Ausgangsvermerk',sourceType:'av_missing',
      linkedShipmentRef:'ABC123',customerNumber:'100200',dueDate:'2026-11-11',status:'offen',owner:'Tobias'},
    {id:'different-action',title:'ABD erstellen',group:'Ausgangsvermerk',sourceType:'av_missing',
      linkedShipmentRef:'ABC123',dueDate:'2026-11-11',status:'offen',owner:'Tobias'},
    {id:'different-day',title:'AV hochladen',group:'Ausgangsvermerk',sourceType:'av_missing',
      linkedShipmentRef:'ABC123',dueDate:'2026-11-12',status:'offen',owner:'Tobias'}
  ];
  const {api}=editorHarness(tasks,()=>true);
  const summary=api.buildModel(new Date('2026-11-11T10:00:00'));
  assert.equal(summary.total,3,'only the exact same process, date and owner is collapsed');
  assert.deepEqual(Array.from(summary.today,x=>x.id),['complete','different-action']);
  assert.equal(api.managedRows().rows.length,4,'no stored task was deleted or hidden from management');
  assert.match(api.taskViewHtml(),/Doppelter Eintrag/);
});

test('RC1985: customer number is read only from an unambiguous linked shipment',()=>{
  const tasks=[
    {id:'auto',title:'AV hochladen',sourceType:'av_missing',linkedShipmentRef:'ABC123',owner:'Tobias'},
    {id:'cleared',title:'AV hochladen',sourceType:'av_missing',linkedShipmentRef:'ABC123',customerNumber:'',owner:'Tobias'},
    {id:'manual',title:'Eigene Aufgabe',sourceType:'manual',linkedShipmentRef:'ABC123',owner:'Tobias'}
  ];
  const {api,store}=editorHarness(tasks,()=>true);
  store.shipments=[{id:'S1',ref:'ABC123',customerAccount:'471100',customerName:'Testkunde'}];
  api.openTask('auto');
  assert.match(api.taskViewHtml(),/471100/);
  assert.equal(Object.prototype.hasOwnProperty.call(store.tasks[0],'customerNumber'),false,'no inferred number persisted');
  api.openTask('cleared');
  assert.doesNotMatch(api.taskViewHtml(),/471100/,'explicit removal is not silently undone');
  store.savedShipments=[{id:'S2',ref:'ABC123',customerAccount:'SOMEONE-ELSE'}];
  api.openTask('auto');
  assert.doesNotMatch(api.taskViewHtml(),/471100/,'ambiguous shipment links do not infer a customer');
});

test('RC1985: creation of exact duplicate manual shipment task is rejected without a save',async()=>{
  const existing=[{id:'manual-old',title:'Neue Beschreibung',area:'Versand',sourceType:'manual',
    owner:'Tobias',linkedShipmentRef:'ABC123',dueDate:'2026-11-09',status:'open'}];
  const {api,store,calls}=editorHarness(existing,()=>true);
  api._tv.mode='new';api._tv.id='';
  assert.equal(await api._saveForm(editorForm({ref:'ABC123'})),false);
  assert.equal(store.tasks.length,1);
  assert.equal(calls.length,0,'duplicate must not reach the server');
  assert.match(api._tv.error,/existiert/);
});

test('RC1985: distinct process, date or reference is not treated as duplicate',async()=>{
  const {api,store}=editorHarness([{id:'manual-old',title:'Neue Beschreibung',area:'Versand',
    sourceType:'manual',owner:'Tobias',linkedShipmentRef:'ABC123',dueDate:'2026-11-08'}],()=>true);
  api._tv.mode='new';api._tv.id='';
  assert.equal(await api._saveForm(editorForm({ref:'ABC123'})),true,'different day is a separate task');
  assert.equal(store.tasks.length,2);
});

test('RC1985: redundant system-generated task may be deleted while canonical AV duty survives',async()=>{
  const source=[
    {id:'task:av-missing:ABC123',title:'AV hochladen',sourceType:'av_missing',
      group:'Ausgangsvermerk',linkedShipmentRef:'ABC123',owner:'Tobias',dueDate:'2026-11-11',status:'offen'},
    {id:'legacy-av-ABC123',title:'AV hochladen',sourceType:'av_missing',
      group:'Ausgangsvermerk',linkedShipmentRef:'ABC123',owner:'Tobias',dueDate:'2026-11-11',status:'offen'}
  ];
  const {api,store,calls}=editorHarness(source,()=>true);
  const before=api.taskViewHtml();
  assert.match(before,/data-rc1570-tv-delete="legacy-av-ABC123"/);
  assert.doesNotMatch(before,/data-rc1570-tv-delete="task:av-missing:ABC123"/);
  assert.equal(await api._deleteManagedTask('task:av-missing:ABC123'),false,'cannot remove canonical obligation');
  assert.equal(await api._deleteManagedTask('legacy-av-ABC123'),true,'redundant system entry can be removed');
  assert.deepEqual(store.tasks.map(x=>x.id),['task:av-missing:ABC123']);
  assert.equal(store._teamSyncMeta.tombstones[0].id,'legacy-av-ABC123');
  assert.deepEqual(calls.map(x=>x[0]),['queue','flush']);
  assert.equal(await api._deleteManagedTask('task:av-missing:ABC123'),false,'last duty stays protected');
});

test('RC1985: different system activity cannot be deleted as a supposed duplicate',async()=>{
  const tasks=[
    {id:'av',title:'AV hochladen',sourceType:'av_missing',group:'Ausgangsvermerk',
      linkedShipmentRef:'ABC123',owner:'Tobias',dueDate:'2026-11-11',status:'offen'},
    {id:'abd',title:'ABD erstellen',sourceType:'abd',group:'Ausgangsvermerk',
      linkedShipmentRef:'ABC123',owner:'Tobias',dueDate:'2026-11-11',status:'offen'}
  ];
  const {api,store}=editorHarness(tasks,()=>true);
  assert.equal(await api._deleteManagedTask('av'),false);
  assert.equal(await api._deleteManagedTask('abd'),false);
  assert.strictEqual(store.tasks,tasks);
});

test('RC1985: two different shipment IDs with the same REF cannot be merged or deleted',async()=>{
  const base={title:'AV hochladen',sourceType:'av_missing',group:'Ausgangsvermerk',
    linkedShipmentRef:'ABC123',owner:'Tobias',dueDate:'2026-11-11',status:'offen'};
  const tasks=[{...base,id:'a',linkedShipmentId:'S1'},{...base,id:'b',linkedShipmentId:'S2'}];
  const {api,store}=editorHarness(tasks,()=>true);
  assert.equal(api.buildModel(new Date('2026-11-11T10:00:00')).total,2);
  assert.equal(await api._deleteManagedTask('a'),false);
  assert.equal(await api._deleteManagedTask('b'),false);
  assert.strictEqual(store.tasks,tasks);
});

test('RC1985: an empty legacy customer cannot bridge conflicting customer accounts',async()=>{
  const base={title:'AV hochladen',sourceType:'av_missing',group:'Ausgangsvermerk',
    linkedShipmentRef:'ABC123',owner:'Tobias',dueDate:'2026-11-11',status:'offen'};
  const tasks=[{...base,id:'empty'}, {...base,id:'first',customerNumber:'A100'},
    {...base,id:'second',customerNumber:'B200'}];
  const {api,store}=editorHarness(tasks,()=>true);
  assert.equal(await api._deleteManagedTask('empty'),false);
  assert.equal(await api._deleteManagedTask('first'),false);
  assert.equal(await api._deleteManagedTask('second'),false);
  assert.strictEqual(store.tasks,tasks);
});
