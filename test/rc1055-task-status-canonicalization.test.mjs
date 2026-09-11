import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadLifecycle(){
  const context={globalThis:null,Date,console};
  context.globalThis=context;
  vm.runInNewContext(fs.readFileSync('assets/rc1014-task-lifecycle.js','utf8'),context,{filename:'rc1014-task-lifecycle.js'});
  return context.ExportHUBRC1014Tasks;
}

test('RC1055: deutsche Altstatus werden auf den kanonischen Aufgabenstatus normalisiert',()=>{
  const api=loadLifecycle();
  assert.equal(api.normalizeTask({id:'A',title:'Alt offen',status:'Offen'}).status,'open');
  assert.equal(api.normalizeTask({id:'B',title:'Alt erledigt',status:'Erledigt'}).status,'done');
  assert.equal(api.normalizeTask({id:'C',title:'Alt storniert',status:'Storniert'}).status,'cancelled');
});
