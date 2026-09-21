import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const SRC=path.join(ROOT,'dist-rc1048');
const OUT=path.join(ROOT,'dist-rc1112');
const VERSION='RC1112';
const NUMBER='1112';
const LEGACY_TESTSERVICE_HOST='wonderful-forest-0f315e310-testservice.centralus.7.azurestaticapps.net';
const CURRENT_TESTSERVICE_HOST='ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';

function injectDeferredRuntimeInHead(html,tag,id){
  if(id&&(html.includes('id="'+id+'"')||html.includes("id='"+id+"'")))return html;
  const headOpen=/<head\b[^>]*>/i.exec(html);
  if(!headOpen)throw new Error((id||'Script')+': äußerer <head>-Anker fehlt');
  const start=headOpen.index+headOpen[0].length;
  const lower=html.toLowerCase(),idx=lower.indexOf('</head>',start);
  if(idx<0)throw new Error((id||'Script')+': äußerer </head>-Anker fehlt');
  return html.slice(0,idx)+tag+'\n'+html.slice(idx);
}

function patchDemoTestPortalIsolation(html,file){
  if(file!=='demo.html')return html;
  const originAnchor="namedTest=/-testservice\\./i.test(h);";
  const runtimeAnchor=" if(!window.__EXPORTHUB_TEST_PORTAL__)return;";
  const routeAnchor="function anchorTestRoute(){try{if(window.__EXPORTHUB_PICKUP_MODE__||!isTestPath())return;";
  for(const [needle,label] of [[originAnchor,'Testservice-Origin'],[runtimeAnchor,'Testportal-Runtime'],[routeAnchor,'Testportal-Routenanker']]){
    const count=html.split(needle).length-1;
    if(count!==1)throw new Error(file+': RC1131 '+label+' '+count+'x gefunden');
  }
  html=html.replace(originAnchor,"namedTest=/-testservice\\./i.test(h)&&window.__EXPORTHUB_DEMO_MODE__!==true;");
  html=html.replace(runtimeAnchor," if(window.__EXPORTHUB_DEMO_MODE__===true)return;\n if(!window.__EXPORTHUB_TEST_PORTAL__)return;");
  html=html.replace(routeAnchor,"function anchorTestRoute(){try{if(window.__EXPORTHUB_DEMO_MODE__===true||window.__EXPORTHUB_PICKUP_MODE__||!isTestPath())return;");
  return html;
}

function patchNotificationTasks(html,file){
  const moduleStart='<script id="index236-notification-controller">';
  const moduleEnd='<!-- INDEX 236 NOTIFICATION CENTER END -->';
  const a=html.indexOf(moduleStart),b=a>=0?html.indexOf(moduleEnd,a+moduleStart.length):-1;
  if(a<0||b<0)throw new Error(file+': RC1123 Benachrichtigungsmodul fehlt');
  let block=html.slice(a,b);
  const oldTitle="function taskTitle(t){return q(t&&(t.title||t.name||t.subject||'Aufgabe'))||'Aufgabe'}";
  const newTitle="function taskTitle(t){var vals=t?[t.title,t.name,t.subject,t.taskTitle,t.taskName,t.label,t.description,t.text,t.action,t.note,t.comment,t.notes]:[];for(var i=0;i<vals.length;i++){var v=q(vals[i]);if(!v||/^(?:aufgabe|task)$/i.test(v))continue;return v.length>160?v.slice(0,157)+'…':v}return''}";
  const oldId="function taskId(t){return q(t&&(t.id||t.taskId||t.uuid||t.title))}";
  const newId="function taskId(t){return q(t&&(t.id||t.taskId||t.uuid))||taskTitle(t)}";
  const oldOpen="function openTasks(){return arr(main().tasks).filter(function(t){return t&&!isDone(t)&&!taskIsTemplate(t)&&taskForUser(t)})}";
  const newOpen="function notificationTaskKey(t){var id=q(t&&(t.id||t.taskId||t.uuid));if(id)return'id:'+low(id);return'sem:'+low([taskTitle(t),taskOwner(t),taskDate(t),taskRef(t),q(t&&(t.time||'')),q(t&&(t.area||t.category||t.type||''))].join('|'))}\nfunction openTasks(){var seen={};return arr(main().tasks).filter(function(t){if(!t||isDone(t)||taskIsTemplate(t)||!taskForUser(t)||!taskTitle(t))return false;var key=notificationTaskKey(t);if(!key||seen[key])return false;seen[key]=1;return true})}";
  for(const [before,after,label] of [[oldTitle,newTitle,'taskTitle'],[oldId,newId,'taskId'],[oldOpen,newOpen,'openTasks']]){
    const n=block.split(before).length-1;
    if(n!==1)throw new Error(file+': RC1123 '+label+' im Benachrichtigungsmodul '+n+'x gefunden');
    block=block.replace(before,after);
  }
  if(!block.includes('function notificationTaskKey(t)'))throw new Error(file+': RC1123 Aufgabenfilter fehlt');
  return html.slice(0,a)+block+html.slice(b);
}

