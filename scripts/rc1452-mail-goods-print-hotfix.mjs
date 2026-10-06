import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const write=(rel,content)=>fs.writeFileSync(path.join(ROOT,rel),content,'utf8');

function replaceOnce(source,before,after,label){
  if(source.includes(after))return source;
  const count=source.split(before).length-1;
  if(count!==1)throw new Error(`${label}: erwarteter Patch-Anker ${count}x gefunden`);
  return source.replace(before,after);
}

function patchInsideFunction(source,functionStart,nextFunction,before,after,label){
  const start=source.indexOf(functionStart);
  const end=start<0?-1:source.indexOf(nextFunction,start+functionStart.length);
  if(start<0||end<0)throw new Error(`${label}: Funktionsgrenze fehlt`);
  const block=source.slice(start,end);
  const patched=replaceOnce(block,before,after,label);
  return source.slice(0,start)+patched+source.slice(end);
}

// RC1452 root cause repair: clean every shipment collection, not only the currently
// edited shipment. The document/print view keeps the selected shipment in its own
// runtime, so the previous active-id-only repair could miss the exact object printed.
{
  const rel='assets/rc1267-i18n.js';
  let source=read(rel);
  source=source.replace("var VERSION='RC1267';","var VERSION='RC1452';");
  const before=" applicationStateRoots().forEach(function(root){shipmentDraftTargets(root).forEach(function(shipment){if(targets.indexOf(shipment)<0)targets.push(shipment)})});";
  const after=" applicationStateRoots().forEach(function(root){\n  shipmentDraftTargets(root).forEach(function(shipment){if(targets.indexOf(shipment)<0)targets.push(shipment)});\n  ['shipments','savedShipments','salesSharedShipments','sharedShipments','shipmentArchive','archivedShipments','archive'].forEach(function(name){\n   var list=root&&root[name];if(!Array.isArray(list))return;\n   list.forEach(function(shipment){if(shipment&&typeof shipment==='object'&&targets.indexOf(shipment)<0)targets.push(shipment)})\n  });\n  ['shipment','currentShipment','selectedShipment','activeShipment','editingShipment','documentShipment'].forEach(function(name){var shipment=root&&root[name];if(shipment&&typeof shipment==='object'&&targets.indexOf(shipment)<0)targets.push(shipment)});\n });";
  source=patchInsideFunction(source,'function repairContaminatedGoodsDescription(){','function snapshotShipmentDraft(){',before,after,'RC1452 shipment repair');

  // Run the repair synchronously before document actions. This guarantees that an
  // already open production session is cleaned before Ladeliste/CMR HTML is built.
  const clickAnchor="d.addEventListener('change',captureLanguageChange,true);";
  const clickPatch=`d.addEventListener('change',captureLanguageChange,true);\nfunction rc1452DocumentActionRepair(event){\n var target=event&&event.target&&event.target.closest?event.target.closest('[data-rc1283-action],[data-index352-action],[data-index352-doc],[data-rc1315-print-qr]'):null;\n if(target)repairContaminatedGoodsDescription();\n}\nd.addEventListener('click',rc1452DocumentActionRepair,true);`;
  source=replaceOnce(source,clickAnchor,clickPatch,'RC1452 print action repair');
  write(rel,source);
}

// RC1452 print safety net: even if a historic shipment is already contaminated in
// persisted data or a stale runtime copy, mail/AVIS text may never render in either
// the Ladeliste or CMR goods-description fields.
{
  const rel='.github/rc1112/build-three-env.mjs';
  let source=read(rel);
  source=source.replaceAll('/assets/rc1267-i18n.js?v=1267','/assets/rc1267-i18n.js?v=1452');
  const anchor="  let loadBlock=html.slice(loadStart,loadEnd);\n\n  loadBlock=loadBlock.replace(\"withQr?'1 / 1 · mit QR-Code':'ohne QR-Code'\"";
  const replacement=`  let loadBlock=html.slice(loadStart,loadEnd);\n\n  const rc1452GoodsHelper=\"function rc1452PrintGoodsDescription(sh){var v=q(sh&&(sh.goodsDescription||sh.warenbeschreibung||sh.description));if(!v)return'';var score=0;if(/(?:^|\\\\n)\\\\s*(?:LIEFERAVIS|COLLECTION NOTICE)\\\\b/i.test(v))score+=2;if(/Sehr geehrte Damen und Herren|Dear Sir or Madam|Mit freundlichen Gr[uü][sß]en|Kind regards/i.test(v))score++;if(/https?:\\\\/\\\\/|\\\\/avis\\\\/|customer-avis/i.test(v))score++;if(/Abholdatum|Zeitfenster|Kennzeichen des Abholfahrzeugs|pickup date|time window|license plate/i.test(v))score++;return score>=2?'':v}\";\n  loadBlock=rc1452GoodsHelper+'\\\\n'+loadBlock;\n  loadBlock=loadBlock.replace(/esc\\\\(q\\\\(sh&&sh\\\\.goodsDescription\\\\)\\\\)/g,'esc(rc1452PrintGoodsDescription(sh))');\n  loadBlock=loadBlock.replace(/q\\\\(sh&&sh\\\\.goodsDescription\\\\)/g,'rc1452PrintGoodsDescription(sh)');\n  loadBlock=loadBlock.replace(/esc\\\\(q\\\\(sh&&sh\\\\.warenbeschreibung\\\\)\\\\)/g,'esc(rc1452PrintGoodsDescription(sh))');\n  loadBlock=loadBlock.replace(/q\\\\(sh&&sh\\\\.warenbeschreibung\\\\)/g,'rc1452PrintGoodsDescription(sh)');\n  loadBlock=loadBlock.replace(/esc\\\\(q\\\\(sh&&sh\\\\.description\\\\)\\\\)/g,'esc(rc1452PrintGoodsDescription(sh))');\n  if(!loadBlock.includes('function rc1452PrintGoodsDescription(sh)'))throw new Error(file+': RC1452 Druck-Sanitizer fehlt');\n\n  loadBlock=loadBlock.replace(\"withQr?'1 / 1 · mit QR-Code':'ohne QR-Code'\"`;
  source=replaceOnce(source,anchor,replacement,'RC1452 print sanitizer');
  write(rel,source);
}

