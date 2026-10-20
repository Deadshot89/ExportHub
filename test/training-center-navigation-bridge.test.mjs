import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/training-center/runtime.js','utf8');

test('old SOP navigation is bridged without calling the retired renderer',()=>{
  let oldCalls=0;
  const jobs=[];
  const body={getAttribute(name){return name==='data-exporthub-view'?'dashboard':null;}};
  const sandbox={
    document:{readyState:'complete',body,querySelector(){return null;}},
    renderSop(){oldCalls++;throw new Error('RETIRED_SOP_RENDER_CALLED');},
    queueMicrotask(callback){jobs.push(callback);}
  };
  vm.runInNewContext(source,sandbox,{filename:'assets/training-center/runtime.js'});
  assert.equal(typeof sandbox.ExportHubTrainingCenterRuntime?.start,'function');
  assert.equal(typeof sandbox.renderSop,'function');
  const html=sandbox.renderSop();
  assert.match(html,/data-training-center-route-pending="1"/);
  assert.equal(oldCalls,0,'new navigation must never call legacy renderSop');
  assert.equal(jobs.length,1,'route refresh must be queued exactly once');
  jobs[0]();
  assert.equal(oldCalls,0);
});

test('new runtime does not invent a legacy renderer where none exists',()=>{
  const sandbox={document:{readyState:'complete',body:{getAttribute(){return 'dashboard';}},querySelector(){return null;}}};
  vm.runInNewContext(source,sandbox,{filename:'assets/training-center/runtime.js'});
  assert.equal('renderSop' in sandbox,false);
  assert.equal(typeof sandbox.ExportHubTrainingCenterRuntime?.mount,'function');
});
