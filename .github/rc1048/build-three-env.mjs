import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const SRC=path.join(ROOT,'dist-rc1047');
const OUT=path.join(ROOT,'dist-rc1048');
const VERSION='RC1048';
const NUMBER='1048';
const RC1065_CC_ID='exporthub-rc1065-registration-cc';
const RC1065_CC_TAG='<script id="'+RC1065_CC_ID+'" defer src="/assets/rc1065-registration-cc.js?v=1093"></script>';
const RC1061_MIGRATION_ID='exporthub-rc1061-document-migration-admin';
const RC1061_MIGRATION_TAG='<script id="'+RC1061_MIGRATION_ID+'" defer src="/assets/rc1061-document-migration-admin.js?v=1073"></script>';
const RC1063_ABD_BLOB_ID='exporthub-rc1063-abd-blob-viewer-compat';
const RC1063_ABD_BLOB_TAG='<script id="'+RC1063_ABD_BLOB_ID+'" defer src="/assets/rc1063-abd-blob-viewer-compat.js?v=1248"></script>';
const RC1067_STARTUP_ID='exporthub-rc1067-startup-recovery';
const RC1067_STARTUP_TAG='<script id="'+RC1067_STARTUP_ID+'" defer src="/assets/rc1067-startup-recovery.js?v=1067"></script>';
const RC1069_PERF_ID='exporthub-rc1069-performance';
const RC1069_PERF_TAG='<script id="'+RC1069_PERF_ID+'" defer src="/assets/rc1069-performance.js?v=1069"></script>';
const RC1071_HISTORY_ID='exporthub-rc1071-shipment-history';
const RC1071_HISTORY_TAG='<script id="'+RC1071_HISTORY_ID+'" defer src="/assets/rc1071-shipment-history.js?v=1095"></script>';
const RC1074_LOGIN_ID='exporthub-rc1074-login-clean';
const RC1074_LOGIN_TAG='<script id="'+RC1074_LOGIN_ID+'" defer src="/assets/rc1074-login-clean.js?v=1074"></script>';
const RC1075_LOADER_PIN_ID='exporthub-rc1075-loader-pin-admin';
const RC1075_LOADER_PIN_TAG='<script id="'+RC1075_LOADER_PIN_ID+'" defer src="/assets/rc1075-loader-pin-admin.js?v=1075"></script>';
const RC1077_CUSTOMER_LABELS_ID='exporthub-rc1077-customer-labels';
const RC1077_CUSTOMER_LABELS_TAG='<script id="'+RC1077_CUSTOMER_LABELS_ID+'" defer src="/assets/rc1077-customer-labels.js?v=1077"></script>';
const RC1079_PROFILE_ID='exporthub-rc1079-profile-settings';
const RC1079_PROFILE_TAG='<script id="'+RC1079_PROFILE_ID+'" defer src="/assets/rc1079-profile-settings.js?v=1079"></script>';
const RC1080_CUSTOMER_HISTORY_ID='exporthub-rc1080-customer-history';
const RC1080_CUSTOMER_HISTORY_TAG='<script id="'+RC1080_CUSTOMER_HISTORY_ID+'" defer src="/assets/rc1080-customer-history.js?v=1080"></script>';
const RC1081_AUDIT_HISTORY_ID='exporthub-rc1081-audit-history';
const RC1081_AUDIT_HISTORY_TAG='<script id="'+RC1081_AUDIT_HISTORY_ID+'" defer src="/assets/rc1081-audit-history.js?v=1087"></script>';
const RC1092_CONTACTS_ID='exporthub-rc1092-customer-mail-contacts';
const RC1092_CONTACTS_TAG='<script id="'+RC1092_CONTACTS_ID+'" defer src="/assets/rc1092-customer-mail-contacts.js?v=1092"></script>';
const RC1096_PACKAGING_ID='exporthub-rc1096-packaging-groups';
const RC1096_PACKAGING_TAG='<script id="'+RC1096_PACKAGING_ID+'" defer src="/assets/rc1096-packaging-groups.js?v=1110"></script>';

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
  const body=html.search(/<body\b/i),idx=(body>=0?html.slice(0,body):html).search(/<\/head\s*>/i);
  if(idx<0)throw new Error(id+': </head> fehlt');
  return html.slice(0,idx)+tag+'\n'+html.slice(idx);
}

