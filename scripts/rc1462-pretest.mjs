import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const runtimePath=path.join(ROOT,'assets/rc1267-i18n.js');
const builderPath=path.join(ROOT,'.github/rc1112/build-three-env.mjs');

await import('./rc1454-avis-download-all-ui.mjs');

function rc1452Prepared(){
  const runtime=fs.readFileSync(runtimePath,'utf8');
  const builder=fs.readFileSync(builderPath,'utf8');
  const repairBlock=runtime.slice(runtime.indexOf('function repairContaminatedGoodsDescription('),runtime.indexOf('function snapshotShipmentDraft('));
  return runtime.includes('rc1452DocumentActionRepair')
    && /ExportHUBClean[\s\S]*?queueSave/.test(repairBlock)
    && !/ExportHUBRC565|persistShipment/.test(repairBlock)
    && builder.includes('function rc1452PrintGoodsDescription(sh)')
    && builder.includes('/assets/rc1267-i18n.js?v=1458')
    && builder.includes('function resetMountedFreshVolatile()')
    && builder.includes('resetMountedFreshVolatile();safePatchDuringEdit();return true');
}

if(!rc1452Prepared()){
  await import('./rc1452-mail-goods-print-hotfix.mjs');
}else{
  console.log('RC1452/RC1453/RC1458 release transforms already prepared; skipping destructive re-application');
}

await import('./rc1454-release-gate-hotfix.mjs');
await import('./rc1461-release-deepfix.mjs');

if(!rc1452Prepared())throw new Error('RC1462 pretest verification failed: RC1452/1453/1458 preparation incomplete');
console.log('RC1462 pretest orchestration verified idempotent');