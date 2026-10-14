import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const builder=await import('../.github/rc1503/build-three-env.mjs');

test('RC1503 Build liefert Progress API in allen drei Umgebungen vor der Tour-Runtime aus',()=>{
  const rel='assets/sop/rc1503-sop-progress.js';
  assert.ok(builder.RC1503_TRAINING_ASSETS.includes(rel),'Progress-Asset fehlt im RC1503 Build');

  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rc1503-progress-root-'));
  const out=path.join(root,'dist-rc1112');
  fs.mkdirSync(path.join(root,'assets/sop'),{recursive:true});
  fs.mkdirSync(out,{recursive:true});
  for(const asset of builder.RC1503_TRAINING_ASSETS){
    const target=path.join(root,asset);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,`/* ${asset} */\n`);
  }
  const shell='<!doctype html><html><head></head><body><script id="exporthub-rc1501-sop-tour-runtime" defer src="/assets/sop/rc1501-sop-tour-runtime.js"></script></body></html>';
  for(const file of ['index.html','TESTVERSION.html','demo.html'])fs.writeFileSync(path.join(out,file),shell);

  const manifest=builder.integrateTraining(root,out);
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=fs.readFileSync(path.join(out,file),'utf8');
    const progressId='id="exporthub-rc1503-sop-progress"';
    assert.equal(html.split(progressId).length-1,1,`${file}: Progress Script muss genau einmal geladen werden`);
    assert.ok(html.indexOf(progressId)<html.indexOf('id="exporthub-rc1501-sop-tour-runtime"'),`${file}: Progress muss vor der Tour-Runtime geladen werden`);
  }
  assert.ok(manifest.assets.includes(rel));
  assert.equal(manifest.progressBeforeTourRuntime,true);
});