function patchTaskMasterSaveScope(html,file){
  const before="function saveScopeForReason(reason){var r=lower(reason);if(/kundenstamm|kundenordner|kunden-mail|kundenmail|neuen kunden|kundendaten/.test(r))return new Set(['customers','customerNotes']);return null}";
  const after="function saveScopeForReason(reason){var r=lower(reason);if(/kundenstamm|kundenordner|kunden-mail|kundenmail|neuen kunden|kundendaten/.test(r))return new Set(['customers','customerNotes']);if(/aufgaben-master rc874/.test(r))return new Set(['tasks','taskWeek','taskMasterRC848','taskMasterSourceVersion','taskMasterUpdatedAt']);return null}";
  const count=html.split(before).length-1;
  if(count!==1)throw new Error(file+': RC1153 saveScopeForReason '+count+'x gefunden');
  html=html.replace(before,after);
  if(!html.includes("if(/aufgaben-master rc874/.test(r))return new Set(['tasks','taskWeek','taskMasterRC848','taskMasterSourceVersion','taskMasterUpdatedAt'])"))throw new Error(file+': RC1153 Task-Master-Save-Scope fehlt');
  return html
}

function patchDeckblattHighVisibility(html,file){
  let covers=0,refs=0,boxes=0,checks=0,titles=0;
  html=html.replace(/\.rc352-cover\{([^}]*)\}/g,function(full,body){
    if(body.indexOf('border:8mm solid #08245d!important;')<0)return full;
    covers++;
    var next=body
      .replace('border:8mm solid #08245d!important;','border:10mm solid #08245d!important;border-top-width:20mm!important;outline:2.5mm solid #2563eb!important;outline-offset:-3.5mm!important;')
      .replace('background:linear-gradient(180deg,#60a5fa 0,#93c5fd 58mm,#bfdbfe 58mm,#dbeafe 100%)','background:linear-gradient(180deg,#facc15 0,#fde047 72mm,#fef08a 72mm,#facc15 100%)')
      .replace('box-shadow:inset 0 0 0 2mm #1d4ed8','box-shadow:inset 0 0 0 3.5mm #2563eb')
      .replace('padding:8mm','padding:6mm');
    return '.rc352-cover{'+next+'}'
  });
  html=html.replace(/\.rc352-cover-ref\{([^}]*)\}/g,function(full,body){
    if(body.indexOf('background:#08245d')<0)return full;
    refs++;
    var next=body
      .replace('border:3px solid #60a5fa','border:4mm solid #facc15')
      .replace('min-width:48mm','min-width:60mm')
      .replace('padding:8px 12px','padding:10px 14px');
    return '.rc352-cover-ref{'+next+'}'
  });
  html=html.replace(/\.rc352-cover-ref strong\{([^}]*)\}/g,function(full,body){
    return '.rc352-cover-ref strong{'+body.replace('font-size:26px','font-size:40px').replace('color:#fff!important;','color:#fff!important;')+'}'
  });
  html=html.replace(/\.rc352-cover h1\{([^}]*)\}/g,function(full,body){
    titles++;
    return '.rc352-cover h1{'+body.replace('font-size:34px','font-size:44px').replace('color:#08245d','color:#08245d')+'}'
  });
  html=html.replace(/\.rc352-cover-box\{([^}]*)\}/g,function(full,body){
    if(body.indexOf('background:#f8fbff')<0)return full;
    boxes++;
    var next=body
      .replace('border:1.5px solid #7dbdff','border:2mm solid #08245d')
      .replace('background:#f8fbff','background:#dbeafe')
      .replace('border-radius:14px','border-radius:10px');
    return '.rc352-cover-box{'+next+';-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'
  });
  html=html.replace(/\.rc352-cover-check\{([^}]*)\}/g,function(full,body){
    if(body.indexOf('background:#fff')<0)return full;
    checks++;
    var next=body
      .replace('border:1.5px solid #bfdbfe','border:2mm solid #08245d')
      .replace('background:#fff','background:#fef3c7')
      .replace('border-radius:12px','border-radius:9px');
    return '.rc352-cover-check{'+next+';-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'
  });
  html=html.replace('.rc352-cover{padding:12mm!important}', '.rc352-cover{padding:7mm!important}');
  html=html.replace(/}\\n\.rc352-qr-slot\.empty/g,'}\n.rc352-qr-slot.empty');
  if(!covers)throw new Error(file+': RC1198 Deckblatt-Grundfläche nicht gefunden');
  if(!refs)throw new Error(file+': RC1198 Deckblatt-Referenzfeld nicht gefunden');
  if(!boxes)throw new Error(file+': RC1198 Deckblatt-Infoboxen nicht gefunden');
  if(!checks)throw new Error(file+': RC1198 Deckblatt-Prüffelder nicht gefunden');
  if(!titles)throw new Error(file+': RC1198 Deckblatt-Titel nicht gefunden');
  return html
}

