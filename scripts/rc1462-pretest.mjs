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

function applyRc1505SaveConfirmationRenderGate(){
  let source=fs.readFileSync(builderPath,'utf8');
  const functionName='function patchRc1505SaveConfirmationRenderGate(html,file){';
  const call='html=patchRc1505SaveConfirmationRenderGate(html,file);';

  if(!source.includes(functionName)){
    const insertBefore='function patchTaskDetailTab(html,file){';
    const at=source.indexOf(insertBefore);
    if(at<0)throw new Error('RC1505 Builder-Einfuegeanker fehlt');
    const patch=`function patchRc1505SaveConfirmationRenderGate(html,file){
  const syncBefore="reason:reason||'poll',remote:true";
  const syncAfter="reason:reason||'poll',remote:true,concurrentMerge:options.concurrentMerge===true";
  if(!html.includes(syncAfter)){
    const count=html.split(syncBefore).length-1;
    if(count!==1)throw new Error(file+': RC1505 Sync-Metadaten-Anker '+count+'x gefunden');
    html=html.replace(syncBefore,syncAfter);
  }

  const applyBefore="applyRemoteDocument(authoritative,'save-confirmation',{allowWhileSaving:true})";
  const applyAfter="applyRemoteDocument(authoritative,'save-confirmation',{allowWhileSaving:true,concurrentMerge:authoritative&&authoritative.concurrentMerge===true})";
  let applyAfterCount=html.split(applyAfter).length-1;
  if(applyAfterCount!==2){
    const count=html.split(applyBefore).length-1;
    if(count!==2)throw new Error(file+': RC1505 Save-Confirmation-Apply-Anker '+count+'x gefunden');
    html=html.split(applyBefore).join(applyAfter);
    applyAfterCount=html.split(applyAfter).length-1;
  }
  if(applyAfterCount!==2)throw new Error(file+': RC1505 concurrentMerge wird nicht an beide Save-Apply-Pfade weitergegeben');

  const shipmentBefore="window.addEventListener('exporthub:sync',function(event){var detail=event&&event.detail||{},localSaveConfirmation=detail.remote===true&&detail.reason==='save-confirmation'&&window.__EXPORTHUB_SHIPMENT_SAVE_TX__===true;if(localSaveConfirmation)return;if(detail.remote===true)scheduleRemoteMerge(0)})";
  const shipmentAfter="window.addEventListener('exporthub:sync',function(event){var detail=event&&event.detail||{},localSaveConfirmation=detail.remote===true&&detail.reason==='save-confirmation'&&window.__EXPORTHUB_SHIPMENT_SAVE_TX__===true,saveConfirmationNoMerge=detail.remote===true&&detail.reason==='save-confirmation'&&detail.concurrentMerge!==true;if(saveConfirmationNoMerge)return;if(localSaveConfirmation)return;if(detail.remote===true)scheduleRemoteMerge(0)})";
  if(!html.includes(shipmentAfter)){
    const count=html.split(shipmentBefore).length-1;
    if(count!==1)throw new Error(file+': RC1505 Shipment-Sync-Anker '+count+'x gefunden');
    html=html.replace(shipmentBefore,shipmentAfter);
  }

  const postBefore="window.addEventListener('exporthub:sync',function(){schedulePost(220,true)})";
  const postAfter="window.addEventListener('exporthub:sync',function(event){var detail=event&&event.detail||{};if(detail.reason==='save-confirmation'&&detail.concurrentMerge!==true)return;schedulePost(220,true)})";
  if(!html.includes(postAfter)){
    const count=html.split(postBefore).length-1;
    if(count!==1)throw new Error(file+': RC1505 Prozess-Postprocessing-Anker '+count+'x gefunden');
    html=html.replace(postBefore,postAfter);
  }

  if(!html.includes(syncAfter)||!html.includes(shipmentAfter)||!html.includes(postAfter))throw new Error(file+': RC1505 Render-Gate unvollstaendig');
  return html;
}

`;
    source=source.slice(0,at)+patch+source.slice(at);
  }

  if(!source.includes(call)){
    const anchor='html=patchRc1418ShipmentSaveNoRerender(html,file);';
    const count=source.split(anchor).length-1;
    if(count!==1)throw new Error('RC1505 Build-Call-Anker '+count+'x gefunden');
    source=source.replace(anchor,anchor+'\n  '+call);
  }

  if(!source.includes(functionName)||!source.includes(call))throw new Error('RC1505 Builder-Integration unvollstaendig');
  fs.writeFileSync(builderPath,source,'utf8');
  console.log('RC1505 save-confirmation render gate prepared');
}

