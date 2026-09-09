import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const OUT=path.join(ROOT,'dist-rc1013');
const VERSION='RC1013';
const CACHE='1013';
const HUB_SRC='/assets/exporthub-environment-hub.js?v=1013';
const DEMO_SRC='/assets/exporthub-demo-bootstrap.js?v=1013';
const SOP_RELEASE_SRC='/assets/sop/rc1010-sop-release.js?v=1010';
const SOP_STABILITY_SRC='/assets/sop/rc1013-sop-stability.js?v=1013';
const CALENDAR_CSS='/assets/abholkalender.css?v=1012';
const CALENDAR_JS='/assets/abholkalender.js?v=1012';
const CALENDAR_RUNTIME='/assets/rc1012-abholkalender-runtime.js?v=1012';
const DIAGNOSTICS_SRC='/assets/rc1013-diagnostics.js?v=1013';
const GATE41_UI_SRC='/assets/rc1013-gate41-ui.js?v=1013';
const RELEASE_ENVIRONMENTS=['environment=production-candidate','environment=testservice','environment=demo'];
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
function write(rel,content){const file=path.join(OUT,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);}
function copy(rel){const src=path.join(ROOT,rel),dst=path.join(OUT,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);}
const sha=content=>crypto.createHash('sha256').update(content).digest('hex');

