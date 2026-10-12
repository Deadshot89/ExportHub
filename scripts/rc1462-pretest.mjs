import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const runtimePath=path.join(ROOT,'assets/rc1267-i18n.js');
const builderPath=path.join(ROOT,'.github/rc1112/build-three-env.mjs');
const API_RUNTIME_DEPENDENCIES=Object.freeze([
  '@azure/storage-blob',
  'pdf-lib',
  'pdf-parse',
  'exceljs'
]);

function ensureApiRuntimeDependencies(){
  const apiRequire=createRequire(path.join(ROOT,'api','package.json'));
  const missing=[];
  for(const dependency of API_RUNTIME_DEPENDENCIES){
    try{apiRequire.resolve(dependency);}catch{missing.push(dependency);}
  }
  if(!missing.length){
    console.log('RC1468 API runtime dependencies already available; skipping install');
    return;
  }
  console.log(`RC1468 installing missing API runtime dependencies: ${missing.join(', ')}`);
  const npmCommand=process.platform==='win32'?'npm.cmd':'npm';
  execFileSync(npmCommand,[
    'install',
    '--prefix','api',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--package-lock=false'
  ],{cwd:ROOT,stdio:'inherit'});
  for(const dependency of API_RUNTIME_DEPENDENCIES){
    apiRequire.resolve(dependency);
  }
  console.log('RC1468 API runtime dependencies verified');
}

ensureApiRuntimeDependencies();

await import('./rc1454-avis-download-all-ui.mjs');

function rc1452Prepared(){
  const runtime=fs.readFileSync(runtimePath,'utf8');
  const builder=fs.readFileSync(builderPath,'utf8');
  const repairBlock=runtime.slice(runtime.indexOf('function repairContaminatedGoodsDescription('),runtime.indexOf('function snapshotShipmentDraft('));
  return runtime.includes('rc1452DocumentActionRepair')
    && /ExportHUBClean[\s\S]*?queueSave/.test(repairBlock)
    && !/ExportHUBRC565|persistShipment/.test(repairBlock)
    && builder.includes('function rc1452PrintGoodsDescription(sh)')
    && builder.includes('/assets/rc1267-i18n.js?v=1466')
    && !builder.includes('/assets/rc1267-i18n.js?v=1458')
    && builder.includes('function resetMountedFreshVolatile()')
    && builder.includes('resetMountedFreshVolatile();safePatchDuringEdit();return true');
}

if(!rc1452Prepared()){
  await import('./rc1452-mail-goods-print-hotfix.mjs');
}else{
  console.log('RC1452/RC1453/RC1458/RC1466 release transforms already prepared; skipping destructive re-application');
}

const {patchRepository:patchTaskPlannerV2Builder}=await import('./taskplanner-v2-pretest.mjs');
patchTaskPlannerV2Builder(ROOT);
const {patchRepository:patchTaskPlannerV2Api}=await import('./taskplanner-v2-api-pretest.mjs');
patchTaskPlannerV2Api(ROOT);

// RC1467 is intentionally always evaluated: it is idempotent and protects every
// release build against startup lifecycle events entering strict shipment validation.
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
if(!rc1470Builder.includes('exporthub-taskplanner-v2-core')||!rc1470Builder.includes("'assets/taskplanner-v2-core.js'")||!rc1470Builder.includes('exporthub-taskplanner-v2-planner')||!rc1470Builder.includes("'assets/taskplanner-v2-planner.js'")||!rc1470Builder.includes('exporthub-taskplanner-v2-runtime-bridge')||!rc1470Builder.includes("'assets/taskplanner-v2-runtime-bridge.js'"))throw new Error('RC1462 pretest verification failed: TaskPlanner V2 builder wiring incomplete');
if(!taskPlannerApi.includes("mode==='task-migration-backup'")||!taskPlannerApi.includes('createVerifiedSnapshot(c.container'))throw new Error('RC1462 pretest verification failed: TaskPlanner V2 API wiring incomplete');
if(!rc1470Builder.includes('function patchRc1470NewShipmentCleanSlate(html,file){')||!rc1470Builder.includes('html=patchRc1470NewShipmentCleanSlate(html,file);'))throw new Error('RC1462 pretest verification failed: RC1470 clean-slate preparation incomplete');
if(!rc1470Builder.includes('function patchRc1471ReminderEligibility(html,file){')||!rc1470Builder.includes('html=patchRc1471ReminderEligibility(html,file);'))throw new Error('RC1462 pretest verification failed: RC1471 reminder eligibility preparation incomplete');
if(!rc1470Builder.includes('function patchRc1495LegacyQrPersistence(html,file){')||!rc1470Builder.includes('html=patchRc1495LegacyQrPersistence(html,file);'))throw new Error('RC1462 pretest verification failed: RC1495/RC1498 legacy QR persistence preparation incomplete');
if(!rc1470Builder.includes('function patchRc1498QrStatusSync(html,file){')||!rc1470Builder.includes('html=patchRc1498QrStatusSync(html,file);'))throw new Error('RC1462 pretest verification failed: RC1498 QR status sync preparation incomplete');
console.log('RC1462 pretest orchestration verified with TaskPlanner V2 core/recurrence/planner/runtime/API wiring, RC1467 startup guard, RC1470 clean-slate reset, RC1471 reminder eligibility and RC1498 QR persistence/status sync');
