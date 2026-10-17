import test from 'node:test';
import assert from 'node:assert/strict';

const stale={number:'SOP-EH-060',title:'ABD alt',version:'1.0',currentVersion:'1.0',status:'Freigegeben',sections:{steps:[]},versions:[{version:'1.0',status:'Freigegeben',title:'ABD alt',content:{steps:[]},visuals:[]}]};
const storedBsh={number:'SOP-CUST-BSH-001',title:'BSH lokal',type:'customer',category:'customer',group:'BSH-Gruppe',version:'1.1',currentVersion:'1.1',status:'Freigegeben',sections:{steps:[]},versions:[{version:'1.1',status:'Freigegeben',title:'BSH lokal',content:{steps:[]},visuals:[]}],auditTrail:[]};
const staleOverlay={number:'SOP-CUST-OLD-001',title:'Alt-Overlay',type:'customer',baseSopNumber:'SOP-EH-060',customerId:'OLD',version:'1.0',currentVersion:'1.0',status:'Freigegeben',sections:{steps:[]},versions:[{version:'1.0',status:'Freigegeben',title:'Alt-Overlay',content:{steps:[]},visuals:[]}]};
const state={isoSops:[stale,storedBsh,staleOverlay]};
const saves=[];
globalThis.__EXPORTHUB_GET_STATE__=()=>state;
globalThis.save=reason=>{saves.push(reason);return true;};

await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1550-sop-active-catalog.js');
await import('../assets/sop/rc1550-sop-runtime.js');

const runtime=globalThis.ExportHubRc1550SopRuntime;

test('RC1550: Runtime entfernt Legacy-SOPs und verwaiste Overlays aus state.isoSops',()=>{
  assert.ok(runtime);
  assert.deepEqual(state.isoSops.map(doc=>doc.number),['SOP-CUST-BSH-001']);
  assert.equal(state.isoSops[0].currentVersion,'1.1');
  assert.equal(state.isoSops.some(doc=>/^SOP-EH-/.test(doc.number)),false);
  assert.equal(state.isoSops.some(doc=>doc.number==='SOP-CUST-OLD-001'),false);
});

test('RC1550: Bereinigung wird genau einmal gespeichert und ist danach idempotent',()=>{
  assert.equal(saves.length,1);
  assert.match(saves[0],/RC1550/i);
  const result=runtime.reconcileState();
  assert.equal(result.changed,false);
  assert.equal(saves.length,1);
});