function setVersion(html){
  let out=html.replace(/var BUILD=Object\.freeze\(\{version:'RC\d+',cache:'\d+',loginReturn:'([^']*)'\}\);/,(_m,ret)=>{const next=String(ret||'').replace(/v=\d+/,'v=1013');return `var BUILD=Object.freeze({version:'${VERSION}',cache:'${CACHE}',loginReturn:'${next}'});`;});
  out=out.replace(/(window\.__EXPORTHUB_BUILD__\s*=\s*['"])RC\d+(['"])/g,`$1${VERSION}$2`);
  return out;
}
function injectBeforeHeadClose(html,tag,id){if(html.includes(`id="${id}"`)||html.includes(`id='${id}'`))return html;const idx=html.search(/<\/head\s*>/i);if(idx<0)throw new Error('Kein </head> gefunden.');return html.slice(0,idx)+tag+'\n'+html.slice(idx);}
function injectAfterHeadOpen(html,tag,id){if(html.includes(`id="${id}"`)||html.includes(`id='${id}'`))return html;const m=html.match(/<head(?:\s[^>]*)?>/i);if(!m||m.index==null)throw new Error('Kein <head> gefunden.');const idx=m.index+m[0].length;return html.slice(0,idx)+'\n'+tag+'\n'+html.slice(idx);}
function envTag(env){return `<script id="exporthub-rc1013-env-config">window.__EXPORTHUB_FORCED_ENVIRONMENT__=${JSON.stringify(env)};<\/script>\n<script id="exporthub-rc1013-env-hub" defer src="${HUB_SRC}"><\/script>`;}
function demoTag(){return `<script id="exporthub-rc1013-demo-bootstrap" src="${DEMO_SRC}"><\/script>`;}
function sopReleaseTag(){return `<script id="exporthub-rc1013-sop-release" src="${SOP_RELEASE_SRC}"><\/script>\n<script id="exporthub-rc1013-sop-stability" defer src="${SOP_STABILITY_SRC}"><\/script>`;}
function calendarTags(){return `<link id="exporthub-rc1013-calendar-css" rel="stylesheet" href="${CALENDAR_CSS}">\n<script id="exporthub-rc1013-calendar-core" defer src="${CALENDAR_JS}"><\/script>\n<script id="exporthub-rc1013-calendar-runtime" defer src="${CALENDAR_RUNTIME}"><\/script>`;}
function diagnosticTags(){return `<script id="exporthub-rc1013-diagnostics" defer src="${DIAGNOSTICS_SRC}"><\/script>\n<script id="exporthub-rc1013-gate41-ui" defer src="${GATE41_UI_SRC}"><\/script>`;}
function marker(html,env){const m=`<!-- ExportHUB ${VERSION} environment=${env} -->`;return html.includes(m)?html:html.replace(/<html([^>]*)>/i,`<html$1>\n${m}`);}
function demoAsset(){return read('assets/exporthub-demo-bootstrap.js').replace(/revision:\d+/g,'revision:1013').replace(/clientVersion:'RC\d+-demo'/g,"clientVersion:'RC1013-demo'").replace(/version:'RC\d+'/g,"version:'RC1013'").replace(/eh\d+-demo-banner/g,'eh1013-demo-banner');}

function applyGate41Fallback(html){
  let out=html;
  const before='function setRouteData(x,countryKey){';
  const after='function setRouteData(x,countryKey,fallbackCountry){';
  if(!out.includes(after)){if(!out.includes(before))throw new Error('Gate41 setRouteData-Pfad nicht gefunden.');out=out.replace(before,after);}
  if(!out.includes('var dc=countryName(d.country)||q(fallbackCountry);')){if(!out.includes('var dc=countryName(d.country);'))throw new Error('Gate41 Länderableitung nicht gefunden.');out=out.replace('var dc=countryName(d.country);','var dc=countryName(d.country)||q(fallbackCountry);');}
  if(!out.includes("setRouteData(u,'destinationCountry');setRouteData(g,'country','Deutschland');")){const call="setRouteData(u,'destinationCountry');setRouteData(g,'country');";if(!out.includes(call))throw new Error('Gate41 Route-Aufruf nicht gefunden.');out=out.replace(call,"setRouteData(u,'destinationCountry');setRouteData(g,'country','Deutschland');");}
  return out;
}
function applyQrServerToken(html){
  let out=html;const strictError="throw new Error('Der QR-Server hat keinen gültigen sicheren Pickup-Token geliefert.');";const direct=/if\(!\/\^\[a-f0-9\]\{48\}\$\/i\.test\(serverToken\)\)throw new Error\('RC995: Der Server hat keinen gültigen sicheren Pickup-Token geliefert\.'\);/g;out=out.replace(direct,`if(!validToken(serverToken))${strictError}`);const done='function done(data,compat){var beforeDone=syncSnapshot(sh),existingRegisteredAt=';if(!out.includes('serverToken=q(data&&data.token)')){if(!out.includes(done))throw new Error('QR done()-Pfad nicht gefunden.');out=out.replace(done,`function done(data,compat){var serverToken=q(data&&data.token);if(!validToken(serverToken))${strictError}var beforeDone=syncSnapshot(sh),existingRegisteredAt=`);}if(!out.includes('validToken(serverToken)'))throw new Error('QR Server-Token wird nicht mit validToken geprüft.');const base='var basePatch={pickupQrRegistered:true';const patched='var basePatch={pickupToken:serverToken,pickupQrToken:serverToken,qrPickupToken:serverToken,qrToken:serverToken,pickupQrRegistered:true';if(!out.includes(patched)){if(!out.includes(base))throw new Error('QR basePatch-Pfad nicht gefunden.');out=out.replace(base,patched);}return out;
}
function enhanceEnvironmentHub(src){
  const replacement=`function diagnosticPayload(record,count=1){
  const rec=record||{};
  const formatter=window.ExportHUBRC1013Diagnostics;
  const d=formatter&&typeof formatter.describe==='function'?formatter.describe(rec):null;
  const area=String(rec.area||'System').replace(/\\s+/g,' ').trim().slice(0,80);
  const message=String(rec.message||'Technischer ExportHUB-Hinweis').replace(/\\s+/g,' ').trim().slice(0,260);
  const id=String(rec.id||\`diag:\${Number(rec.seq||0)}:\${String(rec.category||'diagnostics')}:\${area}\`);
  const prefix=count>1?count+' neue Diagnoseereignisse.\\n':'';
  const body=d?prefix+'Fehlercode: '+d.code+'\\nBenutzer: '+d.user+(d.userId&&d.userId!=='—'?' · '+d.userId:'')+'\\nFirma: '+d.company+'\\nBedeutung: '+d.meaning+'\\nWahrscheinliche Ursache: '+d.cause+'\\nNächster Schritt: '+d.nextStep+'\\nTechnische Meldung: '+d.technicalMessage:prefix+area+': '+message;
  return {channel:'diagnostic',key:id,title:'ExportHUB Fehlerdiagnose',body,route:'diagnostics'};
}
`;
  const rx=/function diagnosticPayload\(record,count=1\)\{[\s\S]*?\n\}\n(?=function notifyDiagnostic)/;if(!rx.test(src))throw new Error('Diagnose-Push-Pfad im Environment-Hub nicht gefunden.');return src.replace(rx,replacement);
}
function injectCalendarMenu(html){if(html.includes("view:'pickupcalendar',label:'Abholkalender',right:'pickupcalendar'"))return html;const stateAt=html.indexOf('function state(){');const itemsAt=stateAt>=0?html.lastIndexOf('var ITEMS=',stateAt):html.indexOf('var ITEMS=');if(itemsAt<0)throw new Error('Kanonische ITEMS-Navigation nicht gefunden.');const arrayStart=html.indexOf('[',itemsAt),arrayEnd=html.indexOf('];',arrayStart);if(arrayStart<0||arrayEnd<0)throw new Error('Kanonische ITEMS-Liste unvollständig.');const item="{view:'pickupcalendar',label:'Abholkalender',right:'pickupcalendar'}",block=html.slice(arrayStart,arrayEnd),taskAt=block.indexOf("view:'tasks'");if(taskAt>=0){const objectEnd=block.indexOf('}',taskAt);if(objectEnd<0)throw new Error('Aufgaben-Menüeintrag unvollständig.');const absolute=arrayStart+objectEnd+1;return html.slice(0,absolute)+','+item+html.slice(absolute);}return html.slice(0,arrayEnd)+','+item+html.slice(arrayEnd);}
function prepare(html,env,isDemo=false){let out=setVersion(html);out=applyGate41Fallback(out);out=applyQrServerToken(out);out=injectCalendarMenu(out);if(isDemo)out=injectAfterHeadOpen(out,demoTag(),'exporthub-rc1013-demo-bootstrap');out=injectBeforeHeadClose(out,sopReleaseTag(),'exporthub-rc1013-sop-release');out=injectBeforeHeadClose(out,calendarTags(),'exporthub-rc1013-calendar-css');out=injectBeforeHeadClose(out,diagnosticTags(),'exporthub-rc1013-diagnostics');out=injectBeforeHeadClose(out,envTag(env),'exporthub-rc1013-env-config');return marker(out,env==='production'?'production-candidate':env);}

const production=prepare(read('index.html'),'production');
const testservice=prepare(read('TESTVERSION.html'),'testservice');
const demo=prepare(read('TESTVERSION.html'),'demo',true);
const environmentHub=enhanceEnvironmentHub(read('assets/exporthub-environment-hub.js'));
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
write('index.html',production);write('TESTVERSION.html',testservice);write('demo.html',demo);
write('assets/exporthub-environment-hub.js',environmentHub);write('assets/exporthub-demo-bootstrap.js',demoAsset());copy('assets/sop/rc1010-sop-release.js');copy('assets/sop/rc1013-sop-stability.js');
copy('assets/abholkalender.js');copy('assets/abholkalender.css');copy('assets/rc1012-abholkalender-runtime.js');copy('assets/rc1013-diagnostics.js');copy('assets/rc1013-gate41-ui.js');
write('rc1013-manifest.json',JSON.stringify({schema:'exporthub-rc1013-three-env-v1',version:VERSION,generatedAt:new Date().toISOString(),releaseEnvironments:RELEASE_ENVIRONMENTS,sopRelease:'assets/sop/rc1010-sop-release.js',sopStability:'assets/sop/rc1013-sop-stability.js',calendar:{core:'assets/abholkalender.js',style:'assets/abholkalender.css',runtime:'assets/rc1012-abholkalender-runtime.js'},fixes:{gate41:'Deutschland-Fallback und sichtbarer Preisstatus',pickup:'Server-Token wird nach QR-Registrierung synchronisiert; abgeschlossener Status bleibt lesbar',diagnostics:'strukturierte Fehlercodes und Erklärungen',sop:'Filter-Render wird aus laufenden DOM-Events entkoppelt',storage:'transiente Azure-Fehler werden wiederholt',android:'native Direktansicht'},environments:{production:{file:'index.html',sha256:sha(production)},testservice:{file:'TESTVERSION.html',sha256:sha(testservice)},demo:{file:'demo.html',sha256:sha(demo)}}},null,2)+'\n');
console.log('RC1013 build ready: Diagnoseursachen, Gate41, QR-Abholung, SOP-Stabilität und Storage-Resilienz in Produktion, TESTSERVICE und Demo');
