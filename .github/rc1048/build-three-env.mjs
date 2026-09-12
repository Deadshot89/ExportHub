import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const SRC=path.join(ROOT,'dist-rc1047');
const OUT=path.join(ROOT,'dist-rc1048');
const VERSION='RC1048';
const NUMBER='1048';
const RC1065_CC_ID='exporthub-rc1065-registration-cc';
const RC1065_CC_TAG='<script id="'+RC1065_CC_ID+'" defer src="/assets/rc1065-registration-cc.js?v=1065"></script>';
const RC1061_MIGRATION_ID='exporthub-rc1061-document-migration-admin';
const RC1061_MIGRATION_TAG='<script id="'+RC1061_MIGRATION_ID+'" defer src="/assets/rc1061-document-migration-admin.js?v=1066"></script>';
const RC1063_ABD_BLOB_ID='exporthub-rc1063-abd-blob-viewer-compat';
const RC1063_ABD_BLOB_TAG='<script id="'+RC1063_ABD_BLOB_ID+'" defer src="/assets/rc1063-abd-blob-viewer-compat.js?v=1063"></script>';
const RC1067_STARTUP_ID='exporthub-rc1067-startup-recovery';
const RC1067_STARTUP_TAG='<script id="'+RC1067_STARTUP_ID+'" defer src="/assets/rc1067-startup-recovery.js?v=1067"></script>';

function replaceBetween(source,start,end,replacement,label){
  const a=source.indexOf(start),b=a>=0?source.indexOf(end,a+start.length):-1;
  if(a<0||b<0)throw new Error(label+': Anker fehlt');
  return source.slice(0,a)+replacement+source.slice(b);
}
function replaceOne(source,before,after,label){
  const count=source.split(before).length-1;
  if(count!==1)throw new Error(label+': Anker '+count+'x gefunden');
  return source.replace(before,after);
}
function injectBeforeHeadClose(html,tag,id){
  if(html.includes('id="'+id+'"')||html.includes("id='"+id+"'"))return html;
  const idx=html.search(/<\/head\s*>/i);
  if(idx<0)throw new Error(id+': </head> fehlt');
  return html.slice(0,idx)+tag+'\n'+html.slice(idx);
}

function repairPrintStowInjectedPageBlocks(html,file){
  const fn=html.indexOf('function printStow(){');
  if(fn<0)return html;
  const anchor="'+card.innerHTML+'";
  const start=html.indexOf(anchor,fn);
  if(start<0)return html;
  const payloadStart=start+anchor.length;
  const endMarker="</body></html>';var w=window.open";
  const end=html.indexOf(endMarker,payloadStart);
  if(end<0)return html;
  const payload=html.slice(payloadStart,end);
  if(!/[<](?:script|style|link|section|div)\b/i.test(payload))return html;
  let out=html.slice(0,payloadStart)+html.slice(end);
  const bodyClose=out.toLowerCase().lastIndexOf('</body>');
  if(bodyClose<0)throw new Error(file+': echtes </body> für Stauplan-Reparatur fehlt');
  out=out.slice(0,bodyClose)+'\n'+payload.trim()+'\n'+out.slice(bodyClose);
  return out;
}

function patchEmbeddedPrintScriptClosers(html,file){
  const start=html.indexOf('function printStow(){');
  const end=start>=0?html.indexOf('function normalizeActionButtons',start):-1;
  if(start<0||end<0)return html;
  const block=html.slice(start,end);
  const hits=(block.match(/<\/script\s*>/gi)||[]).length;
  if(hits===0)return html;
  const fixed=block
    .replace(/(<script\b[^>]*rc1059-document-blob\.js[^>]*>)[\r\n\t ]*<\/script\s*>/gi,'$1<\\/script>')
    .replace(/<\/script\s*>/gi,'<\\/script>')
    .replace(/<\\\/script>[\r\n]+/gi,'<\\/script>');
  return html.slice(0,start)+fixed+html.slice(end);
}

