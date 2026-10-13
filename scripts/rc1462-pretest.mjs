import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const runtimePath=path.join(ROOT,'assets/rc1267-i18n.js');
const builderPath=path.join(ROOT,'.github/rc1112/build-three-env.mjs');
const API_RUNTIME_DEPENDENCIES=Object.freeze(['@azure/storage-blob','pdf-lib','pdf-parse','exceljs']);

function ensureApiRuntimeDependencies(){
  const apiRequire=createRequire(path.join(ROOT,'api','package.json')),missing=[];
  for(const dependency of API_RUNTIME_DEPENDENCIES){try{apiRequire.resolve(dependency);}catch{missing.push(dependency)}}
  if(!missing.length){console.log('RC1468 API runtime dependencies already available; skipping install');return}
  console.log(`RC1468 installing missing API runtime dependencies: ${missing.join(', ')}`);
  const npmCommand=process.platform==='win32'?'npm.cmd':'npm';
  execFileSync(npmCommand,['install','--prefix','api','--ignore-scripts','--no-audit','--no-fund','--package-lock=false'],{cwd:ROOT,stdio:'inherit'});
  for(const dependency of API_RUNTIME_DEPENDENCIES)apiRequire.resolve(dependency);
  console.log('RC1468 API runtime dependencies verified');
}

ensureApiRuntimeDependencies();
await import('./rc1454-avis-download-all-ui.mjs');

function rc1452Prepared(){
  const runtime=fs.readFileSync(runtimePath,'utf8'),builder=fs.readFileSync(builderPath,'utf8');
  const repairBlock=runtime.slice(runtime.indexOf('function repairContaminatedGoodsDescription('),runtime.indexOf('function snapshotShipmentDraft('));
  return runtime.includes('rc1452DocumentActionRepair')&&/ExportHUBClean[\s\S]*?queueSave/.test(repairBlock)&&!/ExportHUBRC565|persistShipment/.test(repairBlock)&&builder.includes('function rc1452PrintGoodsDescription(sh)')&&builder.includes('/assets/rc1267-i18n.js?v=1466')&&!builder.includes('/assets/rc1267-i18n.js?v=1458')&&builder.includes('function resetMountedFreshVolatile()')&&builder.includes('resetMountedFreshVolatile();safePatchDuringEdit();return true');
}

if(!rc1452Prepared())await import('./rc1452-mail-goods-print-hotfix.mjs');
else console.log('RC1452/RC1453/RC1458/RC1466 release transforms already prepared; skipping destructive re-application');

const {patchRepository:patchTaskPlannerV2Builder}=await import('./taskplanner-v2-pretest.mjs');
patchTaskPlannerV2Builder(ROOT);
const {patchRepository:patchTaskPlannerV2Cutover}=await import('./taskplanner-v2-cutover-pretest.mjs');
patchTaskPlannerV2Cutover(ROOT);
const {patchRepository:patchTaskPlannerV2Api}=await import('./taskplanner-v2-api-pretest.mjs');
patchTaskPlannerV2Api(ROOT);
const {patchRepository:patchTaskPlannerV2I18n}=await import('./taskplanner-v2-i18n-pretest.mjs');
const taskPlannerI18n=patchTaskPlannerV2I18n(ROOT);
const {patchRepository:patchTaskPlannerV2PlannerI18n}=await import('./taskplanner-v2-planner-i18n-pretest.mjs');
const taskPlannerPlannerI18n=patchTaskPlannerV2PlannerI18n(ROOT);
const {patchRepository:patchTaskPlannerV2WorkflowI18n}=await import('./taskplanner-v2-workflow-i18n-pretest.mjs');
const taskPlannerWorkflowI18n=patchTaskPlannerV2WorkflowI18n(ROOT);
const {patchRepository:patchTaskPlannerV2ProjectionI18n}=await import('./taskplanner-v2-projection-i18n-pretest.mjs');
const taskPlannerProjectionI18n=patchTaskPlannerV2ProjectionI18n(ROOT);

await import('./rc1467-startup-avis-guard.mjs');
await import('./rc1470-new-shipment-clean-slate-hotfix.mjs');
await import('./rc1471-reminder-eligibility-hotfix.mjs');
await import('./rc1495-legacy-qr-persistence-hotfix.mjs');
await import('./rc1498-qr-status-sync-hotfix.mjs');
await import('./rc1454-release-gate-hotfix.mjs');
await import('./rc1461-release-deepfix.mjs');

