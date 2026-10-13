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
  assert.match(source,/patchRepository:patchTaskPlannerV2WorkflowI18n/);
  assert.match(source,/patchTaskPlannerV2WorkflowI18n\(ROOT\)/);
  assert.match(source,/patchRepository:patchTaskPlannerV2ProjectionI18n/);
  assert.match(source,/patchTaskPlannerV2ProjectionI18n\(ROOT\)/);
  assert.match(source,/exporthub-taskplanner-v2-projections/);
  assert.match(source,/exporthub-taskplanner-v2-projection-ui/);
  assert.match(source,/taskplanner-v2-projections\.css/);
  assert.match(source,/TaskPlanner V2 builder wiring incomplete/);
  assert.match(source,/TaskPlanner V2 planner cutover wiring incomplete/);
  assert.match(source,/TaskPlanner V2 TESTSERVICE cutover incomplete/);
  assert.match(source,/TaskPlanner V2 API wiring incomplete/);
  assert.match(source,/TaskPlanner V2 i18n preparation incomplete/);
  assert.match(source,/TaskPlanner V2 planner i18n preparation incomplete/);
  assert.match(source,/TaskPlanner V2 workflow i18n preparation incomplete/);
  assert.match(source,/TaskPlanner V2 projection i18n preparation incomplete/);
});

test('RC1462 pretest verifiziert Migrationsaudit ausschließlich mit synthetischem In-Memory-State',()=>{
  const source=fs.readFileSync('scripts/rc1462-pretest.mjs','utf8');
  const start=source.indexOf("const {auditState}=await import('./taskplanner-v2-migration-audit.mjs')");
  const end=source.indexOf("await import('./rc1467-startup-avis-guard.mjs')",start);
  assert.ok(start>=0&&end>start,'Audit-Block muss klar abgegrenzt sein');
  const auditBlock=source.slice(start,end);
  assert.match(auditBlock,/taskplanner-v2-migration-audit\.mjs/);
  assert.match(auditBlock,/auditState/);
  assert.match(auditBlock,/tasks:\[\],taskSeries:\[\],taskArchive:\[\]/);
  assert.match(auditBlock,/TaskPlanner V2 migration audit readiness incomplete/);
  assert.doesNotMatch(auditBlock,/api\/exporthub-state|AZURE|blob|fetch\(/i,'Pretest-Audit darf keine Live-/Azure-Statequelle lesen');
});