function patchCoverOnlyPrint(html,file){
  const pages=/function selectedPages\(mode,root\)\{var d=docMap\(root\|\|document\);if\(!d\)return\[\];if\(mode==='load1'\|\|mode==='pod'\)return\[d\.load1\]\.filter\(Boolean\);if\(mode==='load2'\)return\[\];return\[d\.cover,d\.load1\]\.concat\(d\.cmrs\.slice\(0,3\)\)\.filter\(Boolean\)\}/;
  const match=html.match(pages);
  if(!match)throw new Error(file+': RC1198 Dokumentseiten-Auswahl fehlt');
  html=html.replace(pages,"function selectedPages(mode,root){var d=docMap(root||document);if(!d)return[];if(mode==='cover')return[d.cover].filter(Boolean);if(mode==='load1'||mode==='pod')return[d.load1].filter(Boolean);if(mode==='load2')return[];return[d.cover,d.load1].concat(d.cmrs.slice(0,3)).filter(Boolean)}");
  const start=html.indexOf('async function printDocuments(mode){'),end=start<0?-1:html.indexOf('function bytesFromDataUrl',start);
  if(start<0||end<=start)throw new Error(file+': RC1198 Druckfunktion fehlt');
  let block=html.slice(start,end);
  const oldLabel="mode==='all'?'Gesamtausgabe':'Ladeliste'";
  const count=block.split(oldLabel).length-1;
  if(count<2)throw new Error(file+': RC1198 Drucklabel-Anker '+count+'x gefunden');
  block=block.replaceAll(oldLabel,"mode==='all'?'Gesamtausgabe':mode==='cover'?'Deckblatt':'Ladeliste'");
  if(!block.includes("mode==='cover'?'Deckblatt'"))throw new Error(file+': RC1198 Deckblatt-Drucklabel fehlt');
  html=html.slice(0,start)+block+html.slice(end);
  return html
}

function patchShipmentSuspendSave(html,file){
  const anchor="function flushEditSave(reason,keepalive){";
  const replacement="function flushEditSave(reason,keepalive){if(!editSaveReason&&!editSaveTimer&&/vor (?:App-Wechsel|Verlassen)/.test(q(reason)))return true;";
  const count=html.split(anchor).length-1;
  if(count!==1)throw new Error(file+': RC1155 flushEditSave-Anker '+count+'x gefunden');
  html=html.replace(anchor,replacement);
  if(!html.includes("Sendungseingabe vor Verlassen gespeichert"))throw new Error(file+': RC1155 Shipment-pagehide-Anker fehlt');
  if(!html.includes("!editSaveReason&&!editSaveTimer"))throw new Error(file+': RC1155 No-op Suspend-Save Guard fehlt');
  return html
}

