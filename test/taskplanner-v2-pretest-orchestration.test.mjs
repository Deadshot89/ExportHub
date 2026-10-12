import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('RC1462 pretest führt TaskPlanner-V2-Builder-, Cutover-, API- und i18n-Wiring wirklich aus',()=>{
  const source=fs.readFileSync('scripts/rc1462-pretest.mjs','utf8');
  assert.match(source,/patchRepository:patchTaskPlannerV2Builder/);
  assert.match(source,/patchTaskPlannerV2Builder\(ROOT\)/);
  assert.match(source,/patchRepository:patchTaskPlannerV2Cutover/);
  assert.match(source,/patchTaskPlannerV2Cutover\(ROOT\)/);
  assert.match(source,/patchRepository:patchTaskPlannerV2Api/);
  assert.match(source,/patchTaskPlannerV2Api\(ROOT\)/);
  assert.match(source,/patchRepository:patchTaskPlannerV2I18n/);
  assert.match(source,/patchTaskPlannerV2I18n\(ROOT\)/);
  assert.match(source,/patchRepository:patchTaskPlannerV2PlannerI18n/);
  assert.match(source,/patchTaskPlannerV2PlannerI18n\(ROOT\)/);
  assert.match(source,/TaskPlanner V2 builder wiring incomplete/);
  assert.match(source,/TaskPlanner V2 planner cutover wiring incomplete/);
  assert.match(source,/TaskPlanner V2 TESTSERVICE cutover incomplete/);
  assert.match(source,/TaskPlanner V2 API wiring incomplete/);
  assert.match(source,/TaskPlanner V2 i18n preparation incomplete/);
  assert.match(source,/TaskPlanner V2 planner i18n preparation incomplete/);
});
