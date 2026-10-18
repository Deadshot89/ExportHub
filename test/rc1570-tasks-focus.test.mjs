import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1570-tasks-focus.js','utf8');
const css=fs.readFileSync('assets/rc1570-tasks-focus.css','utf8').replace(/\r\n/g,'\n');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8').replace(/\r\n/g,'\n');

function load(tasks,user,now){
  const RealDate=Date,fixed=new RealDate(now);
  class FakeDate extends RealDate{constructor(...a){super(...(a.length?a:[fixed.getTime()]))}static now(){return fixed.getTime()}}
  const window={__EXPORTHUB_GET_STATE__:()=>({tasks,users:[]}),__EXPORTHUB_GET_CURRENT_USER__:()=>user,document:null,localStorage:{getItem:()=>null,setItem(){}}};
  vm.runInNewContext(source,{window,Date:FakeDate,Intl,console});
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

test('RC1570 Speichern läuft über den RC524-Editor und markiert neue Aufgaben als manuell',()=>{
  assert.match(source,/w\.rc524OpenTaskEditor\(''\);/);
  assert.match(source,/w\.rc524SaveTask\(\);/);
  assert.match(source,/var patch=\{sourceType:'manual',createdAt:/);
  assert.match(source,/if\(!canWrite\(\)\)\{alert\(t\('noRights'\)\);return\}/);
  assert.match(source,/rt\.renderTaskDetailView\(remembered,\{state:state\(\)\}\)/,'Aufgabenansicht nutzt den RC1152-Detailbildschirm');
});

test('RC1570 Altansicht ausgeblendet, Formular-Rolle am inneren Dialog, Build bindet das Modul ein',()=>{
  assert.match(css,/body\[data-rc1570-tasks="1"\] #content > :not\(#rc1570Tasks\):not\(#rc1569Drill\):not\(\.rc1371-dashboard-toolbar\)\{display:none!important\}/);
  assert.match(source,/<form class="rc1570-dialog" novalidate role="dialog" aria-modal="true"/);
  assert.match(build,/html=injectDeferredRuntimeInHead\(html,RC1570_TASKS_SCRIPT_TAG,'exporthub-rc1570-tasks-script'\);/);
  assert.match(build,/'assets\/rc1570-tasks-focus\.css',\n  'assets\/rc1570-tasks-focus\.js',/);
});