function patchTaskDetailTab(html,file){
  const open='<script id="index321-single-navigation-controller">';
  const start=html.indexOf(open),end=start<0?-1:html.indexOf('</script>',start+open.length);
  if(start<0||end<=start)throw new Error(file+': RC1179 Navigationscontroller fehlt');
  let block=html.slice(start,end+'</script>'.length);
  if(!/view:['"]taskdetail['"]/.test(block)){
    const stateAt=block.indexOf('function state(){');
    const itemsAt=stateAt>=0?block.lastIndexOf('var ITEMS=',stateAt):block.indexOf('var ITEMS=');
    if(itemsAt<0)throw new Error(file+': RC1179 ITEMS-Navigation fehlt');
    const arrayStart=block.indexOf('[',itemsAt),arrayEnd=block.indexOf('];',arrayStart);
    if(arrayStart<0||arrayEnd<0)throw new Error(file+': RC1179 ITEMS-Navigation unvollständig');
    let list=block.slice(arrayStart,arrayEnd);
    const taskAt=list.indexOf("view:'tasks'");
    if(taskAt<0)throw new Error(file+': RC1179 Aufgaben-Reiter fehlt');
    const taskEnd=list.indexOf('}',taskAt);
    if(taskEnd<0)throw new Error(file+': RC1179 Aufgaben-Menüeintrag unvollständig');
    const item="{view:'taskdetail',label:'Aufgabenansicht',right:'tasks'}";
    list=list.slice(0,taskEnd+1)+','+item+list.slice(taskEnd+1);
    block=block.slice(0,arrayStart)+list+block.slice(arrayEnd);
  }
  block=block.replace("tasks:'#f59e0b'","tasks:'#f59e0b',taskdetail:'#2563eb'");
  block=block.replace("item.view==='history'?'↺':","item.view==='taskdetail'?'▣':item.view==='history'?'↺':");
  const route=" if(view==='taskdetail'&&window.ExportHUBRC1014TaskRuntime&&typeof window.ExportHUBRC1014TaskRuntime.renderTaskDetailView==='function'){setViewState(view);prepareDirectView(view);var taskDetailRoot=document.getElementById('content');if(taskDetailRoot)taskDetailRoot.innerHTML='';var taskDetailOut=window.ExportHUBRC1014TaskRuntime.renderTaskDetailView();finishDirectView(view);return taskDetailOut}";
  if(!block.includes(route)){
    const historyPos=block.indexOf(" if(view==='history'&&window.ExportHUBRC1081AuditHistory");
    const diagnosticsPos=block.indexOf(" if(view==='diagnostics')");
    const pos=historyPos>=0?historyPos:diagnosticsPos;
    if(pos<0)throw new Error(file+': RC1179 Direktroute konnte nicht eingefügt werden');
    block=block.slice(0,pos)+route+'\n'+block.slice(pos);
  }
  const out=html.slice(0,start)+block+html.slice(end+'</script>'.length);
  if(!/view:['"]taskdetail['"],label:['"]Aufgabenansicht['"],right:['"]tasks['"]/.test(out))throw new Error(file+': RC1179 Aufgabenansicht-Reiter fehlt');
  if(!out.includes("view==='taskdetail'&&window.ExportHUBRC1014TaskRuntime"))throw new Error(file+': RC1179 Aufgabenansicht-Direktroute fehlt');
  return out;
}

function patchHtml(file){
  const target=path.join(OUT,file);
  let html=fs.readFileSync(target,'utf8');
  html=patchDemoTestPortalIsolation(html,file);
  html=patchNotificationTasks(html,file);
  html=patchTaskMasterSaveScope(html,file);
  html=patchTaskDetailTab(html,file);
  html=patchDeckblattHighVisibility(html,file);
  html=patchCoverOnlyPrint(html,file);
  html=patchShipmentSuspendSave(html,file);
  html=html.replace(/ExportHUB RC1048 environment=/g,`ExportHUB ${VERSION} environment=`);
  html=html.replace(
    /var BUILD=Object\.freeze\(\{version:'RC1048',cache:'1048',loginReturn:'([^']*)'\}\);/,
    (_m,ret)=>{
      const next=String(ret||'').replace(/([?&]v=)1048/,'$1'+NUMBER);
      return `var BUILD=Object.freeze({version:'${VERSION}',cache:'${NUMBER}',loginReturn:'${next}'});`;
    }
  );
  html=html.replace(/(window\.__EXPORTHUB_BUILD__\s*=\s*['"])RC1048(['"])/g,`$1${VERSION}$2`);
  html=html.replaceAll(LEGACY_TESTSERVICE_HOST,CURRENT_TESTSERVICE_HOST);
  html=html.replace(/assets\/rc1074-login-clean\.js\?v=1074/g,'assets/rc1074-login-clean.js?v=1112');
  html=html.replace(/assets\/rc1014-task-runtime\.js\?v=1016/g,'assets/rc1014-task-runtime.js?v=1179');
  html=html.replace(/assets\/rc1014-task-ui\.css\?v=1016/g,'assets/rc1014-task-ui.css?v=1179');
  html=html.replace(/assets\/rc1013-diagnostics\.js\?v=1085/g,'assets/rc1013-diagnostics.js?v=1125');
  html=html.replace(/assets\/exporthub-environment-hub\.js\?v=\d+/g,'assets/exporthub-environment-hub.js?v=1174');
  html=html.replace(/assets\/rc1081-audit-history\.js\?v=(?:1087|1126|1160|1163)/g,'assets/rc1081-audit-history.js?v=1177');
  html=html.replace(/assets\/rc1071-shipment-history\.js\?v=(?:1095|1151)/g,'assets/rc1071-shipment-history.js?v=1178');
  html=html.replace(/assets\/rc1063-abd-blob-viewer-compat\.js\?v=1063/g,'assets/rc1063-abd-blob-viewer-compat.js?v=1151');
  html=injectDeferredRuntimeInHead(html,'<!-- id="exporthub-rc1148-history-compat-marker" assets/rc1071-shipment-history.js?v=1095 -->','exporthub-rc1148-history-compat-marker');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1126-customer-delete" defer src="/assets/rc1126-customer-delete.js?v=1126"></script>','exporthub-rc1126-customer-delete');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1113-stowplan-persist" defer src="/assets/rc1113-stowplan-persist.js?v=1113"></script>','exporthub-rc1113-stowplan-persist');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1114-shipping-neutral" defer src="/assets/rc1114-shipping-neutral.js?v=1114"></script>','exporthub-rc1114-shipping-neutral');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1133-avis-upload-notifications" defer src="/assets/rc1133-avis-upload-notifications.js?v=1133"></script>','exporthub-rc1133-avis-upload-notifications');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1160-customer-portal" defer src="/assets/rc1160-customer-portal-credentials.js?v=1162"></script>','exporthub-rc1160-customer-portal');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1165-pod-backup-status" defer src="/assets/rc1165-pod-backup-status.js?v=1165"></script>','exporthub-rc1165-pod-backup-status');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1166-avis-reminder" defer src="/assets/rc1166-avis-reminder-overview.js?v=1166"></script>','exporthub-rc1166-avis-reminder');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1176-shipment-location" defer src="/assets/rc1176-shipment-location.js?v=1196"></script>','exporthub-rc1176-shipment-location');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1193-visible-release" defer src="/assets/rc1193-visible-release.js?v=1193"></script>','exporthub-rc1193-visible-release');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1198-cover-print" defer src="/assets/rc1198-cover-print.js?v=1198"></script>','exporthub-rc1198-cover-print');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1177-release-notes" defer src="/assets/rc1177-release-notes.js?v=1193"></script>','exporthub-rc1177-release-notes');
  if(html.includes(LEGACY_TESTSERVICE_HOST))throw new Error(file+': alter TESTSERVICE-Endpunkt ist noch aktiv');
  if(!html.includes(CURRENT_TESTSERVICE_HOST))throw new Error(file+': aktueller TESTSERVICE-Endpunkt fehlt');
  if(!html.includes(`version:'${VERSION}'`))throw new Error(file+': BUILD '+VERSION+' fehlt');
  if(!html.includes(`ExportHUB ${VERSION} environment=`))throw new Error(file+': Environment '+VERSION+' fehlt');
  if(!html.includes('assets/rc1074-login-clean.js?v=1112'))throw new Error(file+': RC1112 ABD/Login Cache-Key fehlt');
  if(!html.includes('assets/rc1014-task-runtime.js?v=1179'))throw new Error(file+': RC1156 Aufgaben-Runtime Cache-Key fehlt');
  if(!html.includes('assets/rc1014-task-ui.css?v=1179'))throw new Error(file+': RC1152 Aufgaben-CSS Cache-Key fehlt');
  if(!html.includes('assets/rc1013-diagnostics.js?v=1125'))throw new Error(file+': RC1125 Diagnose Cache-Key fehlt');
  if(!html.includes('assets/exporthub-environment-hub.js?v=1174'))throw new Error(file+': RC1174 Android-Diagnose-Hub Cache-Key fehlt');
  if(!html.includes('assets/rc1081-audit-history.js?v=1177'))throw new Error(file+': RC1177 Historie Cache-Key fehlt');
  if(!html.includes('assets/rc1071-shipment-history.js?v=1178'))throw new Error(file+': RC1178 Druck-History Cache-Key fehlt');
  if(file!=='demo.html'&&!html.includes('assets/rc1063-abd-blob-viewer-compat.js?v=1151'))throw new Error(file+': RC1151 Dokumentaktionen Cache-Key fehlt');
  if(!html.includes('assets/rc1071-shipment-history.js?v=1095'))throw new Error(file+': RC1148 History-Kompatibilitätsmarker fehlt');
  if(!html.includes('assets/rc1126-customer-delete.js?v=1126'))throw new Error(file+': RC1126 Kundenlöschung fehlt');
  if(!html.includes('assets/rc1113-stowplan-persist.js?v=1113'))throw new Error(file+': RC1113 Stauplan-Erweiterung fehlt');
  if(!html.includes('assets/rc1114-shipping-neutral.js?v=1114'))throw new Error(file+': RC1114 neutrale Versandkostenoberfläche fehlt');
  if(!html.includes('assets/rc1133-avis-upload-notifications.js?v=1133'))throw new Error(file+': RC1133 AVIS-Upload-Benachrichtigungen fehlen');
  if(!html.includes('assets/rc1160-customer-portal-credentials.js?v=1162'))throw new Error(file+': RC1160 Kundenportal-Runtime fehlt');
  if(!html.includes('assets/rc1165-pod-backup-status.js?v=1165'))throw new Error(file+': RC1165 POD-Sicherungsstatus-Runtime fehlt');
  if(!html.includes('assets/rc1166-avis-reminder-overview.js?v=1166'))throw new Error(file+': RC1166 Avis-Erinnerung-Runtime fehlt');
  if(!html.includes('assets/rc1176-shipment-location.js?v=1196'))throw new Error(file+': RC1191 Standort-Capture-Runtime fehlt');
  if(!html.includes('assets/rc1193-visible-release.js?v=1193'))throw new Error(file+': RC1193 sichtbare Release-Version fehlt');
  if(!html.includes('assets/rc1198-cover-print.js?v=1198'))throw new Error(file+': RC1198 Nur-Deckblatt-Druck fehlt');
  if(!html.includes("if(mode==='cover')return[d.cover].filter(Boolean)"))throw new Error(file+': RC1198 isolierte Deckblatt-Seite fehlt');
  if(!html.includes('assets/rc1177-release-notes.js?v=1193'))throw new Error(file+': RC1193 Änderungshinweise Cache-Key fehlt');
  if(!/\.rc352-cover\{(?=[^}]*border:10mm solid #08245d!important)(?=[^}]*border-top-width:20mm!important)(?=[^}]*#facc15)[^}]*\}/.test(html))throw new Error(file+': RC1198 Paletten-Sichtbarkeitsrahmen fehlt');
  if(!/\.rc352-cover-ref\{(?=[^}]*background:#08245d)(?=[^}]*border:4mm solid #facc15)[^}]*\}/.test(html))throw new Error(file+': RC1198 Deckblatt-Referenzfeld ist nicht ausreichend hervorgehoben');
  if(!/\.rc352-cover-box\{(?=[^}]*background:#dbeafe)(?=[^}]*border:2mm solid #08245d)[^}]*\}/.test(html))throw new Error(file+': RC1198 farbige Deckblatt-Infoboxen fehlen');
  if(!/\.rc352-cover-check\{(?=[^}]*background:#fef3c7)(?=[^}]*border:2mm solid #08245d)[^}]*\}/.test(html))throw new Error(file+': RC1198 farbige Deckblatt-Prüffelder fehlen');
  if(/\\\\n\.rc352-qr-slot\.empty/.test(html))throw new Error(file+': RC1133 Deckblatt-CSS enthält literalen \\n-Text');
  if(file==='demo.html'){
    if(!html.includes("namedTest=/-testservice\\./i.test(h)&&window.__EXPORTHUB_DEMO_MODE__!==true;"))throw new Error(file+': RC1131 Demo/Testservice-Origin nicht getrennt');
    if(!html.includes('if(window.__EXPORTHUB_DEMO_MODE__===true)return;'))throw new Error(file+': RC1131 Testportal-Runtime ist in Demo noch aktiv');
    if(!html.includes('window.__EXPORTHUB_DEMO_MODE__===true||window.__EXPORTHUB_PICKUP_MODE__'))throw new Error(file+': RC1131 Demo-Routenanker fehlt');
  }
  fs.writeFileSync(target,html);
}

execFileSync(process.execPath,['.github/rc1048/build-three-env.mjs'],{cwd:ROOT,stdio:'inherit'});
fs.rmSync(OUT,{recursive:true,force:true});
fs.cpSync(SRC,OUT,{recursive:true});
const currentApi=path.join(ROOT,'api'),builtApi=path.join(OUT,'api');
if(!fs.existsSync(currentApi))throw new Error('Aktuelles API-Verzeichnis fehlt');
fs.mkdirSync(builtApi,{recursive:true});
fs.cpSync(currentApi,builtApi,{recursive:true,force:true});
for(const rel of [
  'assets/rc1027-lieferavis-immediate.js',
  'assets/rc1037-lieferavis-timing-diagnostics.js',
  'assets/rc1049-abd-avis-policy.js',
  'assets/rc1014-task-runtime.js',
  'assets/rc1014-task-ui.css',
  'assets/rc1126-customer-delete.js',
  'assets/rc1133-avis-upload-notifications.js',
  'assets/rc1081-audit-history.js',
  'assets/rc1160-customer-portal-credentials.js',
  'assets/rc1165-pod-backup-status.js',
  'assets/rc1166-avis-reminder-overview.js',
  'assets/rc1176-shipment-location.js',
  'assets/rc1177-release-notes.js',
  'assets/rc1193-visible-release.js',
  'assets/rc1198-cover-print.js'
]){
  const src=path.join(ROOT,rel),dst=path.join(OUT,rel);
  if(!fs.existsSync(src))throw new Error('RC1124 Pflicht-Runtime fehlt: '+rel);
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(src,dst);
  if(!fs.existsSync(dst)||fs.statSync(dst).size===0)throw new Error('RC1124 Pflicht-Runtime wurde nicht gebaut: '+rel);
}
for(const requiredApi of ['shared/pod-archive.js','shared/graph-drive.js','shared/customer-portal-store.js','customer-portal-credentials/index.js','customer-portal-credentials/function.json','customer-portal-readiness/index.js','customer-portal-readiness/function.json','pickup-confirm-v2/index.js','pod-backup/index.js','package.json']){
  if(!fs.existsSync(path.join(builtApi,requiredApi)))throw new Error('RC1114 API-Datei fehlt im Build: '+requiredApi);
}
const rc1114PickupSource=path.join(ROOT,'pickup.html');
if(!fs.existsSync(rc1114PickupSource))throw new Error('RC1114 pickup.html fehlt');
fs.copyFileSync(rc1114PickupSource,path.join(OUT,'pickup.html'));
const rc1113StowSrc=path.join(ROOT,'assets','rc1113-stowplan-persist.js');
const rc1113StowOut=path.join(OUT,'assets','rc1113-stowplan-persist.js');
if(!fs.existsSync(rc1113StowSrc))throw new Error('RC1113 Stauplan-Runtime fehlt');
fs.mkdirSync(path.dirname(rc1113StowOut),{recursive:true});
fs.copyFileSync(rc1113StowSrc,rc1113StowOut);
const rc1114ShippingSrc=path.join(ROOT,'assets','rc1114-shipping-neutral.js');
const rc1114ShippingOut=path.join(OUT,'assets','rc1114-shipping-neutral.js');
if(!fs.existsSync(rc1114ShippingSrc))throw new Error('RC1114 Versandkosten-Runtime fehlt');
fs.copyFileSync(rc1114ShippingSrc,rc1114ShippingOut);
for(const file of ['index.html','TESTVERSION.html','demo.html'])patchHtml(file);

const probeFile=path.join(OUT,'production-version.js');
let probe=fs.readFileSync(probeFile,'utf8');
probe=probe.replace(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1048'/g,`__EXPORTHUB_PRODUCTION_VERSION_PROBE__='${VERSION}'`);
if(!probe.includes(`__EXPORTHUB_PRODUCTION_VERSION_PROBE__='${VERSION}'`))throw new Error('RC1112 Produktionsmarker fehlt');
fs.writeFileSync(probeFile,probe);

const previousManifest=JSON.parse(fs.readFileSync(path.join(SRC,'rc1048-manifest.json'),'utf8'));
fs.writeFileSync(path.join(OUT,'rc1112-manifest.json'),JSON.stringify({
  schema:'exporthub-rc1112-three-env-v1',
  version:VERSION,
  sourceRelease:'RC1048',
  sourceManifest:previousManifest,
  releaseFixes:{
    visibleVersion:'RC1112',
    taskDetailAndManagedRoster:'RC1179 dedicated Aufgabenansicht tab + RC1152 recurring roster + targeted legacy cleanup',
    abdDashboardCustomer:true,
    androidBuildSetup:'runner-sdkmanager',
    loginAbdAssetCache:'1112',
    stowPlanInstructionsAndPersistence:'RC1113',
    shippingProviderNeutralUi:'RC1114',
    podReliability:'RC1114 server-side Azure primary + Microsoft 365 retry',
    podGraphReadiness:'RC1164 fail-closed Graph configuration gate before reconcile',
    podTargetFailClosed:'RC1195 explicit drive user + folder required, no personal OneDrive fallback',
    podBackupStatusUi:'RC1165 shipment overview Azure/M365 backup status',
    podTargetedProof:'RC1168 targeted reference proof: found/already-saved/saved-now/not-found/pending',
    avisReminderOverview:'RC1166 DE/EN customer/carrier reminder via stored contacts + secure avis link',
    avisUploadNotifications:'RC1133 secure customer PDF notice + open/print action',
    documentActionHistory:'RC1178 print/open/download + user + filename, including resumed print flow',
    deckblattHighVisibility:'RC1198 safety-yellow pallet sheet + navy frame + non-white information fields + oversized reference',
    coverOnlyPrint:'RC1198 direct only-cover print from shipment creation with save-before-print guard',
    customerPortalCredentials:'RC1160 AES-256-GCM + re-auth + use/manage rights',
    customerPortalReadiness:'RC1162 safe key-status + UI readiness guard',
    avisAppointmentRevisionHistory:'RC1163 old/new pickup appointment history before actual pickup',
    diagnosticsNonAdminProof:'RC1169 live non-admin rights view + diagnostics-read 403',
    customerPortalReleaseReadiness:'RC1170 OIDC live configured=true gate in TESTSERVICE and PRODUCTION',
    customerPortalKeyStrength:'RC1187 minimum 32 characters, fail-closed before portal use and production release',
    customerPortalKeyDiagnostics:'RC1194 safe missing-vs-too-short readiness without secret or exact length disclosure',
    shipmentCreateUiE2E:'RC1171 UI customer + location + reference + colli + save + reload + overview',
    testserviceGateOrder:'RC1172 browser/mutation gate before external readiness blocker, production still protected',
    shipmentLocationPersistence:'RC1196 synthetic empty rerender guard + same-customer persistence',
    historyConsolidationAndReleaseNotes:'RC1177 duplicate shipment history cleanup + current Update changelog',
    visibleProductVersion:'RC1193 separate visible release label while RC1112 remains the stable build/deploy pipeline'
  },
  compatibility:{
    qr:'stable-existing-links',
    historicalBuildPath:'RC1048 preserved'
  },
  environments:{production:'index.html',testservice:'TESTVERSION.html',demo:'demo.html'}
},null,2)+'\n');

console.log('RC1112 build pipeline ready: sichtbare Produktversion RC1193 auf geprüfter RC1048-Basis, RC1194 sichere Kundenportal-Key-Diagnose aktiv.');
