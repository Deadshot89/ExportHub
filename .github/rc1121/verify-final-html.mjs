import fs from 'node:fs';
import path from 'node:path';
import {finalizeAutoUpdate} from '../rc1488/finalize-auto-update.mjs';
import {copyPackFiles,injectPackRuntime,injectDocumentUploadRuntime} from '../packmeldungen/build-three-env.mjs';

const ROOT=process.cwd();
const OUT=path.join(ROOT,'dist-rc1112');
const ARGS=process.argv.slice(2);
const FILES=ARGS.length?ARGS.map(p=>path.resolve(ROOT,p)):[
  path.join(OUT,'index.html'),
  path.join(OUT,'TESTVERSION.html'),
  path.join(OUT,'demo.html')
];
if(!ARGS.length){
  copyPackFiles(ROOT,OUT);
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const target=path.join(OUT,file);
    const html=fs.readFileSync(target,'utf8');
    fs.writeFileSync(target,injectPackRuntime(html,file));
  }
  const customerAvis=path.join(OUT,'customer-avis.html');
  if(fs.existsSync(customerAvis)){
    const avisHtml=fs.readFileSync(customerAvis,'utf8');
    const normalizedAvis=injectDocumentUploadRuntime(avisHtml,'customer-avis.html');
    if(!normalizedAvis.includes('id="exporthub-document-reference-normalizer"')||!normalizedAvis.includes('id="exporthub-document-upload-normalizer"'))throw new Error('customer-avis.html: Dokument-Upload-Normalisierung fehlt');
    fs.writeFileSync(customerAvis,normalizedAvis);
  }
}
const RC1488_MANIFEST=ARGS.length?null:finalizeAutoUpdate({root:ROOT,out:OUT});
const LEAKS=[
  /RC824_SOP_DETAILS/,
  /window\.rc524OpenTaskEditor/,
  /function\s+rc824SopList\s*\(/,
  /var\s+rightsModules\s*=/,
  /window\.rc524PalletReport\s*=/,
  /window\.open\(['"]about:blank['"]/,
  /function\s+normalizeActionButtons\s*\(/,
  /function\s+activateQr\s*\(/,
  /\/\*\s*exporthub-rc898-dashboard-only-compact-shipment-inline-avis\s*\*\//
];
function outsideExecutableBlocks(source){
  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ')
    .replace(/<!--[\s\S]*?-->/g,' ');
}
function count(source,needle){
  return source.split(needle).length-1;
}
function verify(p){
  const file=path.basename(p),html=fs.readFileSync(p,'utf8'),outside=outsideExecutableBlocks(html);
  for(const rx of LEAKS){
    if(rx.test(outside))throw new Error(file+': sichtbarer JavaScript-Code außerhalb <script>: '+rx);
  }
  const headOpen=/<head\b[^>]*>/i.exec(html);
  if(!headOpen)throw new Error(file+': <head> fehlt');
  const headClose=html.toLowerCase().indexOf('</head>',headOpen.index+headOpen[0].length);
  if(headClose<0)throw new Error(file+': </head> fehlt');
  for(const id of ['exporthub-rc1113-stowplan-persist','exporthub-rc1114-shipping-neutral']){
    const needle='id="'+id+'"',n=count(html,needle);
    if(n!==1)throw new Error(file+': '+id+' muss exakt 1x vorkommen, gefunden '+n);
    const at=html.indexOf(needle);
    if(at<headOpen.index||at>headClose)throw new Error(file+': '+id+' steht nicht im echten <head>');
  }
  if(!ARGS.length&&(file==='index.html'||file==='TESTVERSION.html')){
    const i18nNeedle='id="exporthub-rc1488-auto-update-i18n"';
    const runtimeNeedle='id="exporthub-rc1488-auto-update"';
    const i18nCount=count(html,i18nNeedle),runtimeCount=count(html,runtimeNeedle);
    if(i18nCount!==1)throw new Error(file+': RC1488 Sprachpaket muss exakt 1x vorkommen, gefunden '+i18nCount);
    if(runtimeCount!==1)throw new Error(file+': RC1488 Runtime muss exakt 1x vorkommen, gefunden '+runtimeCount);
    const i18nAt=html.indexOf(i18nNeedle),runtimeAt=html.indexOf(runtimeNeedle);
    if(i18nAt<headOpen.index||i18nAt>headClose)throw new Error(file+': RC1488 Sprachpaket steht nicht im echten <head>');
    if(runtimeAt<headOpen.index||runtimeAt>headClose)throw new Error(file+': RC1488 Runtime steht nicht im echten <head>');
    if(i18nAt>=runtimeAt)throw new Error(file+': RC1488 Sprachpaket muss vor der Runtime geladen werden');
    if(!RC1488_MANIFEST||!html.includes('data-build-id="'+RC1488_MANIFEST.buildId+'"'))throw new Error(file+': RC1488 Build-ID stimmt nicht mit dem Update-Probe überein');
    if(!html.includes('/assets/i18n/rc1488-auto-update.js?v=1488'))throw new Error(file+': RC1488 Update-Sprachpaket fehlt');
    if(!html.includes('/assets/rc1488-auto-update.js?v=1488'))throw new Error(file+': RC1488 Auto-Update-Runtime fehlt');
  }
  if(!ARGS.length&&file==='demo.html'&&(html.includes('id="exporthub-rc1488-auto-update"')||html.includes('id="exporthub-rc1488-auto-update-i18n"')))throw new Error(file+': RC1488 darf Demo nicht automatisch neu laden');
  const stow=html.indexOf('function printStow(){');
  const stowEnd=stow>=0?html.indexOf('function normalizeActionButtons',stow):-1;
  if(stow>=0&&stowEnd>stow){
    const block=html.slice(stow,stowEnd);
    if(/exporthub-rc1113-stowplan-persist|exporthub-rc1114-shipping-neutral/.test(block)){
      throw new Error(file+': RC1113/RC1114 Runtime steckt im Stauplan-Druckstring');
    }
    const unsafe=(block.match(/<\/script\s*>/gi)||[]).length;
    if(unsafe)throw new Error(file+': Stauplan-Druckblock enthält '+unsafe+' echtes </script>');
    if(block.includes('rc1059-document-blob.js')&&!/<\\\/script>/.test(block)){
      throw new Error(file+': rc1059 Loader ist im Stauplan nicht als <\\/script> escaped');
    }
  }
  const notificationStart=html.indexOf('<script id="index236-notification-controller">');
  const notificationEnd=notificationStart>=0?html.indexOf('<!-- INDEX 236 NOTIFICATION CENTER END -->',notificationStart):-1;
  if(notificationStart<0||notificationEnd<0)throw new Error(file+': Benachrichtigungsmodul fehlt');
  const notificationBlock=html.slice(notificationStart,notificationEnd);
  if(notificationBlock.includes("function taskTitle(t){return q(t&&(t.title||t.name||t.subject||'Aufgabe'))||'Aufgabe'}"))throw new Error(file+': alter Benachrichtigungs-Fallback Aufgabe noch aktiv');
  if(!notificationBlock.includes('function notificationTaskKey(t)'))throw new Error(file+': RC1123 Benachrichtigungs-Deduplizierung fehlt');
  if(!notificationBlock.includes("!taskForUser(t)||!taskTitle(t)"))throw new Error(file+': RC1123 filtert inhaltslose Aufgaben nicht');
  const codeLike=outside.match(/(?:^|\n)\s*(?:function\s+[A-Za-z_$][\w$]*\s*\(|var\s+[A-Za-z_$][\w$]*\s*=|window\.[A-Za-z_$][\w$]*\s*=|\/\*\s*exporthub-)/m);
  if(codeLike)throw new Error(file+': generischer sichtbarer Code-Leak: '+codeLike[0].slice(0,160));
  console.log(file+': vollständiger finaler HTML-/Script-Vertrag OK');
}
for(const file of FILES)verify(file);

if(!ARGS.length){
  const runtimeAsset=path.join(OUT,'assets','rc1488-auto-update.js');
  const i18nAsset=path.join(OUT,'assets','i18n','rc1488-auto-update.js');
  const probeFile=path.join(OUT,'production-version.js');
  if(!fs.existsSync(runtimeAsset)||fs.statSync(runtimeAsset).size===0)throw new Error('RC1488 Auto-Update-Asset fehlt im finalen Build');
  if(!fs.existsSync(i18nAsset)||fs.statSync(i18nAsset).size===0)throw new Error('RC1488 Auto-Update-Sprachpaket fehlt im finalen Build');
  if(!fs.existsSync(probeFile))throw new Error('RC1488 production-version.js fehlt im finalen Build');
  const probe=fs.readFileSync(probeFile,'utf8');
  if(!RC1488_MANIFEST||!probe.includes("window.__EXPORTHUB_UPDATE_BUILD__='"+RC1488_MANIFEST.buildId+"';"))throw new Error('RC1488 Build-ID fehlt im production-version.js Probe');
  if(!probe.includes("window.__EXPORTHUB_UPDATE_RELEASE__='"+RC1488_MANIFEST.visibleRelease+"';"))throw new Error('RC1488 sichtbare Release-ID fehlt im production-version.js Probe');
  for(const name of ['staticwebapp.config.json','staticwebapp.testservice.config.json']){
    const configFile=path.join(OUT,name);if(!fs.existsSync(configFile))continue;
    const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
    const route=(config.routes||[]).find(row=>row&&row.route==='/production-version.js');
    if(!route||!route.headers||!/no-store/i.test(String(route.headers['Cache-Control']||'')))throw new Error(name+': RC1488 production-version.js ist nicht no-store');
  }
  console.log('RC1488: Auto-Update Build-/Cache-Vertrag OK · '+RC1488_MANIFEST.buildId);
}
