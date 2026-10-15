import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');

test('retired SOPMaster runtime source is physically absent',()=>{
  assert.equal(fs.existsSync('assets/sop'),false,'assets/sop darf nach dem Clean Cutover nicht mehr existieren');
});

test('historical RC1013 build no longer injects or copies retired SOPMaster assets',()=>{
  const src=read('.github/rc1013/build-three-env.mjs');
  assert.doesNotMatch(src,/\/assets\/sop\//);
  assert.doesNotMatch(src,/sopReleaseTag|SOP_RELEASE_SRC|SOP_STABILITY_SRC/);
  assert.doesNotMatch(src,/sopRelease:|sopStability:/);
});

test('historical RC1016 and RC1018 build stages keep non-SOP regressions but no longer add SOPMaster',()=>{
  const rc1016=read('.github/rc1016/build-three-env.mjs');
  const rc1018=read('.github/rc1018/build-three-env.mjs');
  assert.doesNotMatch(rc1016,/injectSopConsolidation|assets\/sop/);
  assert.doesNotMatch(rc1018,/injectSopImages|assets\/sop/);
  assert.match(rc1016,/rc1016-mobile-navigation/);
  assert.match(rc1018,/rc1018-mail-language-standard/);
});

test('stable RC1112 build no longer imports or integrates retired SOPMaster layers',()=>{
  const src=read('.github/rc1112/build-three-env.mjs');
  for(const retired of ['rc1501/build-three-env.mjs','rc1502/build-three-env.mjs','rc1503/build-three-env.mjs','rc1506/build-three-env.mjs','integrateTour','integrateEditor','integrateTraining','integrateCoverageAdmin']){
    assert.equal(src.includes(retired),false,`retired SOPMaster wiring bleibt aktiv: ${retired}`);
  }
  assert.match(read('.github/training-center/build-three-env.mjs'),/assets\/training-center/);
});