if(!rc1452Prepared())throw new Error('RC1462 pretest verification failed: RC1452/1453/1458/1466 preparation incomplete');
const rc1470Builder=fs.readFileSync(builderPath,'utf8');
const taskPlannerApi=fs.readFileSync(path.join(ROOT,'api/exporthub-state/index.js'),'utf8');
const taskPlannerTestservice=fs.readFileSync(path.join(ROOT,'TESTVERSION.html'),'utf8');
const taskPublicPage=fs.readFileSync(path.join(ROOT,'task.html'),'utf8');
const taskPublicRuntime=fs.readFileSync(path.join(ROOT,'assets/task-public-read.js'),'utf8');
if(!rc1470Builder.includes('exporthub-taskplanner-v2-core')||!rc1470Builder.includes("'assets/taskplanner-v2-core.js'")||!rc1470Builder.includes('exporthub-taskplanner-v2-planner')||!rc1470Builder.includes("'assets/taskplanner-v2-planner.js'")||!rc1470Builder.includes('exporthub-taskplanner-v2-projections')||!rc1470Builder.includes("'assets/taskplanner-v2-projections.js'")||!rc1470Builder.includes('exporthub-taskplanner-v2-runtime-bridge')||!rc1470Builder.includes("'assets/taskplanner-v2-runtime-bridge.js'")||!rc1470Builder.includes('exporthub-taskplanner-v2-ui')||!rc1470Builder.includes("'assets/taskplanner-v2-ui.js'")||!rc1470Builder.includes('exporthub-taskplanner-v2-projection-ui')||!rc1470Builder.includes("'assets/taskplanner-v2-projection-ui.js'")||!rc1470Builder.includes('exporthub-taskplanner-v2-planner-ui')||!rc1470Builder.includes("'assets/taskplanner-v2-planner-ui.js'")||!rc1470Builder.includes("'assets/taskplanner-v2.css'")||!rc1470Builder.includes("'assets/taskplanner-v2-projections.css'"))throw new Error('RC1462 pretest verification failed: TaskPlanner V2 builder wiring incomplete');
if(!rc1470Builder.includes("'assets/task-public-read.js'")||!rc1470Builder.includes("taskPublicPageSource=path.join(ROOT,'task.html')"))throw new Error('RC1462 pretest verification failed: TaskPlanner V2 public task build wiring incomplete');
if(!taskPublicPage.includes('/assets/task-public-read.js')||!taskPublicRuntime.includes('/api/task-public?token='))throw new Error('RC1462 pretest verification failed: TaskPlanner V2 public task artifacts incomplete');
if(!rc1470Builder.includes('function patchTaskPlannerV2UiCutover(html,file){')||!rc1470Builder.includes('html=patchTaskPlannerV2UiCutover(html,file);'))throw new Error('RC1462 pretest verification failed: TaskPlanner V2 planner cutover wiring incomplete');
if(!taskPlannerTestservice.includes('__EXPORTHUB_TASKPLANNER_V2_UI_CUTOVER__')||!taskPlannerTestservice.includes('return window.ExportHUBTaskUIV2.renderPlannerPage'))throw new Error('RC1462 pretest verification failed: TaskPlanner V2 TESTSERVICE cutover incomplete');
if(!taskPlannerApi.includes("mode==='task-migration-backup'")||!taskPlannerApi.includes('createVerifiedSnapshot(c.container'))throw new Error('RC1462 pretest verification failed: TaskPlanner V2 API wiring incomplete');
if(!taskPlannerI18n||taskPlannerI18n.locales.length!==6||taskPlannerI18n.keyCount<60)throw new Error('RC1462 pretest verification failed: TaskPlanner V2 i18n preparation incomplete');
if(!taskPlannerPlannerI18n||taskPlannerPlannerI18n.locales.length!==6||taskPlannerPlannerI18n.keyCount<9)throw new Error('RC1462 pretest verification failed: TaskPlanner V2 planner i18n preparation incomplete');
if(!taskPlannerWorkflowI18n||taskPlannerWorkflowI18n.locales.length!==6||taskPlannerWorkflowI18n.keyCount<1)throw new Error('RC1462 pretest verification failed: TaskPlanner V2 workflow i18n preparation incomplete');
if(!taskPlannerProjectionI18n||taskPlannerProjectionI18n.locales.length!==6||taskPlannerProjectionI18n.keyCount<27)throw new Error('RC1462 pretest verification failed: TaskPlanner V2 projection i18n preparation incomplete');
if(!rc1470Builder.includes('function patchRc1470NewShipmentCleanSlate(html,file){')||!rc1470Builder.includes('html=patchRc1470NewShipmentCleanSlate(html,file);'))throw new Error('RC1462 pretest verification failed: RC1470 clean-slate preparation incomplete');
if(!rc1470Builder.includes('function patchRc1471ReminderEligibility(html,file){')||!rc1470Builder.includes('html=patchRc1471ReminderEligibility(html,file);'))throw new Error('RC1462 pretest verification failed: RC1471 reminder eligibility preparation incomplete');
if(!rc1470Builder.includes('function patchRc1495LegacyQrPersistence(html,file){')||!rc1470Builder.includes('html=patchRc1495LegacyQrPersistence(html,file);'))throw new Error('RC1462 pretest verification failed: RC1495/RC1498 legacy QR persistence preparation incomplete');
if(!rc1470Builder.includes('function patchRc1498QrStatusSync(html,file){')||!rc1470Builder.includes('html=patchRc1498QrStatusSync(html,file);'))throw new Error('RC1462 pretest verification failed: RC1498 QR status sync preparation incomplete');
console.log('RC1462 pretest orchestration verified with TaskPlanner V2 core/recurrence/planner/projections/runtime/UI/projection-UI/cutover/i18n/workflow-i18n/projection-i18n/public-task/API wiring, RC1467 startup guard, RC1470 clean-slate reset, RC1471 reminder eligibility and RC1498 QR persistence/status sync');