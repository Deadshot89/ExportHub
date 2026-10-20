import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');

test('retired SOPMaster sources remain available only for historical compatibility tests',()=>{
  assert.ok(fs.existsSync('assets/sop/rc1007-sop-model.js'));
  assert.ok(fs.existsSync('assets/sop/rc1544-sop-guided-workspace.js'));
});

test('RC1013, RC1016, RC1018 and RC1112 keep their verified historical contracts until release cutover',()=>{
  const source=read('.github/rc1112/build-three-env.mjs');
  assert.match(source,/integrateTour\(ROOT,OUT\)/);
  assert.match(source,/integrateEditor\(ROOT,OUT\)/);
  assert.match(source,/integrateTraining\(ROOT,OUT\)/);
  assert.match(source,/integrateCoverageAdmin\(ROOT,OUT\)/);
});

test('the new Training Center package removes all retired SOP scripts, styles and asset files after historical builder',()=>{
  const src=read('.github/training-center/build-three-env.mjs');
  assert.match(src,/removeRetiredSopTagsFromBuild/);
  assert.match(src,/injectTrainingCenter\(removeRetiredSopTagsFromBuild\(current,file\),file\)/);
  assert.match(src,/fs\.rmSync\(path\.join\(out,'assets','sop'\)/);
  assert.match(src,/assertPackage\(out\)/);
});
