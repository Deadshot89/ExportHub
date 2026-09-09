import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const read=rel=>fs.readFileSync(rel,'utf8');

function loadRuntime(extra={}){
  const context={...extra};
  context.globalThis=context;
  context.setTimeout=fn=>fn();
  context.clearTimeout=()=>{};
  vm.runInNewContext(read('assets/rc1014-task-lifecycle.js'),context,{filename:'lifecycle.js'});
  vm.runInNewContext(read('assets/rc1014-task-runtime.js'),context,{filename:'runtime.js'});
  return {api:context.ExportHUBRC1014TaskRuntime,context};
}

test('RC1014 Aufgaben-Design zeigt Priorität Fälligkeit Verantwortlichen und Öffnen als Text',()=>{
  const runtime=read('assets/rc1014-task-runtime.js');
  for(const label of ['Priorität','Fällig','Verantwortlich','Öffnen']) assert.match(runtime,new RegExp(label,'i'));
  assert.match(runtime,/rc1014-task-meta/);
  assert.match(runtime,/data-rc1014-priority|dataset\.rc1014Priority/);
  assert.match(runtime,/data-rc1014-due|dataset\.rc1014Due/);
  assert.match(runtime,/data-rc1014-assignee|dataset\.rc1014Assignee/);
  assert.match(runtime,/data-rc1014-open-task|dataset\.rc1014OpenTask/);
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

test('RC1014 Direktöffnung verwendet für Pick POD und ABD die Sendungsreferenz',()=>{
  const opened=[];
  const {api}=loadRuntime({openShipment:value=>opened.push(value)});
  const ctx={companyId:'essentra',environment:'production'};
  assert.equal(api.openTask({sourceType:'pick',sourceId:'PICK-1',sourceRef:'ABC123',companyId:'essentra',environment:'production'},ctx),true);
  assert.equal(api.openTask({sourceType:'pod',sourceId:'S1',sourceRef:'DEF456',companyId:'essentra',environment:'production'},ctx),true);
  assert.equal(api.openTask({sourceType:'abd',sourceId:'S2',sourceRef:'GHI789',companyId:'essentra',environment:'production'},ctx),true);
  assert.deepEqual(opened,['ABC123','DEF456','GHI789']);
});

test('RC1014 Direktöffnung blockiert fremde Firma und Umgebung',()=>{
  const opened=[];
  const {api}=loadRuntime({openShipment:value=>opened.push(value)});
  const ctx={companyId:'essentra',environment:'production'};
  assert.equal(api.openTask({sourceType:'shipment',sourceId:'S1',sourceRef:'ABC123',companyId:'kontur',environment:'production'},ctx),false);
  assert.equal(api.openTask({sourceType:'shipment',sourceId:'S2',sourceRef:'DEF456',companyId:'essentra',environment:'testservice'},ctx),false);
  assert.deepEqual(opened,[]);
});
