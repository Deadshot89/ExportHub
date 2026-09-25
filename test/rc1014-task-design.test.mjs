import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createTestI18n} from './helpers/i18n.mjs';

const read=rel=>fs.readFileSync(rel,'utf8');

function loadRuntime(extra={}){
  const context={ExportHUBI18n:createTestI18n('de'),...extra};
  context.globalThis=context;
  context.setTimeout=fn=>fn();
  context.clearTimeout=()=>{};
  vm.runInNewContext(read('assets/rc1014-task-lifecycle.js'),context,{filename:'lifecycle.js'});
  vm.runInNewContext(read('assets/rc1014-task-runtime.js'),context,{filename:'runtime.js'});
  return {api:context.ExportHUBRC1014TaskRuntime,context};
}

test('RC1014 Aufgaben-Design zeigt Priorität Fälligkeit Verantwortlichen und Öffnen als Text',()=>{
  const runtime=read('assets/rc1014-task-runtime.js');
  for(const key of ['taskDetail.priority','taskDetail.dueLabel','taskDetail.ownerLabel','taskDetail.openTask']) assert.match(runtime,new RegExp(key.replaceAll('.','\\.')));
  assert.match(runtime,/rc1014-task-meta/);
  assert.match(runtime,/data-rc1014-priority|dataset\.rc1014Priority/);
  assert.match(runtime,/data-rc1014-due|dataset\.rc1014Due/);
  assert.match(runtime,/data-rc1014-assignee|dataset\.rc1014Assignee/);
  assert.match(runtime,/data-rc1014-open-task|dataset\.rc1014OpenTask/);
});

test('RC1014 Karten-Enhancer unterstützt den tatsächlich aktiven task-card Renderer',()=>{
  const runtime=read('assets/rc1014-task-runtime.js');
  assert.match(runtime,/\.task-card/,'RC1014 muss neben RC229 auch die aktive task-card Klasse erkennen.');
  assert.match(runtime,/data-rc1014-enhanced/,'aktive Karten müssen nach der Erweiterung eindeutig markiert werden.');
});

