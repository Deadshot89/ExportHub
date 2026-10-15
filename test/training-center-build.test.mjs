import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const builder='.github/training-center/build-three-env.mjs';
const entries=['index.html','TESTVERSION.html','demo.html'];
const requiredAssets=[
  'assets/training-center/model.js',
  'assets/training-center/store.js',
  'assets/training-center/customer-sop.js',
  'assets/training-center/screenshots.js',
  'assets/training-center/catalog/shipment-registration.js',
  'assets/training-center/catalog/dhl-express.js',
  'assets/training-center/training-state.js',
  'assets/training-center/demo-adapter.js',
  'assets/training-center/training-write-guard.js',
  'assets/training-center/training-controller.js',
  'assets/training-center/target-registry.js',
  'assets/training-center/integration/shipment-targets.js',
  'assets/training-center/tour-engine.js',
  'assets/training-center/tour-ui.js',
  'assets/training-center/scenarios/first-shipment.js',
  'assets/training-center/ui.js',
  'assets/training-center/runtime.js',
  'assets/training-center/ui.css',
  'assets/training-center/tour.css',
  'assets/training-center/legacy-cleanup.js'
];
const legacyRuntime=/(?:src|href)=["'][^"']*assets\/sop\/(?:rc1007|rc1010|rc1016|rc1018|rc1501|rc1502|rc1503|rc1505|rc1506)[^"']*["']/i;

async function loadBuilder(){
  assert.ok(fs.existsSync(builder),'Training-Center Drei-Umgebungs-Builder fehlt');
  return import(pathToFileURL(path.resolve(builder)).href+`?t=${Date.now()}`);
}

test('Build-Helfer entfernt ausschließlich alte SOPMaster-Runtime-Tags und injiziert die neue Runtime genau einmal',async()=>{
  const mod=await loadBuilder();
  assert.equal(typeof mod.stripLegacySopRuntime,'function');
  assert.equal(typeof mod.injectTrainingCenter,'function');
  const html=`<!doctype html><html><head>
    <script id="business-runtime" src="/assets/business.js"></script>
    <link rel="stylesheet" href="/assets/sop/rc1018-sop.css?v=1">
    <script src="/assets/sop/rc1503-sop-training.js?v=1"></script>
  </head><body></body></html>`;
  const stripped=mod.stripLegacySopRuntime(html,'fixture.html');
  assert.match(stripped,/business-runtime/);
  assert.doesNotMatch(stripped,legacyRuntime);
  assert.doesNotMatch(stripped,/assets\/sop\/rc1018-sop\.css/);
  const once=mod.injectTrainingCenter(stripped,'fixture.html');
  const twice=mod.injectTrainingCenter(once,'fixture.html');
  for(const id of ['exporthub-training-center-style','exporthub-training-tour-style','exporthub-training-center-model','exporthub-training-center-runtime']){
    assert.equal((twice.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,`${id} muss exakt einmal vorkommen`);
  }
});

test('echter Drei-Umgebungs-Build enthält neue Training-Center-Assets und keine alte SOPMaster-Runtime',async()=>{
  const mod=await loadBuilder();
  assert.equal(typeof mod.build,'function');
  const out=mod.build(process.cwd());
  assert.ok(fs.existsSync(out),'Build-Ausgabe fehlt');
  for(const file of entries){
    const target=path.join(out,file);
    assert.ok(fs.existsSync(target),`${file} fehlt im Build`);
    const html=fs.readFileSync(target,'utf8');
    assert.match(html,/exporthub-training-center-runtime/,`${file}: neue Runtime fehlt`);
    assert.match(html,/exporthub-training-center-style/,`${file}: neues CSS fehlt`);
    assert.doesNotMatch(html,legacyRuntime,`${file}: alte SOPMaster-Runtime ist noch verdrahtet`);
  }
  for(const rel of requiredAssets)assert.ok(fs.existsSync(path.join(out,rel)),`Build-Asset fehlt: ${rel}`);
});
