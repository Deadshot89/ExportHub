import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const builder='.github/rc1503/build-three-env.mjs';

test('RC1503 besitzt additiven Drei-Umgebungen-Build auf RC1502',()=>{
  assert.ok(fs.existsSync(builder),'RC1503 Build-Wrapper fehlt');
  const source=fs.readFileSync(builder,'utf8');
  assert.match(source,/rc1502\/build-three-env\.mjs/);
  assert.match(source,/rc1503-sop-training\.js/);
  assert.match(source,/rc1503-sop-training\.css/);
});

test('RC1503 lädt Training vor der Tour-Runtime in Produktion TESTSERVICE und Demo genau einmal',()=>{
  execFileSync(process.execPath,[builder],{cwd:process.cwd(),stdio:'pipe'});
  const out=path.join(process.cwd(),'dist-rc1112');
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=fs.readFileSync(path.join(out,file),'utf8');
    for(const id of ['exporthub-rc1503-sop-training-style','exporthub-rc1503-sop-training']){
      assert.equal(html.split(`id="${id}"`).length-1,1,`${file}: ${id} muss genau einmal vorkommen`);
    }
    const training=html.indexOf('id="exporthub-rc1503-sop-training"');
    const runtime=html.indexOf('id="exporthub-rc1501-sop-tour-runtime"');
    assert.ok(training>=0&&runtime>training,`${file}: Trainings-Sandbox muss vor der Tour-Runtime geladen werden`);
  }
  for(const rel of ['assets/sop/rc1503-sop-training.js','assets/sop/rc1503-sop-training.css']){
    assert.ok(fs.existsSync(path.join(out,rel)),`Build-Asset fehlt: ${rel}`);
  }
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'rc1503-sop-training-manifest.json'),'utf8'));
  assert.equal(manifest.version,'RC1503');
  assert.equal(manifest.baseBuilder,'.github/rc1502/build-three-env.mjs');
  assert.equal(manifest.trainingEnvironment,'demo-only');
  assert.equal(manifest.productiveEffects,'simulation-only');
});
