import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {mergeState}=require('../api/shared/merge.js');

test('Server: eine Feld-Änderung einer Aufgabe behält Titel und Bereich der gespeicherten Aufgabe',()=>{
  const server={tasks:[{id:'M848:mo-p-uk:2026-W43',title:'UK',area:'Picken',owner:'Sevastian',status:'offen',_syncUpdatedAt:'2026-10-20T10:00:00Z',_syncFields:{title:'2026-10-20T10:00:00Z',status:'2026-10-20T10:00:00Z'}}]};
  const delta={tasks:[{id:'M848:mo-p-uk:2026-W43',status:'open',priority:'P4',_syncFields:{status:'2026-10-21T10:00:00Z',priority:'2026-10-21T10:00:00Z'},_syncUpdatedAt:'2026-10-21T10:00:00Z'}]};
  const [task]=mergeState(server,delta).tasks;
  assert.equal(task.title,'UK');
  assert.equal(task.area,'Picken');
  assert.equal(task.owner,'Sevastian');
  assert.equal(task.status,'open');
  assert.equal(task.priority,'P4');
  assert.equal(task._syncFields.title,'2026-10-20T10:00:00Z');
  assert.equal(task._syncFields.status,'2026-10-21T10:00:00Z');
});

test('Server: ein älteres Feld überschreibt kein neueres, eine erledigte Aufgabe bleibt bei Gleichstand erledigt',()=>{
  const server={tasks:[{id:'A',title:'Neu',status:'done',done:true,_syncFields:{title:'2026-10-22T10:00:00Z',status:'2026-10-21T10:00:00Z',done:'2026-10-21T10:00:00Z'},_syncUpdatedAt:'2026-10-22T10:00:00Z'}]};
  const delta={tasks:[{id:'A',title:'Alt',status:'open',done:false,_syncFields:{title:'2026-10-21T09:00:00Z',status:'2026-10-21T10:00:00Z',done:'2026-10-21T10:00:00Z'},_syncUpdatedAt:'2026-10-21T10:00:00Z'}]};
  const [task]=mergeState(server,delta).tasks;
  assert.equal(task.title,'Neu');
  assert.equal(task.status,'done');
  assert.equal(task.done,true);
});

test('Server: eine Feld-Änderung zu einer Aufgabe, die es nicht mehr gibt, wird keine Aufgabe ohne Titel',()=>{
  const merged=mergeState({tasks:[]},{tasks:[
    {id:'gone',v2Priority:'P4',_syncFields:{v2Priority:'2026-10-21T10:00:00Z'},_syncUpdatedAt:'2026-10-21T10:00:00Z'},
    {id:'new',title:'Neue Aufgabe',_syncFields:{id:'2026-10-21T10:00:00Z',title:'2026-10-21T10:00:00Z'},_syncUpdatedAt:'2026-10-21T10:00:00Z'}
  ]});
  assert.deepEqual(merged.tasks.map(t=>t.id),['new']);
});

test('Lifecycle: Wochenplan-Aufgaben bleiben in ihrem Bereich und behalten den Titel',()=>{
  const ctx={window:{},globalThis:null};ctx.globalThis=ctx;
  vm.runInNewContext(fs.readFileSync('assets/rc1014-task-lifecycle.js','utf8'),ctx);
  const api=ctx.ExportHUBRC1014Tasks;
  const pick=api.normalizeTask({id:'M848:mo-p-uk:2026-W43',title:'UK',area:'Picken',masterTaskRC848:true,recurringSeriesId:'MASTER:mo-p-uk'});
  assert.equal(pick.group,'Picken');
  assert.equal(pick.sourceType,'pick');
  const stored=api.normalizeTask({id:'M848:mo-a-x:2026-W43',title:'X',area:'ABD erstellen',group:'Offene Sendungen',masterTaskRC848:true});
  assert.equal(stored.group,'ABD erstellen','schon falsch gespeicherte Gruppe wird korrigiert');
  assert.equal(api.normalizeTask({id:'n',name:'Nur Name'}).title,'Nur Name');
  assert.equal(api.normalizeTask({id:'s',group:'Offene Sendungen',sourceType:'shipment',title:'Sendung'}).group,'Offene Sendungen');
  assert.equal(api.normalizeTask({id:'m',managedBy:'RC1152',sourceType:'manual',group:'Anmeldungen',area:'Anmeldungen',title:'Spanien'}).group,'Anmeldungen');
});

