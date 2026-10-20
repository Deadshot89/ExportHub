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
  'assets/training-center/i18n.js',
  'assets/training-center/customer-sop.js',
  'assets/training-center/screenshots.js',
  'assets/training-center/coverage-registry.js',
  'assets/training-center/coverage.js',
  'assets/training-center/coverage-dashboard.js',
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
const retiredPath=['assets','sop'].join('/');
const retiredRuntime=new RegExp(`(?:src|href)=["'][^"']*${retiredPath.replace('/','\\/')}\\/[^"']*["']`,'i');

async function loadBuilder(){
  assert.ok(fs.existsSync(builder),'Training-Center Drei-Umgebungs-Builder fehlt');
  return import(pathToFileURL(path.resolve(builder)).href+`?t=${Date.now()}`);
}

test('Build-Helfer lehnt jeden retired SOP-Asset-Verweis fail-closed ab und injiziert neue Runtime idempotent',async()=>{
  const mod=await loadBuilder();
  assert.equal(typeof mod.assertNoRetiredSopReferences,'function');
  assert.equal(typeof mod.injectTrainingCenter,'function');
  const clean='<!doctype html><html><head><script id="business-runtime" src="/assets/business.js"></script></head><body></body></html>';
  assert.equal(mod.assertNoRetiredSopReferences(clean,'fixture.html'),true);
  const retired=`<!doctype html><html><head><script src="/${retiredPath}/retired-runtime.js"></script></head><body></body></html>`;
  assert.throws(()=>mod.assertNoRetiredSopReferences(retired,'fixture.html'),/retired SOP asset reference detected/);
  assert.throws(()=>mod.injectTrainingCenter(retired,'fixture.html'),/retired SOP asset reference detected/);
  const once=mod.injectTrainingCenter(clean,'fixture.html');
  const twice=mod.injectTrainingCenter(once,'fixture.html');
  assert.match(twice,/business-runtime/,'fachfremde Business-Runtime muss erhalten bleiben');
  for(const id of ['exporthub-training-center-style','exporthub-training-tour-style','exporthub-training-center-model','exporthub-training-center-i18n','exporthub-training-coverage-dashboard','exporthub-training-center-runtime']){
    assert.equal((twice.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,`${id} muss exakt einmal vorkommen`);
  }
});

test('echter Drei-Umgebungs-Build enthält ausschließlich neue Training-Center-Assets und keine retired SOP-Runtime',async()=>{
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
    assert.match(html,/exporthub-training-coverage-dashboard/,`${file}: neue Coverage fehlt`);
    assert.doesNotMatch(html,retiredRuntime,`${file}: retired SOP-Runtime ist noch verdrahtet`);
  }
  for(const rel of requiredAssets)assert.ok(fs.existsSync(path.join(out,rel)),`Build-Asset fehlt: ${rel}`);
  assert.equal(fs.existsSync(path.join(out,retiredPath)),false,'retired SOP-Assetverzeichnis darf nicht im Release-Paket existieren');
});


test('Training-Center final production pack excludes retired RC1544 SOP Guided Workspace',()=>{
  const fsSource=fs.readFileSync('.github/packmeldungen/build-three-env.mjs','utf8');
  assert.doesNotMatch(fsSource,/integrateGuidedWorkspace/);
  const integration=fs.readFileSync('.github/rc1521/build-three-env.mjs','utf8');
  assert.match(integration,/integrateAbdProforma\(root,out\)/);
  assert.match(integration,/ABD_PROFORMA_ASSETS/);
  assert.match(integration,/ABD_PROFORMA_MARKERS/);
});