// Force the repaired i18n/runtime through browser caches for all public pages that
// can carry the central runtime directly. Build-generated main pages are covered by
// the RC1112 builder patch above.
for(const rel of ['pickup.html','customer-avis.html','location.html','pod-notfall.html','dist-rc1048/index.html','dist-rc1048/TESTVERSION.html','dist-rc1048/demo.html']){
  const file=path.join(ROOT,rel);
  if(!fs.existsSync(file))continue;
  const source=fs.readFileSync(file,'utf8');
  const next=source.replaceAll('/assets/rc1267-i18n.js?v=1267','/assets/rc1267-i18n.js?v=1452');
  if(next!==source)fs.writeFileSync(file,next,'utf8');
}

// RC1453: "Neue Sendung" keeps the mounted shipment DOM for performance. RC1414
// reset only the Colli rows, so remark textareas and file inputs could survive into
// the next draft. Extend the local reset without restoring the old full-page render.
// Input/change events are fired after clearing so the fresh draft state is updated,
// while the previously saved shipment stays untouched.
{
  const rel='.github/rc1112/build-three-env.mjs';
  let source=read(rel);
  const start='function patchRc1414ShipmentCreateNoRerender(html,file){';
  const next='function patchTaskDetailTab(html,file){';
  const helperBefore='  const resetHelper=" function resetMountedFreshDom(){';
  const helperAfter=`  const resetHelper=" function resetMountedFreshVolatile(){if(!preserveMountedShipment||!mountedLayout)return;var changed=[];try{Array.from(mountedLayout.querySelectorAll('textarea')).forEach(function(el){if(el.closest&&el.closest('#rc543MailArea,#rc363BlockMail'))return;var owner=el.closest&&el.closest('[data-rc896-field]'),key=((el.getAttribute&&el.getAttribute('data-rc408-shipment-field'))||el.name||el.id||(owner&&owner.getAttribute('data-rc896-field'))||'').toLowerCase(),label=el.closest&&el.closest('label'),text=((label&&label.textContent)||'').toLowerCase();if(!/(comment|remark|bemerk)/.test(key+' '+text))return;el.value='';changed.push(el)});Array.from(mountedLayout.querySelectorAll('input[type=file]')).forEach(function(el){try{el.value=''}catch(_){}changed.push(el)});changed.forEach(function(el){try{el.dispatchEvent(new Event(el.tagName==='INPUT'?'change':'input',{bubbles:true}))}catch(_){}if(el.tagName!=='INPUT')try{el.dispatchEvent(new Event('change',{bubbles:true}))}catch(_){}})}catch(e){console.error('RC1453 Neue Sendung volatile Felder',e)}}\\n function resetMountedFreshDom(){`;
  source=patchInsideFunction(source,start,next,helperBefore,helperAfter,'RC1453 volatile reset helper');
  source=patchInsideFunction(source,start,next,'safePatchDuringEdit();return true','safePatchDuringEdit();resetMountedFreshVolatile();return true','RC1453 volatile reset call');
  write(rel,source);
}

const runtime=read('assets/rc1267-i18n.js');
const builder=read('.github/rc1112/build-three-env.mjs');
if(!runtime.includes("var VERSION='RC1452';")||!runtime.includes('rc1452DocumentActionRepair'))throw new Error('RC1452 Runtime-Hotfix unvollständig');
if(!builder.includes('function rc1452PrintGoodsDescription(sh)')||!builder.includes('/assets/rc1267-i18n.js?v=1452'))throw new Error('RC1452 Druck-/Cache-Hotfix unvollständig');
if(!builder.includes('function resetMountedFreshVolatile()')||!builder.includes('resetMountedFreshVolatile();return true'))throw new Error('RC1453 Neue-Sendung-Reset unvollständig');
console.log('RC1452 mail/goodsDescription hotfix + RC1453 Neue-Sendung-Reset applied');
