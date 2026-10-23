import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function createEngine(){
  const ctx={};ctx.globalThis=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('assets/training-center/tour-engine.js','utf8'),ctx);
  return ctx.ExportHubTrainingTourEngine;
}
test('RC1644: caller cannot bypass unknown validators with self-declared flags',()=>{
  const engine=createEngine();
  engine.start({scenario:{id:'p',steps:[{stepId:'a',targetElement:'shipment.save',
    expectedAction:'save-demo',validation:['save-proof'],nextStep:null}]}});
  for(const descriptor of [
    {action:'save-demo',targetElement:'shipment.save','save-proof':true},
    {action:'save-demo',targetElement:'shipment.save',validation:{'save-proof':true}},
    {action:'save-demo',targetElement:'shipment.save',valid:true}
  ]){
    assert.equal(engine.handleAction(descriptor).reason,'VALIDATION_FAILED');
    assert.equal(engine.current().finished,false);
  }
  engine.end();
});
test('RC1644: registered validator executes and validates real action',()=>{
  const engine=createEngine();
  engine.start({scenario:{id:'p',validators:{'proof':({descriptor})=>descriptor.value==='ok'},
    steps:[{stepId:'a',targetElement:'shipment.customer-search',expectedAction:'select',
      validation:['proof'],nextStep:null}]}});
  assert.equal(engine.handleAction({action:'select',targetElement:'shipment.customer-search',validation:{proof:true},value:'wrong'}).advanced,false);
  assert.equal(engine.handleAction({action:'select',targetElement:'shipment.customer-search',value:'ok'}).advanced,true);
  engine.end();
});
test('RC1644: impossible or cyclic tour graph is rejected before start',()=>{
  const engine=createEngine();
  const step=(id,next)=>({stepId:id,targetElement:'shipment.new',expectedAction:'click',validation:[],nextStep:next});
  assert.throws(()=>engine.start({scenario:{id:'p',steps:[step('a','missing')]} }),/TRAINING_TOUR_NEXT_STEP_UNKNOWN/);
  assert.throws(()=>engine.start({scenario:{id:'p',steps:[step('a','b'),step('b','a')]} }),/TRAINING_TOUR_CYCLIC_OR_BACKWARD_STEP/);
  assert.equal(engine.current(),null);
});
test('RC1644: no tour modules contain productive fetch or save calls or override live SOP UI',()=>{
  for(const file of ['assets/training-center/tour-engine.js',
     'assets/training-center/target-registry.js',
     'assets/training-center/integration/shipment-targets.js']){
    const text=fs.readFileSync(file,'utf8');
    assert.doesNotMatch(text,/\bfetch\s*\(|localStorage\.(setItem|removeItem)|sessionStorage\.(setItem|removeItem)/);
    assert.doesNotMatch(text,/(?:\.click\(|\.submit\(|\.dispatchEvent\(|\.saveShipment\()/);
  }
  const main=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  assert.ok(!main.includes('replaceLegacySopRendererInBuild'),'no switch of SOP renderer');
});