function applyRc1507I18nSaveConfirmationGate(){
  let source=fs.readFileSync(runtimePath,'utf8');
  const helper="function isNoMergeSaveConfirmation(event){var detail=event&&event.detail||{};return detail.remote===true&&detail.reason==='save-confirmation'&&detail.concurrentMerge!==true}";
  const before="['exporthub:sync','exporthub:customer-updated','exporthub:shipment-updated','exporthub:task-updated'].forEach(function(name){w.addEventListener(name,function(){repairContaminatedGoodsDescription();buildDynamicIndex();ensureSelector();if(d.body)queueFullTranslation()})});";
  const after=helper+"\n"+
    "w.addEventListener('exporthub:sync',function(event){if(isNoMergeSaveConfirmation(event))return;repairContaminatedGoodsDescription();buildDynamicIndex();ensureSelector();if(d.body)queueFullTranslation()});\n"+
    "w.addEventListener('exporthub:customer-updated',function(){repairContaminatedGoodsDescription();buildDynamicIndex();ensureSelector();if(d.body)queueFullTranslation()});\n"+
    "w.addEventListener('exporthub:shipment-updated',function(){repairContaminatedGoodsDescription();buildDynamicIndex();ensureSelector();if(d.body)queueFullTranslation()});\n"+
    "w.addEventListener('exporthub:task-updated',function(){repairContaminatedGoodsDescription();buildDynamicIndex();ensureSelector();if(d.body)queueFullTranslation()});";
  if(!source.includes(helper)){
    const count=source.split(before).length-1;
    if(count!==1)throw new Error('RC1507 i18n Sync-Anker '+count+'x gefunden');
    source=source.replace(before,after);
    fs.writeFileSync(runtimePath,source,'utf8');
  }
  const verified=fs.readFileSync(runtimePath,'utf8');
  if(!verified.includes(helper)||!verified.includes("w.addEventListener('exporthub:sync',function(event){if(isNoMergeSaveConfirmation(event))return;"))throw new Error('RC1507 i18n Save-Confirmation-Gate unvollstaendig');
  console.log('RC1507 i18n save-confirmation performance gate prepared');
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

applyRc1507I18nSaveConfirmationGate();

// RC1467 is intentionally always evaluated: it is idempotent and protects every
// release build against startup lifecycle events entering strict shipment validation.
await import('./rc1467-startup-avis-guard.mjs');
await import('./rc1470-new-shipment-clean-slate-hotfix.mjs');
await import('./rc1471-reminder-eligibility-hotfix.mjs');
await import('./rc1495-legacy-qr-persistence-hotfix.mjs');
await import('./rc1498-qr-status-sync-hotfix.mjs');
applyRc1505SaveConfirmationRenderGate();
await import('./rc1454-release-gate-hotfix.mjs');
await import('./rc1461-release-deepfix.mjs');

if(!rc1452Prepared())throw new Error('RC1462 pretest verification failed: RC1452/1453/1458/1466 preparation incomplete');
const rc1470Builder=fs.readFileSync(builderPath,'utf8');
const rc1507Runtime=fs.readFileSync(runtimePath,'utf8');
if(!rc1470Builder.includes('function patchRc1470NewShipmentCleanSlate(html,file){')||!rc1470Builder.includes('html=patchRc1470NewShipmentCleanSlate(html,file);'))throw new Error('RC1462 pretest verification failed: RC1470 clean-slate preparation incomplete');
if(!rc1470Builder.includes('function patchRc1471ReminderEligibility(html,file){')||!rc1470Builder.includes('html=patchRc1471ReminderEligibility(html,file);'))throw new Error('RC1462 pretest verification failed: RC1471 reminder eligibility preparation incomplete');
if(!rc1470Builder.includes('function patchRc1495LegacyQrPersistence(html,file){')||!rc1470Builder.includes('html=patchRc1495LegacyQrPersistence(html,file);'))throw new Error('RC1462 pretest verification failed: RC1495/RC1498 legacy QR persistence preparation incomplete');
if(!rc1470Builder.includes('function patchRc1498QrStatusSync(html,file){')||!rc1470Builder.includes('html=patchRc1498QrStatusSync(html,file);'))throw new Error('RC1462 pretest verification failed: RC1498 QR status sync preparation incomplete');
if(!rc1470Builder.includes('function patchRc1505SaveConfirmationRenderGate(html,file){')||!rc1470Builder.includes('html=patchRc1505SaveConfirmationRenderGate(html,file);'))throw new Error('RC1462 pretest verification failed: RC1505 save-confirmation render gate preparation incomplete');
if(!rc1507Runtime.includes('function isNoMergeSaveConfirmation(event){')||!rc1507Runtime.includes("w.addEventListener('exporthub:sync',function(event){if(isNoMergeSaveConfirmation(event))return;"))throw new Error('RC1462 pretest verification failed: RC1507 i18n save-confirmation gate preparation incomplete');
console.log('RC1462 pretest orchestration verified idempotent with RC1467 startup guard, RC1470 clean-slate reset, RC1471 reminder eligibility, RC1498 QR persistence/status sync, RC1505 save-confirmation render gate and RC1507 i18n performance gate');
