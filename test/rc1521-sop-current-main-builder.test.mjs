import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const builder='.github/rc1521/build-three-env.mjs';
const read=p=>fs.readFileSync(p,'utf8');

test('RC1521 Training Center builds on the current Pack and RC1112 release chain',()=>{
  const release=read(builder);
  const training=read('.github/training-center/build-three-env.mjs');
  const pack=read('.github/packmeldungen/build-three-env.mjs');
  assert.match(release,/build as buildTrainingCenter.*training-center\/build-three-env\.mjs/s);
  assert.match(training,/build as buildPack.*packmeldungen\/build-three-env\.mjs/s);
  assert.match(training,/buildPack\(root\)/);
  assert.match(pack,/\.github\/rc1112\/build-three-env\.mjs/);
});

test('RC1521 loads the new Training Center after the base build and then retains ABD Proforma',()=>{
  const release=read(builder),training=read('.github/training-center/build-three-env.mjs');
  assert.ok(release.indexOf('buildTrainingCenter(root)')>=0);
  assert.ok(release.indexOf('integrateAbdProforma(root,out)')>release.indexOf('buildTrainingCenter(root)'));
  assert.match(release,/ABD_PROFORMA_ASSETS/);
  assert.match(release,/ABD_PROFORMA_MARKERS/);
  assert.match(training,/injectTrainingCenter\(replaceLegacySopRendererInBuild\(removeRetiredSopTagsFromBuild\(current,file\),file\),file\)/);
  assert.match(training,/assertPackage\(out\)/);
});

test('RC1521 validates all environment entries plus Training Center and ABD assets',()=>{
  const release=read(builder),training=read('.github/training-center/build-three-env.mjs');
  assert.match(release,/index\.html.*TESTVERSION\.html.*demo\.html/s);
  for(const id of ['exporthub-training-center-runtime','exporthub-training-coverage-dashboard','exporthub-training-center-style'])
    assert.ok(training.includes(id),'Training Center marker missing: '+id);
  assert.match(release,/for\(const marker of ABD_PROFORMA_MARKERS\)/);
  assert.match(release,/for\(const asset of ABD_PROFORMA_ASSETS\)/);
});

test('RC1521 stays an isolated build wrapper with no deployment or business-data writes',()=>{
  const release=read(builder);
  assert.doesNotMatch(release,/Azure\/static-web-apps-deploy/i);
  assert.doesNotMatch(release,/PRODUCTION FREIGEBEN/);
  assert.doesNotMatch(release,/fetch\s*\(/);
  assert.doesNotMatch(release,/https?:\/\//);
});
