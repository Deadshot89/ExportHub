import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1069-performance.js','utf8');

function harness(){
  const timers=[],cleared=[];
  const win={
    setTimeout(fn,ms){const id=timers.length+1;timers.push({id,fn,ms});return id},
    clearTimeout(id){cleared.push(id)},
    fetch(){return Promise.resolve({status:200})}
  };
  vm.runInNewContext(source,{window:win,console,URL,Date,Promise,Object,Array,String,Number,Math,JSON},{filename:'rc1069-performance.js'});
  return{win,timers,cleared};
}

test('RC1384: burstartige Install-/Render-Signale erzeugen nur einen Diagnose-Cleanup-Timer',()=>{
  const {win,timers,cleared}=harness();
  for(let i=0;i<50;i++)win.ExportHUBRC1069Performance.install();
  const cleanupTimers=timers.filter(row=>row.ms===250);
  assert.equal(cleanupTimers.length,1,'50 Install-Signale dürfen nur einen 250ms-Cleanup-Timer erzeugen');
  const stats=win.ExportHUBRC1069Performance.stats();
  assert.equal(stats.diagnosticsCleanupScheduled,1);
  assert.equal(stats.diagnosticsCleanupCoalesced,49);
  assert.equal(cleared.length,0,'ein bereits ausstehender Cleanup-Timer darf nicht fortlaufend gelöscht und neu angelegt werden');
});

test('RC1384: nach Ablauf des Cleanup-Timers kann ein späteres Signal wieder genau einen Timer planen',()=>{
  const {win,timers}=harness();
  for(let i=0;i<10;i++)win.ExportHUBRC1069Performance.install();
  assert.equal(timers.filter(row=>row.ms===250).length,1);
  timers.find(row=>row.ms===250).fn();
  win.ExportHUBRC1069Performance.install();
  assert.equal(timers.filter(row=>row.ms===250).length,2,'nach Ablauf muss ein neuer Cleanup weiterhin möglich sein');
  const stats=win.ExportHUBRC1069Performance.stats();
  assert.equal(stats.diagnosticsCleanupScheduled,2);
});