test('RC1014 Aufgaben-CSS bleibt auf Aufgaben begrenzt und responsive',()=>{
  const css=read('assets/rc1014-task-ui.css');
  assert.match(css,/\.rc1014-task-meta/);
  assert.match(css,/\.rc1014-priority/);
  assert.match(css,/\.rc1014-due/);
  assert.match(css,/\.rc1014-assignee/);
  assert.match(css,/@media\s*\(max-width:\s*1000px\)/);
  assert.match(css,/@media\s*\(max-width:\s*700px\)/);
  assert.doesNotMatch(css,/width\s*:\s*100vw/);
  assert.doesNotMatch(css,/\.cmr-|#cmr|signature|pod-signature/i);
  assert.match(css,/min-height\s*:\s*var\(--rc990-action-h/);
});

test('RC1014 Build bindet Aufgaben-CSS in alle drei Umgebungen ein und erhält das RC990 Raster',()=>{
  execFileSync(process.execPath,['.github/rc1014/build-three-env.mjs'],{stdio:'pipe'});
  for(const file of ['dist-rc1014/index.html','dist-rc1014/TESTVERSION.html','dist-rc1014/demo.html']){
    const html=read(file);
    assert.match(html,/assets\/rc1014-task-ui\.css\?v=1014/);
    assert.match(html,/rc229-task-grid/);
    assert.match(html,/rc628-unified-task/);
  }
});

test('RC1152 Aufgabenöffnung führt zuerst in die Aufgabenansicht und erhält die Sendungsverknüpfung',()=>{
  const runtime=read('assets/rc1014-task-runtime.js');
  assert.match(runtime,/function\s+openTaskDetail\s*\(/);
  assert.match(runtime,/return\s+openTaskDetail\(\{\.\.\.task,\.\.\.t\},ctx\)/);
  assert.match(runtime,/function\s+openLinkedShipment\s*\(/);
  assert.match(runtime,/linkedShipmentRef/);
  assert.match(runtime,/ExportHUBShipmentView\.open\(target,'tasks'\)/);
  assert.match(runtime,/data-task-action="shipment"/);

  const opened=[];
  const {api}=loadRuntime({openShipment:value=>opened.push(value)});
  const ctx={companyId:'essentra',environment:'production'};
  assert.equal(api.openTask({sourceType:'pick',sourceId:'PICK-1',sourceRef:'ABC123',companyId:'essentra',environment:'production'},ctx),false);
  assert.deepEqual(opened,[],'Aufgabe darf die Sendung nicht mehr direkt überspringen');
});

test('RC1014 Direktöffnung blockiert fremde Firma und Umgebung',()=>{
  const opened=[];
  const {api}=loadRuntime({openShipment:value=>opened.push(value)});
  const ctx={companyId:'essentra',environment:'production'};
  assert.equal(api.openTask({sourceType:'shipment',sourceId:'S1',sourceRef:'ABC123',companyId:'kontur',environment:'production'},ctx),false);
  assert.equal(api.openTask({sourceType:'shipment',sourceId:'S2',sourceRef:'DEF456',companyId:'essentra',environment:'testservice'},ctx),false);
  assert.deepEqual(opened,[]);
});


test('RC1153 Aufgabenansicht bietet Offen In Bearbeitung und Erledigt',()=>{
  const runtime=read('assets/rc1014-task-runtime.js');
  assert.match(runtime,/data-task-action="open"/);
  assert.match(runtime,/data-task-action="in_progress"/);
  assert.match(runtime,/data-task-action="done"/);
  assert.match(runtime,/taskDetail\.status\.inProgress/);
  assert.match(runtime,/function\s+setTaskStatus\s*\(/);
});

test('RC1153 entfernt Altaufgaben wiederholt und behält nur aktuelle Systemquellen',()=>{
  const {api}=loadRuntime();
  const state={
    tasks:[],
    shipments:[{id:'S1',ref:'ABC123',status:'Erstellt'}],
    _teamSyncMeta:{fields:{},tombstones:[{collection:'tasks',id:'legacy-manual',deletedAt:'2026-09-17T08:00:00.000Z'}]},
    rc1152TaskRosterAt:'2026-09-17T08:00:00.000Z'
  };
  const raw=[
    {id:'legacy-manual',title:'Alte Aufgabe',group:'Sonstiges',sourceType:'manual',companyId:'essentra',environment:'production'},
    {id:'stale-pod',title:'POD hochladen',group:'Fehlende POD',sourceType:'pod',sourceId:'S2',sourceRef:'ZZZZZZ',companyId:'essentra',environment:'production'},
    {id:'current-pod',title:'POD hochladen',group:'Fehlende POD',sourceType:'pod',sourceId:'S1',sourceRef:'ABC123',companyId:'essentra',environment:'production'},
    {id:'managed-old',managedBy:'RC1152',managedKey:'wuerth-industrie',title:'Würth Industrie anmelden',group:'Anmeldung',sourceType:'manual',companyId:'essentra',environment:'production'}
  ];
  const result=api.prepareManagedRoster(raw,{state,companyId:'essentra',environment:'production',currentUserId:'tobias',now:'2026-09-18T08:00:00+02:00'});
  assert.equal(result.tasks.some(t=>t.id==='legacy-manual'),false);
  assert.equal(result.tasks.some(t=>t.id==='stale-pod'),false);
  assert.equal(result.tasks.some(t=>t.id==='current-pod'),true);
  assert.equal(result.tasks.some(t=>t.id==='managed-old'),true);
  assert.equal(state._teamSyncMeta.tombstones.some(t=>t.id==='legacy-manual'),true);
  assert.equal(state._teamSyncMeta.tombstones.some(t=>t.id==='stale-pod'),true);
});