function patchDeckblattContrast(html,file){
  let coverCount=0,refCount=0;
  let out=html.replace(/\.rc352-cover\{([^}]*)\}/g,function(full,body){
    if(!/background:#fff(?:;|$)/.test(body))return full;
    coverCount++;
    let next=body
      .replace('background:#fff','background:linear-gradient(180deg,#60a5fa 0,#93c5fd 58mm,#bfdbfe 58mm,#dbeafe 100%)')
      .replace('box-sizing:border-box!important;','box-sizing:border-box!important;border:8mm solid #08245d!important;')
      .replace('border-radius:14px','border-radius:0')
      .replace('box-shadow:0 18px 42px rgba(15,23,42,.12)','box-shadow:inset 0 0 0 2mm #1d4ed8')
      .replace('padding:12mm','padding:8mm');
    return '.rc352-cover{'+next+';-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'
  });
  out=out.replace(/\.rc352-cover-ref\{([^}]*)\}/g,function(full,body){
    if(!/background:#eff8ff(?:;|$)/.test(body))return full;
    refCount++;
    let next=body
      .replace('background:#eff8ff','background:#08245d')
      .replace('border:2px solid #60a5fa','border:3px solid #60a5fa');
    return '.rc352-cover-ref{'+next+';color:#fff!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'
  });
  out=out.replace(/(\.rc352-cover-ref span\{[^}]*?)color:#08245d/g,'$1color:#fff');
  out=out.replace(/(\.rc352-cover-ref strong\{)/g,'$1color:#fff!important;');
  out=out.replace(/\.rc352-qr-slot\.empty img\{display:none!important\}/g,'.rc352-cover .rc352-qr-slot{background:#fff!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}\\n.rc352-qr-slot.empty img{display:none!important}');
  if(!coverCount)throw new Error(file+': RC1111 Deckblatt-Grundfläche nicht gefunden');
  if(!refCount)throw new Error(file+': RC1111 Referenzfeld nicht gefunden');
  return out;
}

function patchPackagingGroups(html,file){
  const start=html.indexOf('function packagingList(){');
  const end=start>=0?html.indexOf('}function applyPackaging',start):-1;
  if(start<0||end<0)throw new Error(file+': packagingList/applyPackaging fehlt für RC1096');
  let block=html.slice(start,end+1);
  if(!/name:['"]Umschlag['"]/.test(block)){
    const before=block;
    block=block.replace(/sources\.push\(PACK\);/,"sources.push([{name:'Umschlag',l:0,w:0,h:0,ldm:0}]);sources.push(PACK);");
    if(block===before)throw new Error(file+': RC1096 Umschlag-Anker fehlt');
  }
  return html.slice(0,start)+block+html.slice(end+1);
}
function repairPrintStowInjectedPageBlocks(html,file){
  let out=html,cursor=0;
  const anchor="'+card.innerHTML+'";
  const moved=[];

  while(true){
    const fn=out.indexOf('function printStow(){',cursor);
    if(fn<0)break;

    const a=out.indexOf(anchor,fn);
    if(a<0){cursor=fn+'function printStow(){'.length;continue}
    const payloadStart=a+anchor.length;

    const win=out.indexOf('var w=window.open',payloadStart);
    if(win<0){cursor=payloadStart;continue}

    const close=out.lastIndexOf("</body></html>'",win);
    if(close<payloadStart){cursor=win;continue}

    const payload=out.slice(payloadStart,close);
    if(/[<](?:script|style|link|section|div)\b/i.test(payload)){
      const clean=payload.trim();
      if(clean)moved.push(clean);
      out=out.slice(0,payloadStart)+out.slice(close);
      cursor=payloadStart;
    }else{
      cursor=win;
    }
  }

  if(moved.length){
    const unique=Array.from(new Set(moved));
    const bodyClose=out.toLowerCase().lastIndexOf('</body>');
    if(bodyClose<0)throw new Error(file+': echter äußerer </body>-Anker fehlt');
    out=out.slice(0,bodyClose)+'\n'+unique.join('\n')+'\n'+out.slice(bodyClose);
  }

  return out;
}
function patchEmbeddedPrintScriptClosers(html,file){
  let out=html,cursor=0,movedStyle='',patched=0;
  const misplacedStyleRx=/<style\b[^>]*id=["']exporthub-rc373-customer-areas-style["'][^>]*>[\s\S]*?<\/style\s*>/i;

  while(true){
    const start=out.indexOf('function printStow(){',cursor);
    if(start<0)break;
    const end=out.indexOf('function normalizeActionButtons',start);
    if(end<0){cursor=start+'function printStow(){'.length;continue}

    let block=out.slice(start,end);
    const misplaced=misplacedStyleRx.exec(block);
    if(misplaced){
      if(!movedStyle)movedStyle=misplaced[0];
      block=block.replace(misplacedStyleRx,'');
    }

    block=block
      .replace(/(<script\b[^>]*rc1059-document-blob\.js[^>]*>)[\r\n\t ]*<\/script\s*>/gi,'$1<\\/script>')
      .replace(/<\/script\s*>/gi,'<\\/script>')
      .replace(/<\\\/script>[\r\n]+/gi,'<\\/script>');
    const loader='<script src="assets/rc1059-document-blob.js?v=RC1059"><\\/script>';
    while(block.includes(loader+loader))block=block.replace(loader+loader,loader);

    out=out.slice(0,start)+block+out.slice(end);
    cursor=start+block.length;
    patched++;
  }

  if(movedStyle){
    out=out.replace(/<style\b[^>]*id=["']exporthub-rc373-customer-areas-style["'][^>]*>[\s\S]*?<\/style\s*>/gi,'');
    const outerBody=out.search(/<body\b/i),headClose=(outerBody>=0?out.slice(0,outerBody):out).search(/<\/head\s*>/i);
    if(headClose<0)throw new Error(file+': echter </head>-Anker für Kundenbereich-Style fehlt');
    out=out.slice(0,headClose)+movedStyle+'\n'+out.slice(headClose);
  }

  if(patched===0)return html;
  return out;
}
function finalRepairPrintStowPayloads(html,file){
  const payloads=[];
  const rx=/(function printStow\(\)\{[\s\S]*?\+card\.innerHTML\+')([\s\S]*?)(<\/body><\/html>';\s*var w=window\.open\(\s*['"]about:blank['"])/g;
  let out=html.replace(rx,function(full,prefix,payload,suffix){
    if(!/[<](?:script|style|link|section|div)\b/i.test(payload))return full;
    const clean=String(payload||'').trim();
    if(clean)payloads.push(clean);
    return prefix+suffix
  });

  if(payloads.length){
    const unique=Array.from(new Set(payloads));
    const bodyClose=out.toLowerCase().lastIndexOf('</body>');
    if(bodyClose<0)throw new Error(file+': echter äußerer </body>-Anker fehlt');
    out=out.slice(0,bodyClose)+'\n'+unique.join('\n')+'\n'+out.slice(bodyClose);
  }

  const customerStyleRx=/<style\b[^>]*id=["']exporthub-rc373-customer-areas-style["'][^>]*>[\s\S]*?<\/style\s*>/gi;
  const styles=out.match(customerStyleRx)||[];
  if(styles.length){
    const canonical=styles[0];
    out=out.replace(customerStyleRx,'');
    const headOpen=/<head\b[^>]*>/i.exec(out);
    if(!headOpen)throw new Error(file+': echter äußerer <head>-Anker fehlt');
    const pos=headOpen.index+headOpen[0].length;
    out=out.slice(0,pos)+'\n'+canonical+'\n'+out.slice(pos);
  }

  return out;
}


function shipmentControllerBlock(html,file){
  const open='<script id="exporthub-rc373-shipment-controller">';
  const start=html.indexOf(open);
  if(start<0)throw new Error(file+': RC373 Shipment-Controller Start fehlt');
  const tail='window.ExportHUBShipment375=api;';
  const tailAt=html.indexOf(tail,start+open.length);
  if(tailAt<0)throw new Error(file+': RC373 Shipment-Controller Endmarker fehlt');
  const close=html.indexOf('</script>',tailAt+tail.length);
  if(close<0)throw new Error(file+': RC373 Shipment-Controller echtes Ende fehlt');
  const end=close+'</script>'.length;
  return{start:start,end:end,content:html.slice(start,end)};
}
function syncShipmentControllerFromProduction(html,file,canonicalController){
  if(!canonicalController||!canonicalController.content)return html;
  const current=shipmentControllerBlock(html,file);
  if(current.content===canonicalController.content)return html;

  const outside=html.slice(0,current.start)+html.slice(current.end),extras=[];
  const rx=/<(?:style|script)\b[^>]*\bid=["']([^"']+)["'][^>]*>[\s\S]*?<\/(?:style|script)\s*>/gi;
  let m;
  while((m=rx.exec(current.content))){
    const id=String(m[1]||'').trim(),block=m[0];
    if(!id||id==='exporthub-rc373-shipment-controller')continue;
    if(/rc1059-document-blob\.js/i.test(block))continue;
    if(canonicalController.content.includes('id="'+id+'"')||canonicalController.content.includes("id='"+id+"'"))continue;
    if(outside.includes('id="'+id+'"')||outside.includes("id='"+id+"'"))continue;
    extras.push(block);
  }
  const unique=Array.from(new Set(extras));
  const replacement=canonicalController.content+(unique.length?'\n'+unique.join('\n'):'');
  return html.slice(0,current.start)+replacement+html.slice(current.end);
}

function printStowBlocks(html){
  const blocks=[],startMarker='function printStow(){',endMarker='function normalizeActionButtons';
  let cursor=0;
  while(true){
    const start=html.indexOf(startMarker,cursor);
    if(start<0)break;
    const end=html.indexOf(endMarker,start+startMarker.length);
    if(end<0)break;
    blocks.push({start:start,end:end,content:html.slice(start,end)});
    cursor=end+endMarker.length;
  }
  return blocks;
}

function syncPrintStowFromProduction(html,file,canonicalBlocks){
  if(!Array.isArray(canonicalBlocks)||!canonicalBlocks.length)return html;
  const variants=printStowBlocks(html);
  if(!variants.length)return html;
  if(variants.length!==canonicalBlocks.length)throw new Error(file+': printStow-Anzahl '+variants.length+' statt Produktion '+canonicalBlocks.length);

  let out=html;
  const moved=[];

  for(let i=variants.length-1;i>=0;i--){
    const variant=variants[i].content,canonical=canonicalBlocks[i].content;
    if(variant===canonical)continue;

    let prefix=0;
    const min=Math.min(variant.length,canonical.length);
    while(prefix<min&&variant.charCodeAt(prefix)===canonical.charCodeAt(prefix))prefix++;

    let suffix=0;
    while(
      suffix<variant.length-prefix&&
      suffix<canonical.length-prefix&&
      variant.charCodeAt(variant.length-1-suffix)===canonical.charCodeAt(canonical.length-1-suffix)
    )suffix++;

    if(prefix+suffix===canonical.length&&variant.length>canonical.length){
      const extra=variant.slice(prefix,variant.length-suffix).trim();
      if(extra&&/[<](?:script|style|link|section|div)\b/i.test(extra))moved.unshift(extra);
    }else if(/[<](?:script|style|link|section|div)\b/i.test(variant)){
      const extraTags=[];
      const tagRx=/<(?:style|script)\b[^>]*>[\s\S]*?<\/(?:style|script)\s*>|<link\b[^>]*>/gi;
      let m;while((m=tagRx.exec(variant)))if(!canonical.includes(m[0]))extraTags.push(m[0]);
      if(extraTags.length)moved.unshift(...extraTags);
    }

    out=out.slice(0,variants[i].start)+canonical+out.slice(variants[i].end);
  }

  if(moved.length){
    const unique=Array.from(new Set(moved.filter(Boolean)));
    const bodyClose=out.toLowerCase().lastIndexOf('</body>');
    if(bodyClose<0)throw new Error(file+': äußerer </body>-Anker für synchronisierte Seitenblöcke fehlt');
    out=out.slice(0,bodyClose)+'\n'+unique.join('\n')+'\n'+out.slice(bodyClose);
  }
  return out;
}

function patchLoginScreenStatus(html,file){
  let out=html;
  out=out.replace(
    /updateMicrosoftUi\(\);status\(restoredSession\?'Gespeicherte Sitzung wird wiederhergestellt (?:…|\\.{3})':\(isTestServiceOrigin\(\)\?'TESTSERVICE · Zugangsdaten eingeben\.':'Anmeldekonfiguration wird geprüft (?:…|\\.{3})'\),''\);/g,
    "updateMicrosoftUi();status(restoredSession?'Gespeicherte Sitzung wird wiederhergestellt …':'','');"
  );
  out=out.replace(/status\('TESTSERVICE · Auth-Backend wird geprüft\s*(?:…|\\.{3})?',''\);?\s*/g,'');
  out=out.replace(/status\('Anmeldekonfiguration wird geprüft\s*(?:…|\\.{3})?',''\);?\s*/g,"status('','');");
  out=out.replace(/Anmeldekonfiguration wird geprüft\s*(?:…|\\.{3})?/gi,'');
  out=out.replace(/TESTSERVICE\s*·\s*Auth-Backend wird geprüft\s*(?:…|\\.{3})?/gi,'');
  out=out.replace(/TESTSERVICE\s*·\s*Zugangsdaten eingeben\.?/gi,'');
  if(/Anmeldekonfiguration wird geprüft|TESTSERVICE\s*·\s*(?:Auth-Backend wird geprüft|Zugangsdaten eingeben)/i.test(out)){
    throw new Error(file+': technischer Login-Prüfstatus noch vorhanden');
  }
  return out;
}

function patchRc1069Performance(html,file){
  let out=html;
  const cacheOld="var fastViewCache=Object.create(null),fastViewOrder=[],fastViewMax=2,fastViewRestoreTimer=0;";
  const cacheNew="var fastViewCache=Object.create(null),fastViewOrder=[],fastViewMax=5,fastViewRestoreTimer=0;";
  if(out.includes(cacheOld))out=out.replace(cacheOld,cacheNew);
  const viewsOld="function fastCacheable(view){view=canonical(view);return view==='shipment'||view==='shipmentoverview'||view==='cmr'}";
  const viewsNew="function fastCacheable(view){view=canonical(view);return view==='shipment'||view==='shipmentoverview'||view==='cmr'||view==='customers'||view==='customerfolder'}";
  if(out.includes(viewsOld))out=out.replace(viewsOld,viewsNew);

  const restoreOld="try{if(runtime.sessionRestored&&!isTestServiceOrigin())await verifySessionForLoad();await loadStateAfterLogin();runtime.sessionRefreshAttempted=false;await loadCanonicalModules()}";
  const restoreNew="try{await loadStateAfterLogin();runtime.sessionRefreshAttempted=false;await loadCanonicalModules()}";
  if(out.includes(restoreOld))out=out.replace(restoreOld,restoreNew);

  if(!out.includes("fastViewMax=5"))throw new Error(file+': RC1069 Fast-View Cachegröße fehlt');
  if(!out.includes("view==='customerfolder'"))throw new Error(file+': RC1069 Kundenordner-Fastcache fehlt');
  if(out.includes(restoreOld))throw new Error(file+': RC1070 redundanter Session-Check vor State-Read noch vorhanden');
  if(!out.includes(restoreNew))throw new Error(file+': RC1070 direkter State-Read beim Session-Restore fehlt');
  return out;
}

function patchGateMaster(html,file){
  let out=html;

  const oldZoneFallback="var originPostal=q(g.originPostal),originZone=/^[1-8]/.test(originPostal)?originPostal.charAt(0):'';if(originZone)return{value:originZone,automatic:true,source:'Start-PLZ'};return{value:q(g.manualTollZone||g.tollZone||g.zone),automatic:false,source:'manuell'}";
  const newZoneFallback="return{value:q(g.manualTollZone||g.tollZone||g.zone),automatic:false,source:'manuell'}";
  out=replaceOne(out,oldZoneFallback,newZoneFallback,file+' Gate41-Zone nur aus Stammdaten');

  const helpers=`
function gateMasterUser(){try{return window.__EXPORTHUB_GET_CURRENT_USER__?window.__EXPORTHUB_GET_CURRENT_USER__():(window.currentUser||state().currentUser||null)}catch(_){return window.currentUser||state().currentUser||null}}
function gateMasterAdmin(){var u=gateMasterUser()||{},role=low(u.role||u.rolle),rights=u.rights||{},r=rights.shippingcosts||rights.shippingCosts||rights.shipping||{},roles=['global admin','globaler administrator','globaler admin','administrator','admin','vollzugriff'];if(u.globalAdmin===true||u.isGlobalAdmin===true||arr(u.permissions).indexOf('*')>=0||roles.indexOf(role)>=0)return true;return r.admin===true||r.functionAdmin===true||low(r.level||r.access)==='admin'}
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

function patchHistoryNavigation(html,file){
  let out=html;
  const open='<script id="index321-single-navigation-controller">';
  const start=out.indexOf(open),end=start<0?-1:out.indexOf('</script>',start+open.length);
  if(start<0||end<=start)throw new Error(file+': kanonischer Navigationscontroller für RC1082 fehlt');
  let block=out.slice(start,end+'</script>'.length);
  block=block.replace(/\{view:['"]history['"],label:['"]History['"],right:['"]history['"]\}/g,"{view:'history',label:'Historie',right:'history'}");
  if(!/view:['"]history['"]/.test(block)){
    const stateAt=block.indexOf('function state(){');
    const itemsAt=stateAt>=0?block.lastIndexOf('var ITEMS=',stateAt):block.indexOf('var ITEMS=');
    if(itemsAt<0)throw new Error(file+': ITEMS-Navigation für RC1082 fehlt');
    const arrayStart=block.indexOf('[',itemsAt),arrayEnd=block.indexOf('];',arrayStart);
    if(arrayStart<0||arrayEnd<0)throw new Error(file+': ITEMS-Navigation für RC1082 unvollständig');
    const item="{view:'history',label:'Historie',right:'history'}";
    let list=block.slice(arrayStart,arrayEnd);
    const archiveAt=list.indexOf("view:'archive'");
    if(archiveAt>=0){
      const objectStart=list.lastIndexOf('{',archiveAt);
      if(objectStart>=0)list=list.slice(0,objectStart)+item+','+list.slice(objectStart);
      else list+=','+item;
    }else list+=','+item;
    block=block.slice(0,arrayStart)+list+block.slice(arrayEnd);
  }
  block=block.replace("teamfile:'#8b5cf6',archive:'#64748b'","teamfile:'#8b5cf6',history:'#0ea5e9',archive:'#64748b'");
  block=block.replace("item.view==='warehouse'?'🏭':item.view==='privacy'?'🛡️':item.view==='shipmentsearch'?'⌕':'•'","item.view==='history'?'↺':item.view==='warehouse'?'🏭':item.view==='privacy'?'🛡️':item.view==='shipmentsearch'?'⌕':'•'");
  const historyRoute=" if(view==='history'&&window.ExportHUBRC1081AuditHistory&&typeof window.ExportHUBRC1081AuditHistory.render==='function'){setViewState(view);prepareDirectView(view);var historyRoot=document.getElementById('content');if(historyRoot)historyRoot.innerHTML='';var historyOut=window.ExportHUBRC1081AuditHistory.render();finishDirectView(view);return historyOut}";
  if(!block.includes(historyRoute)){
    const routeAnchor=" if(view==='diagnostics'){var diag=window.ExportHUBDiagnostics871||window.ExportHUBDiagnostics870;";
    const pos=block.indexOf(routeAnchor);
    if(pos<0)throw new Error(file+': History-Direktroute konnte nicht vor Fehlerdiagnose eingefügt werden');
    block=block.slice(0,pos)+historyRoute+'\n'+block.slice(pos);
  }
  out=out.slice(0,start)+block+out.slice(end+'</script>'.length);

  const rightsOpen='<script data-inline-source="assets/rc544-auth.js">';
  const rs=out.indexOf(rightsOpen),re=rs<0?-1:out.indexOf('</script>',rs+rightsOpen.length);
  if(rs>=0&&re>rs){
    let rb=out.slice(rs,re+'</script>'.length);
    rb=rb.replace(/history:['"]History['"]/g,"history:'Historie'");
    if(!/history:['"]Historie['"]/.test(rb)){
      rb=rb.replace(/archive:'Archiv',settings:'Einstellungen'/,"archive:'Archiv',history:'Historie',settings:'Einstellungen'");
    }
    if(!/['"]history['"]/.test(rb.slice(rb.indexOf('VALID_RIGHTS_ORDER'),rb.indexOf('VALID_RIGHTS_ORDER')+1200))){
      rb=rb.replace("'reports','update','teamfile','archive','settings','pickupcalendar']","'reports','update','teamfile','archive','history','settings','pickupcalendar']");
      rb=rb.replace("'reports','update','teamfile','archive','settings']","'reports','update','teamfile','archive','history','settings']");
    }
    out=out.slice(0,rs)+rb+out.slice(re+'</script>'.length);
  }
  if(!/view:['"]history['"],label:['"]Historie['"],right:['"]history['"]/.test(out))throw new Error(file+': Historie-Reiter wurde nicht eingebunden');
  if(!out.includes("view==='history'&&window.ExportHUBRC1081AuditHistory"))throw new Error(file+': History-Direktroute fehlt');
  return out;
}


function patchLoadingListPalletAccount(html,file){
  if(html.includes('function rc1095LoadPalletHtml('))return html;
  const start=html.indexOf('function loadHtml(sh,withQr){');
  const end=start<0?-1:html.indexOf('function documentCacheKey',start);
  if(start<0||end<0)throw new Error(file+': Ladelisten-Renderer für RC1095 fehlt');
  let block=html.slice(start,end);
  const head='<div class="rc390-head">';
  const headCount=block.split(head).length-1;
  if(headCount!==1)throw new Error(file+': RC1095 Ladelisten-Kopf '+headCount+'x gefunden');
  block=block.replace(head,"'+rc1095LoadPalletHtml(sh,rs)+'"+head);
  const helper=[
    "function rc1095LoadPalletCount(sh,rs){var direct=Math.max(0,Math.round(Number(sh&&(sh.palletOut||sh.euroPallets||sh.euroPalletCount))||0));if(direct>0)return direct;return(Array.isArray(rs)?rs:[]).reduce(function(total,row){var kind=String(row&&(row.type||row.packaging||row.verpackung||row.packageType||row.packagingType)||'');if(!/euro.*pal|eur.*pal/i.test(kind))return total;var raw=row&&(row.count!=null?row.count:(row.quantity!=null?row.quantity:(row.qty!=null?row.qty:(row.amount!=null?row.amount:row.number))));return total+Math.max(0,Math.round(Number(raw)||0))},0)}",
    "function rc1095LoadPalletHtml(sh,rs){var count=rc1095LoadPalletCount(sh,rs);if(!(count>0))return'';return '<div class=rc1095-pallet-account style=display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px;padding:8px;background:#f8fafc;color:#0f172a;border-radius:9px><b>Palettenkonto</b><span>Ausgang: '+count+' Europalette'+(count===1?'':'n')+'</span></div>'}"
  ].join('\n');
  let out=html.slice(0,start)+helper+'\n'+block+html.slice(end);
  const cacheStart=out.indexOf('function documentCacheKey',start+helper.length);
  const cacheEnd=cacheStart<0?-1:out.indexOf('function ',cacheStart+'function documentCacheKey'.length);
  if(cacheStart<0||cacheEnd<0)throw new Error(file+': Dokumentcache für RC1095 fehlt');
  let cache=out.slice(cacheStart,cacheEnd);
  const cacheAnchor='String(totals(sh).ldm)]';
  if(!cache.includes(cacheAnchor))throw new Error(file+': RC1095 Dokumentcache-Anker fehlt');
  cache=cache.replace(cacheAnchor,"String(totals(sh).ldm),String(rc1095LoadPalletCount(sh,rows(sh)))]");
  out=out.slice(0,cacheStart)+cache+out.slice(cacheEnd);
  if(!out.includes('rc1095-pallet-account')||!out.includes('String(rc1095LoadPalletCount(sh,rows(sh)))'))throw new Error(file+': RC1095 Palettenkonto-Druckpatch unvollständig');
  return out;
}

function patchShipmentOverviewInlineMeta(html,file){
  const start=html.indexOf('function overviewCardHtml(sh){');
  const end=start>=0?html.indexOf('function overviewGroupedCardsHtml',start):-1;
  if(start<0||end<0)throw new Error(file+': overviewCardHtml fehlt');
  let block=html.slice(start,end);
  if(!block.includes('rc1091MetaHtml')){
    const prolog=`function overviewCardHtml(sh){
 var rc1091OverviewApi=window.ExportHUBRC1014ShipmentOverview,rc1091Meta=rc1091OverviewApi&&typeof rc1091OverviewApi.shipmentMeta==='function'?rc1091OverviewApi.shipmentMeta(sh):null,rc1127PickupHtml=rc1091Meta&&rc1091Meta.customerPickupLabel?'<span class="rc1014-shipment-customer-pickup" data-rc1127-customer-pickup="1">'+E(rc1091Meta.customerPickupLabel)+'</span>':'',rc1091MetaHtml=rc1091Meta?'<div class="rc1014-shipment-meta" data-rc1014-shipment-meta="1"><span class="rc1014-shipment-created">'+E(rc1091Meta.createdLabel)+'</span><span class="rc1014-shipment-colli">'+E(rc1091Meta.colliLabel)+'</span>'+rc1127PickupHtml+'</div>':'';`;
    block=block.replace('function overviewCardHtml(sh){',prolog);
    const anchor='</span></div><div class="rc524-action-grid">';
    const count=block.split(anchor).length-1;
    if(count!==1)throw new Error(file+': Overview-Meta-Anker '+count+'x gefunden');
    block=block.replace(anchor,"</span></div>'+rc1091MetaHtml+'<div class=\"rc524-action-grid\">");
  }
  return html.slice(0,start)+block+html.slice(end);
}

function patchHtml(file,canonicalPrintStow,canonicalController){
  const target=path.join(OUT,file);
  let html=fs.readFileSync(target,'utf8');
  if(canonicalController)html=syncShipmentControllerFromProduction(html,file,canonicalController);
  if(canonicalPrintStow)html=syncPrintStowFromProduction(html,file,canonicalPrintStow);
  html=repairPrintStowInjectedPageBlocks(html,file);
  html=patchEmbeddedPrintScriptClosers(html,file);
  html=patchGateMaster(html,file);
  html=patchRc1069Performance(html,file);
  html=patchLoginScreenStatus(html,file);
  html=patchHistoryNavigation(html,file);
  html=patchLoadingListPalletAccount(html,file);
  html=patchShipmentOverviewInlineMeta(html,file);
  html=patchPackagingGroups(html,file);
  html=patchDeckblattContrast(html,file);
  html=html.replace(/assets\/rc1014-shipment-overview\.js\?v=1016/g,'assets/rc1014-shipment-overview.js?v=1127');
  html=html.replace(/assets\/rc1014-shipment-overview\.css\?v=1016/g,'assets/rc1014-shipment-overview.css?v=1127');
  html=html.replace(/assets\/rc1013-diagnostics\.js\?v=1013/g,'assets/rc1013-diagnostics.js?v=1085');
  html=injectBeforeHeadClose(html,RC1065_CC_TAG,RC1065_CC_ID);
  html=injectBeforeHeadClose(html,RC1069_PERF_TAG,RC1069_PERF_ID);
  html=injectBeforeHeadClose(html,RC1071_HISTORY_TAG,RC1071_HISTORY_ID);
  html=injectBeforeHeadClose(html,RC1074_LOGIN_TAG,RC1074_LOGIN_ID);
  if(file!=='demo.html')html=injectBeforeHeadClose(html,RC1075_LOADER_PIN_TAG,RC1075_LOADER_PIN_ID);
  html=injectBeforeHeadClose(html,RC1077_CUSTOMER_LABELS_TAG,RC1077_CUSTOMER_LABELS_ID);
  html=injectBeforeHeadClose(html,RC1079_PROFILE_TAG,RC1079_PROFILE_ID);
  html=injectBeforeHeadClose(html,RC1080_CUSTOMER_HISTORY_TAG,RC1080_CUSTOMER_HISTORY_ID);
  html=injectBeforeHeadClose(html,RC1081_AUDIT_HISTORY_TAG,RC1081_AUDIT_HISTORY_ID);
  html=injectBeforeHeadClose(html,RC1092_CONTACTS_TAG,RC1092_CONTACTS_ID);
  html=injectBeforeHeadClose(html,RC1096_PACKAGING_TAG,RC1096_PACKAGING_ID);
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
  html=finalRepairPrintStowPayloads(html,file);
  html=patchLoginScreenStatus(html,file);
  if(!html.includes(`version:'${VERSION}'`))throw new Error(file+': BUILD '+VERSION+' fehlt');
  if(!html.includes(`ExportHUB ${VERSION} environment=`))throw new Error(file+': Environment '+VERSION+' fehlt');
  fs.writeFileSync(target,html);
}

execFileSync(process.execPath,['.github/rc1047/build-three-env.mjs'],{cwd:ROOT,stdio:'inherit'});
fs.rmSync(OUT,{recursive:true,force:true});
fs.cpSync(SRC,OUT,{recursive:true});
patchHtml('index.html');
const canonicalProductionHtml=fs.readFileSync(path.join(OUT,'index.html'),'utf8');
const canonicalController=shipmentControllerBlock(canonicalProductionHtml,'index.html');
const canonicalPrintStow=printStowBlocks(canonicalProductionHtml);
if(!canonicalPrintStow.length)throw new Error('Produktion enthält keinen kanonischen printStow-Block');
if(!canonicalController.content.includes('function printStow(){'))throw new Error('Produktion: RC373 Shipment-Controller enthält printStow nicht');
patchHtml('TESTVERSION.html',canonicalPrintStow,canonicalController);
patchHtml('demo.html',canonicalPrintStow,canonicalController);

const rc1065AssetSource=path.join(ROOT,'assets/rc1065-registration-cc.js');
const rc1065AssetTarget=path.join(OUT,'assets/rc1065-registration-cc.js');
if(!fs.existsSync(rc1065AssetSource))throw new Error('RC1065 Pflicht-CC Runtime fehlt');
fs.mkdirSync(path.dirname(rc1065AssetTarget),{recursive:true});
fs.copyFileSync(rc1065AssetSource,rc1065AssetTarget);

for(const rel of ['assets/rc1092-customer-mail-contacts.js','assets/rc1096-packaging-groups.js','assets/rc1014-shipment-overview.js','assets/rc1013-diagnostics.js','assets/rc1061-document-migration-admin.js','assets/rc1063-abd-blob-viewer-compat.js','assets/rc1067-startup-recovery.js','assets/rc1069-performance.js','assets/rc1071-shipment-history.js','assets/rc1074-login-clean.js','assets/rc1075-loader-pin-admin.js','assets/rc1077-customer-labels.js','assets/rc1079-profile-settings.js','assets/rc1080-customer-history.js','assets/rc1081-audit-history.js']){
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
    registrationMandatoryCc:{runtime:'assets/rc1065-registration-cc.js',version:'RC1093',required:['Sevastian Marcu','Daniel Ollmann']},
    documentMigration:{runtime:'assets/rc1061-document-migration-admin.js',version:'RC1066',batchSize:5,mode:'automatic-sequential-batches'},
    abdBlobViewerCompat:{runtime:'assets/rc1063-abd-blob-viewer-compat.js',version:'RC1248',observer:'panel-scoped',startupProbeMax:8},
    startupRecovery:{runtime:'assets/rc1067-startup-recovery.js',page:'migration-recovery.html',version:'RC1067',trigger:'stalled admin startup with inline legacy documents'},
    finalRenderIntegrity:{version:'RC1068',shipmentController:'canonical production sync',inlineScriptSyntaxChecked:true,visibleCodeLeakChecked:true},
    performance:{version:'RC1069',debouncedGlobalSearchMs:140,fastViewCacheMax:5,fastViews:['shipment','shipmentoverview','cmr','customers','customerfolder']},
    shipmentOverviewRenderStability:{version:'RC1127',runtime:'assets/rc1014-shipment-overview.js',inlineMeta:true,idempotentDomPatch:true,renderFeedbackSuppressionMs:750,customerPickupDateFromAvis:true,customerPickupFields:['customerAvisPickupDate','avisPickupDate']},
    customerMailContacts:{version:'RC1092',runtime:'assets/rc1092-customer-mail-contacts.js',actions:['Person speichern','Zur Mail hinzufügen'],separateLibraryAndMailAssignment:true,persistImmediately:true},
    packagingMenu:{version:'RC1110',runtime:'assets/rc1096-packaging-groups.js',columns:['Pakete','Paletten','Sonstiges'],packageCodes:'E0-E6',addsEnvelope:true,responsive:true,nativeRc682Guard:true},
    deckblattContrast:{version:'RC1111',document:'Deckblatt',paletteVisibility:true,background:'#eef6ff',headerBand:'#dbeafe',border:'#08245d',referenceField:'#08245d',qrDocumentsUnchanged:true,otherDocumentsUnchanged:true},
    loadingListPalletAccount:{version:'RC1095',document:'Ladeliste',onlyEuroPallets:true,label:'Palettenkonto',showsExpectedOutbound:true,cacheIncludesEuroPalletCount:true},
    shipmentHistory:{version:'RC1095',runtime:'assets/rc1071-shipment-history.js',field:'shipmentHistory',merge:'additive-by-event-id',events:['work-start','print','registration','mail','mail-sent','abd','avis','pickup','pod','status']},
    loginScreenClean:{version:'RC1074',runtime:'assets/rc1074-login-clean.js',technicalProgressHidden:true,errorsRemainVisible:true},
    loaderPinAdmin:{version:'RC1087',runtime:'assets/rc1075-loader-pin-admin.js',globalAdminOnly:true,api:'/api/loader-pins-admin',auditActions:['create','update','toggle','delete'],auditContainsPin:false,demo:false},
    customerLabels:{version:'RC1077',runtime:'assets/rc1077-customer-labels.js',views:['customers','customerfolder'],firmaLabel:'Standorte',headingsUnclipped:true},
    profileSettings:{version:'RC1079',runtime:'assets/rc1079-profile-settings.js',selfServiceDisplayName:true,usernameImmutable:true},
    customerHistory:{version:'RC1080',runtime:'assets/rc1080-customer-history.js',field:'customerHistory',merge:'additive-by-event-id',events:['customer-created','customer-updated']},
    auditHistory:{version:'RC1087',runtime:'assets/rc1081-audit-history.js',view:'history',label:'Historie',sources:['auditLog','shipmentHistory','shipmentDerived','customerHistory','taskDerived','palletAccount'],filters:['query','type','subtype','actor','entity','days','from','to'],defaultPeriod:'all',language:'de',retentionDays:365},
    diagnosticsAutofix:{version:'RC1085',runtime:'assets/rc1013-diagnostics.js',api:'/api/diagnostic-autofix',workflow:'.github/workflows/diagnostic-autofix.yml',provider:'OpenAI Codex',enabledByDefault:false,noExternalAiRequestsWhenDisabled:true,statusFlow:['queued','running','testing','deploying','fixed','failed']}
  },
  environments:{production:'index.html',testservice:'TESTVERSION.html',demo:'demo.html'}
},null,2)+'\n');

console.log('RC1048 build ready: Gate41-Stammdaten für Laufzeit, PLZ-Zone, Maut und Diesel; keine geratenen Zonen mehr.');
