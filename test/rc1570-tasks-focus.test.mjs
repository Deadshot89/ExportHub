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