function patchGateMaster(html,file){
  let out=html;

  const oldZoneFallback="var originPostal=q(g.originPostal),originZone=/^[1-8]/.test(originPostal)?originPostal.charAt(0):'';if(originZone)return{value:originZone,automatic:true,source:'Start-PLZ'};return{value:q(g.manualTollZone||g.tollZone||g.zone),automatic:false,source:'manuell'}";
  const newZoneFallback="return{value:q(g.manualTollZone||g.tollZone||g.zone),automatic:false,source:'manuell'}";
  out=replaceOne(out,oldZoneFallback,newZoneFallback,file+' Gate41-Zone nur aus Stammdaten');

  const helpers=`
function gateMasterUser(){try{return window.__EXPORTHUB_GET_CURRENT_USER__?window.__EXPORTHUB_GET_CURRENT_USER__():(window.currentUser||state().currentUser||null)}catch(_){return window.currentUser||state().currentUser||null}}
function gateMasterAdmin(){var u=gateMasterUser()||{},key=low(u.user||u.login||u.username||u.name||state().loggedInUser||''),role=low(u.role||u.rolle),rights=u.rights||{},r=rights.shippingcosts||rights.shippingCosts||rights.shipping||{};if(u.globalAdmin===true||u.isAdmin===true||u.admin===true||key==='tobias'||key==='t.limberg'||key==='tobias limberg'||key==='tobias.limberg'||arr(u.permissions).indexOf('*')>=0||/global.?admin|vollzugriff|administrator/.test(role))return true;return r.admin===true||r.functionAdmin===true||low(r.level||r.access)==='admin'}
function gateMasterTariffs(){var s=state();s.shippingTariffs=s.shippingTariffs&&typeof s.shippingTariffs==='object'?s.shippingTariffs:{};return s.shippingTariffs}
function gateMasterZoneText(){var z=gateMasterTariffs().gate41Zones;if(!z)return'';if(Array.isArray(z))return z.map(function(r){var p=q(r&&(r.postalPrefix||r.prefix||r.postal||r.zip)),zone=q(r&&(r.zone||r.value));return p&&zone?p+'='+zone:''}).filter(Boolean).join('\\n');if(obj(z))return Object.keys(z).map(function(k){var v=z[k];if(obj(v))v=v.zone||v.value;return q(k)&&q(v)?q(k)+'='+q(v):''}).filter(Boolean).join('\\n');return''}
function gateMasterTollText(){var t=gateMasterTariffs().gate41TollRates;if(!t)return'';var rows=[];if(Array.isArray(t)){t.forEach(function(r){var zone=q(r&&r.zone),max=num(r&&(r.maxKg||r.to||r.weight)),price=num(r&&(r.price||r.value));if(zone&&max>0&&price>=0)rows.push(zone+';'+max+';'+price.toFixed(2).replace('.',','))})}else if(obj(t)){Object.keys(t).forEach(function(zone){var e=t[zone];if(Array.isArray(e))e.forEach(function(r){var max=num(r&&(r.maxKg||r.to||r.weight)),price=num(r&&(r.price||r.value));if(max>0&&price>=0)rows.push(q(zone)+';'+max+';'+price.toFixed(2).replace('.',','))});else if(obj(e))Object.keys(e).forEach(function(max){var price=num(e[max]);if(num(max)>0&&price>=0)rows.push(q(zone)+';'+num(max)+';'+price.toFixed(2).replace('.',','))})})}return rows.join('\\n')}
function gateMasterTransit(){var t=gateMasterTariffs().gate41TransitTimes;if(!t)return'';if(typeof t==='string')return q(t);if(obj(t)){var v=t.DE||t.Deutschland||t.default;if(obj(v))v=v.transit||v.transitTime||v.runtime||v.default;return q(v)}return''}
function gateMasterStatus(){var zones=gateMasterZoneText().split(/\\n/).filter(Boolean).length,tolls=gateMasterTollText().split(/\\n/).filter(Boolean).length,transit=gateMasterTransit(),diesel=num(gateMasterTariffs().gate41DieselPrice);return{zones:zones,tolls:tolls,transit:!!transit,diesel:diesel>0}}
function gateMasterHtml(){if(!gateMasterAdmin())return'';var tar=gateMasterTariffs(),status=gateMasterStatus(),diesel=num(tar.gate41DieselPrice);return '<section id="rc1048GateMaster" class="card rc1048-gate-master"><div class="rc626-head"><div><span class="pill blue">ADMIN</span><h3>Gate41-Stammdaten Deutschland</h3><p class="rc626-muted">Nur echte Gate41-Werte pflegen. Diese Stammdaten steuern Laufzeit, PLZ→Mautzone, Mautbetrag und Dieselpreis automatisch für alle Sendungen.</p></div></div><div class="rc501-cost-grid"><label class="field">Dieselpreis €/l<input id="rc1048GateDieselMaster" type="number" min="0" step="0.01" value="'+esc(diesel?diesel.toFixed(2):'')+'"><small>Leer lassen, wenn kein zentraler Gate41-Dieselpreis gepflegt werden soll.</small></label><label class="field">Standard-Laufzeit Deutschland<input id="rc1048GateTransitMaster" value="'+esc(gateMasterTransit())+'" placeholder="Laufzeit laut Gate41"><small>Freitext gemäß aktueller Gate41-Vorgabe.</small></label></div><div class="grid2"><label class="field">PLZ → Mautzone<textarea id="rc1048GateZonesMaster" rows="8" placeholder="PLZ-Präfix=Zone, eine Zuordnung pro Zeile">'+esc(gateMasterZoneText())+'</textarea><small>Nur echte Gate41-Zuordnungen. Längere PLZ-Präfixe haben Vorrang.</small></label><label class="field">Mauttabelle<textarea id="rc1048GateTollMaster" rows="8" placeholder="Zone;bis kg;Maut EUR, eine Gewichtsstufe pro Zeile">'+esc(gateMasterTollText())+'</textarea><small>Dezimalpunkt oder Dezimalkomma möglich.</small></label></div><div class="rc626-warning"><b>Aktueller Stand:</b> '+status.zones+' PLZ-Zuordnung(en) · '+status.tolls+' Mautposition(en) · Laufzeit '+(status.transit?'gepflegt':'nicht gepflegt')+' · Diesel '+(status.diesel?'gepflegt':'nicht gepflegt')+'.</div><div class="toolbar"><button type="button" class="btn" data-rc501-action="gate-master-save" data-kind="gate">Gate41-Stammdaten speichern</button></div></section>'}
function gateMasterParseZones(text){var rows=[],errors=[];String(text||'').split(/\\r?\\n/).forEach(function(line,i){line=q(line);if(!line)return;var m=line.match(/^(\\d{1,5})\\s*[=;]\\s*([1-8])$/);if(!m){errors.push('PLZ-Zeile '+(i+1));return}rows.push({country:'DE',postalPrefix:m[1],zone:m[2]})});rows.sort(function(a,b){return b.postalPrefix.length-a.postalPrefix.length});return{rows:rows,errors:errors}}
function gateMasterParseToll(text){var toll={},errors=[];String(text||'').split(/\\r?\\n/).forEach(function(line,i){line=q(line);if(!line)return;var p=line.split(';').map(q);if(p.length!==3||!/^[1-8]$/.test(p[0])){errors.push('Maut-Zeile '+(i+1));return}var max=Number(String(p[1]).replace(',','.')),price=Number(String(p[2]).replace(',','.'));if(!(max>0)||!isFinite(price)||price<0){errors.push('Maut-Zeile '+(i+1));return}if(!toll[p[0]])toll[p[0]]=[];toll[p[0]].push({maxKg:max,price:Math.round(price*100)/100})});Object.keys(toll).forEach(function(z){toll[z].sort(function(a,b){return a.maxKg-b.maxKg})});return{toll:toll,errors:errors}}
function saveGateMaster(){if(!gateMasterAdmin()){alert('Keine Admin-Berechtigung für Gate41-Stammdaten.');return false}var dieselEl=document.getElementById('rc1048GateDieselMaster'),transitEl=document.getElementById('rc1048GateTransitMaster'),zonesEl=document.getElementById('rc1048GateZonesMaster'),tollEl=document.getElementById('rc1048GateTollMaster'),zones=gateMasterParseZones(zonesEl&&zonesEl.value),toll=gateMasterParseToll(tollEl&&tollEl.value),errors=zones.errors.concat(toll.errors);if(errors.length){alert('Gate41-Stammdaten prüfen: '+errors.join(', '));return false}var tar=gateMasterTariffs(),diesel=Number(String(dieselEl&&dieselEl.value||'').replace(',','.')),transit=q(transitEl&&transitEl.value);tar.gate41Zones=zones.rows;tar.gate41TollRates=toll.toll;if(diesel>0)tar.gate41DieselPrice=Math.round(diesel*100)/100;else delete tar.gate41DieselPrice;if(transit)tar.gate41TransitTimes={DE:transit};else delete tar.gate41TransitTimes;var g=costState().gate||{};delete g.autoZoneFound;delete g.autoZoneSource;delete g.autoTollFound;delete g.autoDieselPrice;g.shipmentRouteSignature='';persist('Gate41-Stammdaten gespeichert');syncCostFromShipment();renderShipping();return false}
`;

  out=replaceOne(out,'function gateHtml(){',helpers+'\nfunction gateHtml(){',file+' Gate41-Stammdatenfunktionen');

  const renderAnchor="+(mode==='ups'?upsHtml():gateHtml())+historyHtml()+'</div>'";
  const renderReplacement="+(mode==='ups'?upsHtml():gateHtml())+(mode==='gate'?gateMasterHtml():'')+historyHtml()+'</div>'";
  out=replaceOne(out,renderAnchor,renderReplacement,file+' Gate41-Stammdaten anzeigen');

  const clickAnchor="if(action==='save')return saveCost(kind);if(action==='new')return newCostRequest(kind);if(action==='delete')return deleteCost(q(b.getAttribute('data-id')));return false}";
  const clickReplacement="if(action==='save')return saveCost(kind);if(action==='new')return newCostRequest(kind);if(action==='gate-master-save')return saveGateMaster();if(action==='delete')return deleteCost(q(b.getAttribute('data-id')));return false}";
  out=replaceOne(out,clickAnchor,clickReplacement,file+' Gate41-Stammdaten speichern');

  for(const marker of ['rc1048GateMaster','function saveGateMaster()','function gateMasterParseZones(text)','function gateMasterParseToll(text)',"tar.gate41TransitTimes={DE:transit}","tar.gate41DieselPrice","mode==='gate'?gateMasterHtml()","action==='gate-master-save'"]){
    if(!out.includes(marker))throw new Error(file+': RC1048 Marker fehlt '+marker);
  }
  if(out.includes("source:'Start-PLZ'"))throw new Error(file+': erfundener Gate41-Zonenfallback Start-PLZ noch aktiv');
  return out;
}

