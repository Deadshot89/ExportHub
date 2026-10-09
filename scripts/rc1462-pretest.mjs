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

// RC1467 is intentionally always evaluated: it is idempotent and protects every
// release build against startup lifecycle events entering strict shipment validation.
await import('./rc1467-startup-avis-guard.mjs');
await import('./rc1470-new-shipment-clean-slate-hotfix.mjs');
await import('./rc1454-release-gate-hotfix.mjs');
await import('./rc1461-release-deepfix.mjs');

if(!rc1452Prepared())throw new Error('RC1462 pretest verification failed: RC1452/1453/1458/1466 preparation incomplete');
const rc1470Builder=fs.readFileSync(builderPath,'utf8');
if(!rc1470Builder.includes('function patchRc1470NewShipmentCleanSlate(html,file){')||!rc1470Builder.includes('html=patchRc1470NewShipmentCleanSlate(html,file);'))throw new Error('RC1462 pretest verification failed: RC1470 clean-slate preparation incomplete');
console.log('RC1462 pretest orchestration verified idempotent with RC1467 startup guard and RC1470 clean-slate reset');
