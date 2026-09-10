import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {patchCriticalShipmentFlow} from './patch-calendar-shipment.mjs';
import {patchCalendarUserPermissions} from './patch-calendar-user-permissions.mjs';

const ROOT=process.cwd();
const SRC=path.join(ROOT,'dist-rc1016');
const OUT=path.join(ROOT,'dist-rc1018');
const VERSION='RC1018';
const CACHE='1018';
const MAIL_TAG='<script id="exporthub-rc1018-mail-language-standard" defer src="/assets/rc1018-mail-language-standard.js?v=1018"></script>';
const SOP_IMAGES_TAG='<script id="exporthub-rc1018-sop-system-images" defer src="/assets/sop/rc1018-sop-system-images.js?v=1018"></script>';
const SHIPMENT_CONTROLLER_ID='exporthub-rc373-shipment-controller';
const SAVE_RUNTIME_ID='rc565-end-to-end-function-core';

function read(rel){return fs.readFileSync(path.join(ROOT,rel),'utf8')}
function write(rel,content){const file=path.join(OUT,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content)}
function injectBeforeHeadClose(html,tag,id){if(html.includes(`id="${id}"`)||html.includes(`id='${id}'`))return html;const idx=html.search(/<\/head\s*>/i);if(idx<0)throw new Error(`${id}: </head> fehlt`);return html.slice(0,idx)+tag+'\n'+html.slice(idx)}
function injectSopImages(html){
  if(html.includes('id="exporthub-rc1018-sop-system-images"'))return html;
  const rx=/(<script\s+id=["']exporthub-rc1016-sop-consolidation["'][^>]*><\/script>)/i;
  if(!rx.test(html))throw new Error('RC1018 SOP-Systembilder: RC1016 Konsolidierung nicht gefunden.');
  return html.replace(rx,`$1\n${SOP_IMAGES_TAG}`);
}
function setVersion(html){
  let out=html.replace(/ExportHUB RC1016 environment=/g,'ExportHUB RC1018 environment=');
  out=out.replace(/version:'RC1016'/g,"version:'RC1018'");
  out=out.replace(/cache:'1016'/g,"cache:'1018'");
  out=out.replace(/(window\.__EXPORTHUB_BUILD__\s*=\s*['"])RC1016(['"])/g,'$1RC1018$2');
  return out
}
function scriptBlock(html,id){
  const escaped=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const open=new RegExp(`<script\\b[^>]*id=["']${escaped}["'][^>]*>`,'i');
  const match=open.exec(html);
  if(!match)throw new Error(`${id}: Scriptblock fehlt`);
  const start=match.index,end=html.indexOf('</script>',start+match[0].length);
  if(end<0)throw new Error(`${id}: </script> fehlt`);
  return html.slice(start,end+'</script>'.length)
}
function replaceScriptBlock(html,id,canonicalBlock){
  const current=scriptBlock(html,id);
  return html.replace(current,canonicalBlock)
}
function bridgeMultiTruckSaveRuntime(html){
  let out=html;
  const exportMarker='window.rc1017SyncSubShipments=rc1017SyncSubShipments;';
  const stowAnchor="function stowRows(){return arr(shipment().rows).map(normalizeRow).filter(function(r){return q(r.type)>''&&num(r.count)>0})}";
  let controller=scriptBlock(out,SHIPMENT_CONTROLLER_ID);
  if(!controller.includes(exportMarker)){
    const count=controller.split(stowAnchor).length-1;
    if(count!==1)throw new Error(`RC1018 Mehr-LKW-Brücke: stowRows-Anker ${count}x im Sendungscontroller gefunden`);
    controller=controller.replace(stowAnchor,exportMarker+'\n'+stowAnchor);
    out=replaceScriptBlock(out,SHIPMENT_CONTROLLER_ID,controller);
  }

  const unsafeCall='rc1017SyncSubShipments(saved);';
  const safeCall="if(typeof window.rc1017SyncSubShipments!=='function')throw new Error('RC1018 Mehr-LKW-Synchronisierung ist nicht verfügbar.');window.rc1017SyncSubShipments(saved);";
  const statusAnchor="if(!q(saved.status))saved.status='Entwurf';";
  let saveRuntime=scriptBlock(out,SAVE_RUNTIME_ID);
  if(!saveRuntime.includes('window.rc1017SyncSubShipments(saved);')){
    const unsafeCount=saveRuntime.split(unsafeCall).length-1;
    if(unsafeCount===1){
      saveRuntime=saveRuntime.replace(unsafeCall,safeCall);
    }else if(unsafeCount===0){
      const statusCount=saveRuntime.split(statusAnchor).length-1;
      if(statusCount!==1)throw new Error(`RC1018 Mehr-LKW-Brücke: RC565 Statusanker ${statusCount}x gefunden`);
      saveRuntime=saveRuntime.replace(statusAnchor,safeCall+statusAnchor);
    }else{
      throw new Error(`RC1018 Mehr-LKW-Brücke: unsicherer RC565-Aufruf ${unsafeCount}x gefunden`);
    }
    out=replaceScriptBlock(out,SAVE_RUNTIME_ID,saveRuntime);
  }
  return out
}
function assertMultiTruckSaveBridge(html,file){
  const controller=scriptBlock(html,SHIPMENT_CONTROLLER_ID),saveRuntime=scriptBlock(html,SAVE_RUNTIME_ID);
  if(!controller.includes('window.rc1017SyncSubShipments=rc1017SyncSubShipments;'))throw new Error(`${file}: RC373 exportiert rc1017SyncSubShipments nicht`);
  if(!saveRuntime.includes('window.rc1017SyncSubShipments(saved);'))throw new Error(`${file}: RC565 nutzt die globale Mehr-LKW-Brücke nicht`);
  if(/(^|[^.\w])rc1017SyncSubShipments\(saved\);/.test(saveRuntime))throw new Error(`${file}: RC565 enthält weiterhin den nicht sichtbaren privaten Mehr-LKW-Aufruf`);
}

execFileSync(process.execPath,['.github/rc1016/build-three-env.mjs'],{cwd:ROOT,stdio:'inherit'});
fs.rmSync(OUT,{recursive:true,force:true});
fs.cpSync(SRC,OUT,{recursive:true});

let canonicalProduction=fs.readFileSync(path.join(OUT,'index.html'),'utf8');
canonicalProduction=bridgeMultiTruckSaveRuntime(canonicalProduction);
const canonicalShipmentController=scriptBlock(canonicalProduction,SHIPMENT_CONTROLLER_ID);
for(const marker of ['function rc1017FitRows(','function rc1017SyncSubShipments(','function renderRc1017SubShipments(','function rc1017ActivateSubShipmentQr(','rc1017-print-subshipment','rc1017-qr-subshipment','rc1017-stow-subshipment','window.rc1017SyncSubShipments=rc1017SyncSubShipments;']){
  if(!canonicalShipmentController.includes(marker))throw new Error(`RC1018 kanonischer Sendungscontroller ohne Mehr-LKW-Marker: ${marker}`);
}

for(const file of ['index.html','TESTVERSION.html','demo.html']){
  let html=fs.readFileSync(path.join(OUT,file),'utf8');
  html=bridgeMultiTruckSaveRuntime(html);
  if(file!=='index.html')html=replaceScriptBlock(html,SHIPMENT_CONTROLLER_ID,canonicalShipmentController);
  html=patchCriticalShipmentFlow(html);
  html=patchCalendarUserPermissions(html);
  html=setVersion(html);
  html=injectSopImages(html);
  html=injectBeforeHeadClose(html,MAIL_TAG,'exporthub-rc1018-mail-language-standard');
  assertMultiTruckSaveBridge(html,file);
  write(file,html);
}

for(const asset of ['assets/rc1018-mail-language-standard.js','assets/rc1018-public-language.js'])write(asset,read(asset));
for(const page of ['customer-avis.html','pickup.html','location.html','pod-notfall.html'])if(fs.existsSync(path.join(ROOT,page)))write(page,read(page));

let probe=read('production-version.js').replace(/RC1016/g,'RC1018').replace(/1016/g,'1018');
if(!probe.includes("__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1018'"))probe="window.__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1018';\n// RC1018 gemeinsamer Mail- und Sprachstandard für Produktion, TESTSERVICE und Demo\n";
write('production-version.js',probe);

const manifest={
  schema:'exporthub-rc1018-three-env-v1',
  version:VERSION,
  cache:CACHE,
  sourceRelease:'RC1016',
  retainedReleaseAssets:{multiTruck:'assets/rc1017-multi-truck.js'},
  synchronizedRuntime:{shipmentController:SHIPMENT_CONTROLLER_ID,multiTruck:true,multiTruckSaveBridge:true,mainAddressWithLocations:true,calendarUserPermissions:true},
  sop:{systemImages:'assets/sop/rc1018-sop-system-images.js',screenshotDirectory:'assets/sop/screenshots'},
  mail:{runtime:'assets/rc1018-mail-language-standard.js',targets:['customer','carrier'],languages:['de','en'],exclusiveModes:['details','avis']},
  publicLanguage:{runtime:'assets/rc1018-public-language.js',pages:['customer-avis.html','pickup.html','location.html'],languages:['de','en']},
  environments:{production:'index.html',testservice:'TESTVERSION.html',demo:'demo.html'}
};
write('rc1018-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('RC1018 build ready: Mehr-LKW-Speicherbrücke, Hauptadresse plus Zusatzstandorte, Kalender-Benutzerrechte, Lieferavis-Draft, Mailvorlagen, SOP-Systembilder und DE/EN in Produktion, TESTSERVICE und Demo.');