function loadMaster(state){
  const html=fs.readFileSync('index.html','utf8');
  const m=html.match(/<script id="index243-idempotent-task-seed-migration">([\s\S]*?)<\/script>/);
  assert.ok(m,'RC848-Wochenstamm im Quelltext');
  const window={__EXPORTHUB_GET_STATE__:()=>state,addEventListener(){},dispatchEvent(){},ExportHUBClean:{queueSave(){}}};
  const document={readyState:'complete',addEventListener(){}};
  vm.runInNewContext(m[1],{window,document,console,CustomEvent:class{constructor(n,o){this.type=n;this.detail=o&&o.detail}},setTimeout:()=>0});
  return window.ExportHUBTaskMasterRC848;
}

test('Wochenstamm: automatische Lösch-Markierungen schalten Pick-Aufgaben nicht mehr dauerhaft ab',()=>{
  const deletedAt='2026-10-10T00:00:00Z';
  const state={tasks:[],_teamSyncMeta:{fields:{},tombstones:[
    {collection:'tasks',id:'M848:mo-p-uk:2026-W42',deletedAt,deletedBy:'system:RC1107',explicitUserAction:true},
    {collection:'tasks',id:'M848:mo-p-uk:2026-W43',deletedAt,deletedBy:'system:RC1152',explicitUserAction:true},
    {collection:'tasks',id:'M848:mo-p-china-air:2026-W42',deletedAt,deletedBy:'Tobias'}
  ]}};
  const api=loadMaster(state);
  api.ensureWeek('2026-10-21',false);
  const ids=state.tasks.map(t=>t.id);
  assert.ok(ids.includes('M848:mo-p-uk:2026-W43:neu'),'neue ID, damit die alte Lösch-Markierung sie nicht wieder entfernt');
  assert.ok(!ids.some(id=>/mo-p-china-air/.test(id)),'vom Benutzer gelöschte Serie bleibt gelöscht');
  assert.ok(state.tasks.filter(t=>t.area==='Picken').length>30);
});

test('Wochenstamm: Aufgaben ohne Titel aus dem Wochenplan werden wieder aufgefüllt',()=>{
  const state={tasks:[{id:'M848:mo-p-uk:2026-W43',status:'open',priority:'P4',group:'Offene Sendungen',sourceType:'shipment'}],_teamSyncMeta:{fields:{},tombstones:[]}};
  const api=loadMaster(state);
  api.ensureWeek('2026-10-21',false);
  const uk=state.tasks.filter(t=>/^M848:mo-p-uk:/.test(t.id));
  assert.equal(uk.length,1,'keine Dublette');
  assert.equal(uk[0].title,'UK');
  assert.equal(uk[0].area,'Picken');
  assert.equal(uk[0].group,'Picken');
  assert.equal(uk[0].day,'Montag');
  assert.equal(state.tasks.filter(t=>!t.title).length,0);
});

test('Aufgabenliste und Aufgabenansicht werden in Modern, Glass und Neon nicht vom Layout-Wrapper versteckt',()=>{
  const engine=fs.readFileSync('assets/rc1306-layout-engine.js','utf8'),focus=fs.readFileSync('assets/rc1570-tasks-focus.js','utf8');
  assert.match(engine,/if\(featureOwnsLayout\(\)\)\{setMode\(mode==='modern'\?'business':mode\);return\}/);
  assert.match(focus,/section\.className='rc1570-tasks';section\.setAttribute\('data-rc1306-own-layout','1'\);/);
  assert.match(focus,/panel\.className='rc1570-tasks rc1570-taskview';panel\.setAttribute\('data-rc1306-own-layout','1'\);/);
});