function patchHtml(file){
  const target=path.join(OUT,file);
  let html=fs.readFileSync(target,'utf8');
  html=repairPrintStowInjectedPageBlocks(html,file);
  html=patchEmbeddedPrintScriptClosers(html,file);
  html=patchGateMaster(html,file);
  html=injectBeforeHeadClose(html,RC1065_CC_TAG,RC1065_CC_ID);
  if(file!=='demo.html'){
    html=injectBeforeHeadClose(html,RC1061_MIGRATION_TAG,RC1061_MIGRATION_ID);
    html=injectBeforeHeadClose(html,RC1063_ABD_BLOB_TAG,RC1063_ABD_BLOB_ID);
    html=injectBeforeHeadClose(html,RC1067_STARTUP_TAG,RC1067_STARTUP_ID);
  }
  html=html.replace(/ExportHUB RC1047 environment=/g,`ExportHUB ${VERSION} environment=`);
  html=html.replace(
    /var BUILD=Object\.freeze\(\{version:'RC1047',cache:'1047',loginReturn:'([^']*)'\}\);/,
    (_m,ret)=>{
      const next=String(ret||'').replace(/([?&]v=)1047/,'$1'+NUMBER);
      return `var BUILD=Object.freeze({version:'${VERSION}',cache:'${NUMBER}',loginReturn:'${next}'});`;
    }
  );
  html=html.replace(/(window\.__EXPORTHUB_BUILD__\s*=\s*['"])RC1047(['"])/g,`$1${VERSION}$2`);
  if(!html.includes(`version:'${VERSION}'`))throw new Error(file+': BUILD '+VERSION+' fehlt');
  if(!html.includes(`ExportHUB ${VERSION} environment=`))throw new Error(file+': Environment '+VERSION+' fehlt');
  fs.writeFileSync(target,html);
}

execFileSync(process.execPath,['.github/rc1047/build-three-env.mjs'],{cwd:ROOT,stdio:'inherit'});
fs.rmSync(OUT,{recursive:true,force:true});
fs.cpSync(SRC,OUT,{recursive:true});
for(const file of ['index.html','TESTVERSION.html','demo.html'])patchHtml(file);

const rc1065AssetSource=path.join(ROOT,'assets/rc1065-registration-cc.js');
const rc1065AssetTarget=path.join(OUT,'assets/rc1065-registration-cc.js');
if(!fs.existsSync(rc1065AssetSource))throw new Error('RC1065 Pflicht-CC Runtime fehlt');
fs.mkdirSync(path.dirname(rc1065AssetTarget),{recursive:true});
fs.copyFileSync(rc1065AssetSource,rc1065AssetTarget);

for(const rel of ['assets/rc1061-document-migration-admin.js','assets/rc1063-abd-blob-viewer-compat.js','assets/rc1067-startup-recovery.js']){
  const src=path.join(ROOT,rel),dst=path.join(OUT,rel);
  if(!fs.existsSync(src))throw new Error(rel+' fehlt für den finalen RC1048-Build');
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(src,dst);
}

const recoverySource=path.join(ROOT,'migration-recovery.html'),recoveryTarget=path.join(OUT,'migration-recovery.html');
if(!fs.existsSync(recoverySource))throw new Error('migration-recovery.html fehlt für RC1067');
fs.copyFileSync(recoverySource,recoveryTarget);

const probeFile=path.join(OUT,'production-version.js');
let probe=fs.readFileSync(probeFile,'utf8');
probe=probe.replace(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1047'/g,`__EXPORTHUB_PRODUCTION_VERSION_PROBE__='${VERSION}'`);
if(!probe.includes(`__EXPORTHUB_PRODUCTION_VERSION_PROBE__='${VERSION}'`))throw new Error('RC1048 Produktionsmarker fehlt');
fs.writeFileSync(probeFile,probe);

const previousManifest=JSON.parse(fs.readFileSync(path.join(SRC,'rc1047-manifest.json'),'utf8'));
fs.writeFileSync(path.join(OUT,'rc1048-manifest.json'),JSON.stringify({
  schema:'exporthub-rc1048-three-env-v1',
  version:VERSION,
  sourceRelease:'RC1047',
  sourceManifest:previousManifest,
  shippingCosts:{
    gate41MasterData:true,
    gate41ZoneSource:'maintained postal-prefix table only',
    gate41TollSource:'maintained zone-weight table only',
    gate41TransitSource:'maintained DE transit value',
    gate41DieselSource:'maintained tariff diesel price',
    noGuessedZoneFromOriginPostal:true
  },
  retainedPatches:{
    registrationMandatoryCc:{runtime:'assets/rc1065-registration-cc.js',version:'RC1065',required:['Sevastian Marcu','Daniel Ollmann']},
    documentMigration:{runtime:'assets/rc1061-document-migration-admin.js',version:'RC1066',batchSize:5,mode:'automatic-sequential-batches'},
    abdBlobViewerCompat:{runtime:'assets/rc1063-abd-blob-viewer-compat.js',version:'RC1063'},
    startupRecovery:{runtime:'assets/rc1067-startup-recovery.js',page:'migration-recovery.html',version:'RC1067',trigger:'stalled admin startup with inline legacy documents'}
  },
  environments:{production:'index.html',testservice:'TESTVERSION.html',demo:'demo.html'}
},null,2)+'\n');

console.log('RC1048 build ready: Gate41-Stammdaten für Laufzeit, PLZ-Zone, Maut und Diesel; keine geratenen Zonen mehr.');
