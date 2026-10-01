import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const SRC=path.join(ROOT,'dist-rc1048');
const OUT=path.join(ROOT,'dist-rc1112');
const VERSION='RC1112';
const NUMBER='1112';
const RELEASE_VERSION_FILE=path.join(ROOT,'release-version.json');
function resolveVisibleVersion(){
  const explicit=String(process.env.EXPORTHUB_VISIBLE_RELEASE_VERSION||'').trim().toUpperCase();
  if(/^RC\d+$/.test(explicit))return explicit;
  const marker=JSON.parse(fs.readFileSync(RELEASE_VERSION_FILE,'utf8'));
  const visible=String(marker&&marker.visibleRelease||'').trim().toUpperCase();
  const technical=String(marker&&marker.technicalBuild||'').trim().toUpperCase();
  if(!/^RC\d+$/.test(visible))throw new Error('RC1314 release-version.json visibleRelease ist ungültig');
  if(technical!==VERSION)throw new Error('RC1314 release-version.json technicalBuild '+technical+' stimmt nicht mit '+VERSION+' überein');
  return visible;
}
const VISIBLE_VERSION=resolveVisibleVersion();
const VISIBLE_NUMBER=VISIBLE_VERSION.slice(2);
const LEGACY_TESTSERVICE_HOST='wonderful-forest-0f315e310-testservice.centralus.7.azurestaticapps.net';
const CURRENT_TESTSERVICE_HOST='ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';
const PUBLIC_PRODUCTION_HOST='www.exporthub360.de';
const PUBLIC_PRODUCTION_ORIGIN='https://www.exporthub360.de';
const RC1303_LOGIN_FIRST_PAINT_STYLE=`<style id="exporthub-rc1303-login-first-paint">
#login .login-card{width:min(540px,100%)!important;padding:28px 30px 26px!important}
#login .logo{width:66px!important;height:66px!important;border-radius:20px!important;font-size:24px!important}
#login h1{margin:8px 0 14px!important;font-size:34px!important}
#login .clean-version-badge,#login .eh-login-mode-head,#login .eh-login-environment-note{display:none!important}
#login .eh-login-environment{grid-template-columns:1fr 1fr!important;gap:10px!important;margin:0 0 16px!important}
#login .eh-login-environment button{min-height:68px!important;padding:11px 14px!important;border:1px solid #cbd5e1!important;border-radius:15px!important;background:#f8fafc!important;color:#334155!important;box-shadow:none!important;filter:none!important;transform:none!important;text-align:left!important;transition:none!important}
#login .eh-login-environment button.is-active,#login .eh-login-environment button.active,#login .eh-login-environment button[aria-pressed="true"]{border-color:#2563eb!important;background:linear-gradient(135deg,#4f9fdb,#67b8ee)!important;color:#0f2942!important;filter:saturate(1.08) brightness(1.03)!important;transform:translateY(-1px)!important;box-shadow:0 0 0 3px rgba(56,189,248,.24),0 0 26px rgba(14,165,233,.48),0 10px 22px rgba(37,99,235,.22)!important}
#login .login-lang{margin:0 0 12px!important}
#login .field{margin:10px 0!important}
#login .field input,#login .field select{min-height:44px!important}
#login .rc119-login-remember{margin:8px 0 12px!important;padding:9px 10px!important}
#login #loginBtn{min-height:46px!important;margin-top:2px!important}
#login #loginMicrosoftAccountSwitchBtn,#login #adminRecoveryBtn{min-height:34px!important;margin-top:6px!important;padding:5px 8px!important}
@media(max-width:600px){#login .login-card{width:min(100%,440px)!important;padding:18px 16px 16px!important}#login .logo{width:54px!important;height:54px!important;border-radius:17px!important;font-size:20px!important}#login h1{font-size:27px!important;margin-bottom:12px!important}#login .eh-login-environment{margin-bottom:12px!important}#login .eh-login-environment button{min-height:58px!important;padding:9px 10px!important}}
</style>`;
const RC1267_I18N_TAG='<script id="exporthub-rc1267-i18n" defer src="/assets/rc1267-i18n.js?v=1267"></script>';
const RC1206_SHIPPING_ID='exporthub-rc1206-shipping-rules';
const RC1206_SHIPPING_TAG='<script id="'+RC1206_SHIPPING_ID+'" defer src="/assets/rc1206-shipping-rules.js?v=1334"></script>';
const RC1296_BROWSER_TITLE='ExportHUB360';
const RC1296_FAVICON_TAG='<link id="exporthub360-favicon" rel="icon" type="image/svg+xml" href="/assets/exporthub360-favicon.svg?v=1296">';
const RC1304_THEME_STYLE_TAG='<link id="exporthub-rc1304-theme-style" rel="stylesheet" href="/assets/rc1304-theme-switcher.css?v=1305">';
const RC1304_THEME_SCRIPT_TAG='<script id="exporthub-rc1304-theme-script" src="/assets/rc1304-theme-switcher.js?v=1305"><\/script>';
const RC1306_LAYOUT_STYLE_TAG='<link id="exporthub-rc1306-layout-style" rel="stylesheet" href="/assets/rc1306-layout-engine.css?v=1306">';
const RC1306_LAYOUT_SCRIPT_TAG='<script id="exporthub-rc1306-layout-script" defer src="/assets/rc1306-layout-engine.js?v=1306"><\/script>';
const RC1328_MULTI_TRUCK_REFRESH_TAG='<script id="exporthub-rc1328-multi-truck-refresh" defer src="/assets/rc1328-multi-truck-ui-refresh.js?v=1333"><\/script>';

function patchRc1296BrowserBranding(html,file){
  if(file!=='index.html'&&file!=='demo.html')return html;
  const headOpen=/<head\b[^>]*>/i.exec(html);
  if(!headOpen)throw new Error(file+': RC1296 äußerer <head>-Anker fehlt');
  const start=headOpen.index+headOpen[0].length;
  const end=html.toLowerCase().indexOf('</head>',start);
  if(end<0)throw new Error(file+': RC1296 äußerer </head>-Anker fehlt');
  let head=html.slice(start,end);
  const title=/<title\b[^>]*>[\s\S]*?<\/title>/i;
  head=title.test(head)?head.replace(title,'<title>'+RC1296_BROWSER_TITLE+'</title>'):'<title>'+RC1296_BROWSER_TITLE+'</title>\n'+head;
  if(!head.includes('id="exporthub360-favicon"'))head+='\n'+RC1296_FAVICON_TAG+'\n';
  html=html.slice(0,start)+head+html.slice(end);
  if(!html.includes('<title>'+RC1296_BROWSER_TITLE+'</title>'))throw new Error(file+': RC1296 Browser-Titel fehlt');
  if(!html.includes(RC1296_FAVICON_TAG))throw new Error(file+': RC1296 Favicon fehlt');
  return html;
}

function injectDeferredRuntimeInHead(html,tag,id){
  if(id&&(html.includes('id="'+id+'"')||html.includes("id='"+id+"'")))return html;
  const headOpen=/<head\b[^>]*>/i.exec(html);
  if(!headOpen)throw new Error((id||'Script')+': äußerer <head>-Anker fehlt');
  const start=headOpen.index+headOpen[0].length;
  const lower=html.toLowerCase(),idx=lower.indexOf('</head>',start);
  if(idx<0)throw new Error((id||'Script')+': äußerer </head>-Anker fehlt');
  return html.slice(0,idx)+tag+'\n'+html.slice(idx);
}
function injectImmediateRuntimeAfterHead(html,tag,id){
  if(id&&(html.includes('id="'+id+'"')||html.includes("id='"+id+"'")))return html;
  const headOpen=/<head\b[^>]*>/i.exec(html);
  if(!headOpen)throw new Error((id||'Script')+': äußerer <head>-Anker fehlt');
  const at=headOpen.index+headOpen[0].length;
  return html.slice(0,at)+'\n'+tag+html.slice(at);
}

function patchRc1304ThemeRedesign(html,file){
  html=injectDeferredRuntimeInHead(html,RC1304_THEME_STYLE_TAG,'exporthub-rc1304-theme-style');
  html=injectDeferredRuntimeInHead(html,RC1304_THEME_SCRIPT_TAG,'exporthub-rc1304-theme-script');
  if(!html.includes('rc1304-theme-switcher.css?v=1305'))throw new Error(file+': RC1304 Theme-CSS fehlt');
  if(!html.includes('rc1304-theme-switcher.js?v=1305'))throw new Error(file+': RC1304 Theme-Switcher fehlt');
  return html;
}

function patchRc1306LayoutEngine(html,file){
  html=injectDeferredRuntimeInHead(html,RC1306_LAYOUT_STYLE_TAG,'exporthub-rc1306-layout-style');
  html=injectDeferredRuntimeInHead(html,RC1306_LAYOUT_SCRIPT_TAG,'exporthub-rc1306-layout-script');
  if(!html.includes('rc1306-layout-engine.css?v=1306'))throw new Error(file+': RC1306 Layout-CSS fehlt');
  if(!html.includes('rc1306-layout-engine.js?v=1306'))throw new Error(file+': RC1306 Layout-Engine fehlt');
  return html;
}

function patchRc1328MultiTruckRefresh(html,file){
  html=injectDeferredRuntimeInHead(html,RC1328_MULTI_TRUCK_REFRESH_TAG,'exporthub-rc1328-multi-truck-refresh');
  if(!html.includes('assets/rc1328-multi-truck-ui-refresh.js?v=1333'))throw new Error(file+': RC1333 Mehr-LKW UI-Refresh fehlt');
  return html;
}

function patchRc1329MultiTruckUiRuntime(html,file){
  const source=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const canonicalStart='var rc1017SubShipmentQrRuntime=Object.create(null);';
  const legacyStart='function renderRc1017SubShipments(result){';
  const endMarker='function rc1017SyncSubShipments(';
  const sourceStart=source.indexOf(canonicalStart),sourceEnd=source.indexOf(endMarker,sourceStart);
  if(sourceStart<0||sourceEnd<=sourceStart)throw new Error('RC1329 kanonische Mehr-LKW-UI fehlt in index.html');
  const canonical=source.slice(sourceStart,sourceEnd);
  if(!canonical.includes("section.id='rc1017-subshipments'")||!canonical.includes('data-rc1017-subshipment')||!canonical.includes('rc1017-qr-subshipment'))throw new Error('RC1329 kanonischer Mehr-LKW-Renderer ist unvollständig');
  let targetStart=html.indexOf(canonicalStart);
  if(targetStart<0)targetStart=html.indexOf(legacyStart);
  const targetEnd=targetStart<0?-1:html.indexOf(endMarker,targetStart);
  if(targetStart<0||targetEnd<=targetStart)throw new Error(file+': RC1329 Mehr-LKW-Renderer-Anker fehlt');
  html=html.slice(0,targetStart)+canonical+html.slice(targetEnd);
  const verifyStart=html.indexOf(canonicalStart),verifyEnd=html.indexOf(endMarker,verifyStart),verify=verifyStart>=0&&verifyEnd>verifyStart?html.slice(verifyStart,verifyEnd):'';
  if(!verify.includes("section.id='rc1017-subshipments'")||!verify.includes('data-rc1017-subshipment')||!verify.includes('rc1017-print-subshipment')||!verify.includes('rc1017-stow-subshipment'))throw new Error(file+': RC1329 sichtbarer Mehr-LKW-Renderer fehlt im finalen Build');
  return html;
}

function patchRc1289AuthTransportFallback(html,file){
  if(file==='demo.html')return html;
  const tag='<script id="exporthub-rc1289-auth-transport-fallback" src="/assets/rc1289-auth-transport-fallback.js?v=1289"></script>';
  html=injectImmediateRuntimeAfterHead(html,tag,'exporthub-rc1289-auth-transport-fallback');
  const at=html.indexOf(tag),headEnd=html.toLowerCase().indexOf('</head>');
  if(at<0||headEnd<0||at>headEnd)throw new Error(file+': RC1289 Auth-Fallback nicht früh im Head geladen');
  return html;
}

function patchRc1303LoginExperience(html,file){
  html=injectImmediateRuntimeAfterHead(html,RC1303_LOGIN_FIRST_PAINT_STYLE,'exporthub-rc1303-login-first-paint');
  const prodHost="var PROD_HOST='wonderful-forest-0f315e310.7.azurestaticapps.net';";
  const prodOrigin="var PROD_ORIGIN='https://wonderful-forest-0f315e310.7.azurestaticapps.net';";
  const isProd="function isProd(){return host()===PROD_HOST}";
  const testUrl="function testUrl(){return TEST_ORIGIN+'/TESTVERSION.html?entry=login&_='+cache()}";
  const prodUrl="function prodUrl(){return PROD_ORIGIN+'/index.html?entry=login&_='+cache()}";
  const exposedProd="productionUrl:PROD_ORIGIN+'/index.html'";
  if(html.includes(prodHost))html=html.replace(prodHost,"var PROD_HOST='"+PUBLIC_PRODUCTION_HOST+"';");
  if(html.includes(prodOrigin))html=html.replace(prodOrigin,"var PROD_ORIGIN='"+PUBLIC_PRODUCTION_ORIGIN+"';");
  if(html.includes(isProd))html=html.replace(isProd,"function isProd(){var h=host();return h===PROD_HOST||h==='exporthub360.de'}");
  if(html.includes(testUrl))html=html.replace(testUrl,"function testUrl(){return TEST_ORIGIN+'/TESTVERSION.html?entry=login'}");
  if(html.includes(prodUrl))html=html.replace(prodUrl,"function prodUrl(){return PROD_ORIGIN+'/?entry=login'}");
  if(html.includes(exposedProd))html=html.replace(exposedProd,"productionUrl:PROD_ORIGIN+'/'");

  const prodButton='<button type="button" id="ehLoginProduction" data-environment="production">';
  const testButton='<button type="button" id="ehLoginTestservice" data-environment="testservice">';
  if(file==='index.html'){
    if(html.includes(prodButton))html=html.replace(prodButton,'<button type="button" id="ehLoginProduction" data-environment="production" class="is-active active" aria-pressed="true" aria-current="page">');
    if(html.includes(testButton))html=html.replace(testButton,'<button type="button" id="ehLoginTestservice" data-environment="testservice" aria-pressed="false" aria-current="false">');
  }else if(file==='TESTVERSION.html'){
    if(html.includes(prodButton))html=html.replace(prodButton,'<button type="button" id="ehLoginProduction" data-environment="production" aria-pressed="false" aria-current="false">');
    if(html.includes(testButton))html=html.replace(testButton,'<button type="button" id="ehLoginTestservice" data-environment="testservice" class="is-active active" aria-pressed="true" aria-current="page">');
  }

  const optional="var cred=await navigator.credentials.get({password:true,mediation:'optional'});if(!cred){";
  const retry="var cred=await navigator.credentials.get({password:true,mediation:'optional'});if(!cred)try{cred=await navigator.credentials.get({password:true,mediation:'required'})}catch(_){}if(!cred){";
  if(html.includes(optional))html=html.replace(optional,retry);

  if(!html.includes('id="exporthub-rc1303-login-first-paint"'))throw new Error(file+': RC1303 Login-First-Paint fehlt');
  if(file!=='demo.html'){
    if(!html.includes(PUBLIC_PRODUCTION_ORIGIN))throw new Error(file+': RC1303 öffentliche Produktionsdomain fehlt');
    if(html.includes("PROD_ORIGIN='https://wonderful-forest-0f315e310.7.azurestaticapps.net'"))throw new Error(file+': RC1303 alte Produktions-URL ist noch im Login-Umschalter aktiv');
    if(!html.includes("mediation:'required'"))throw new Error(file+': RC1303 Passwortmanager-Fallback fehlt');
  }
  return html;
}

function patchRc1206ShippingRules(html,file){
  html=injectDeferredRuntimeInHead(html,RC1206_SHIPPING_TAG,RC1206_SHIPPING_ID);
  if(!html.includes('rc1206-shipping-rules.js?v=1334'))throw new Error(file+': RC1334 Versandkosten-Runtime fehlt');
  return html;
}

function patchMainCountryDetection(html,file){
  const linesAnchor=" var lines=raw.split(/[\\n,;|]+/).map(q).filter(Boolean);";
  const italyRule=" var italian=raw.match(/\\b([0-9]{5})\\b[\\s\\S]*\\b([A-Za-z]{2})\\s*$/),itProvinces='|AG|AL|AN|AO|AP|AQ|AR|AT|AV|BA|BG|BI|BL|BN|BO|BR|BS|BT|BZ|CA|CB|CE|CH|CI|CL|CN|CO|CR|CS|CT|CZ|EN|FC|FE|FG|FI|FM|FR|GE|GO|GR|IM|IS|KR|LC|LE|LI|LO|LT|LU|MB|MC|ME|MI|MN|MO|MS|MT|NA|NO|NU|OR|PA|PC|PD|PE|PG|PI|PN|PO|PR|PT|PU|PV|PZ|RA|RC|RE|RG|RI|RM|RN|RO|SA|SI|SO|SP|SR|SS|SU|SV|TA|TE|TN|TO|TP|TR|TS|TV|UD|VA|VB|VC|VE|VI|VR|VS|VT|VV|';if(italian&&itProvinces.indexOf('|'+String(italian[2]).toUpperCase()+'|')>=0)return countryName('IT');\n";
  const count=html.split(linesAnchor).length-1;
  if(count!==1)throw new Error(file+': RC1237 countryFromAddress-Anker '+count+'x gefunden');
  html=html.replace(linesAnchor,italyRule+linesAnchor);

  const customerFirst="||firstValue(loc,['country','land','countryName','countryCode','iso','iso2'])||firstValue(c,['country','land','countryName','countryCode','iso','iso2'])||countryFromAddress(address)";
  const addressFirst="||firstValue(loc,['country','land','countryName','countryCode','iso','iso2'])||countryFromAddress(address)||firstValue(c,['country','land','countryName','countryCode','iso','iso2'])";
  const orderCount=html.split(customerFirst).length-1;
  if(orderCount!==1)throw new Error(file+': RC1237 Zielland-Priorität '+orderCount+'x gefunden');
  html=html.replace(customerFirst,addressFirst);

  if(!html.includes("itProvinces='|AG|AL|AN|"))throw new Error(file+': RC1237 Italien-Provinzerkennung fehlt');
  if(!html.includes(addressFirst))throw new Error(file+': RC1237 Lieferadresse hat nicht Vorrang vor Kundenland');
  return html;
}



function patchAuthSessionTimeout(html,file){
  const before="const d=await authCall('session',{});";
  const after="const d=await authCall('session',{},runtime.authToken,{timeoutMs:120000,maxAttempts:1});";
  const count=html.split(before).length-1;
  if(count!==1)throw new Error(file+': RC1247 Session-Keepalive-Anker '+count+'x gefunden');
  html=html.replace(before,after);
  if(!html.includes(after))throw new Error(file+': RC1247 Session-Keepalive verwendet nicht 120s Einzelrequest');
  return html;
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
  let covers=0,refs=0;
  html=html.replace(/\.rc352-cover\{([^}]*)\}/g,function(full,body){
    if(body.indexOf('border:8mm solid #08245d!important;')<0)return full;
    covers++;
    var next=body
      .replace('border:8mm solid #08245d!important;','border:10mm solid #08245d!important;border-top-width:18mm!important;outline:2mm solid #2563eb!important;outline-offset:-3mm!important;')
      .replace('background:linear-gradient(180deg,#60a5fa 0,#93c5fd 58mm,#bfdbfe 58mm,#dbeafe 100%)','background:linear-gradient(180deg,#1d4ed8 0,#60a5fa 66mm,#dbeafe 66mm,#eff6ff 100%)')
      .replace('box-shadow:inset 0 0 0 2mm #1d4ed8','box-shadow:inset 0 0 0 3mm #60a5fa')
      .replace('padding:8mm','padding:6mm');
    return '.rc352-cover{'+next+'}'
  });
  html=html.replace(/\.rc352-cover-ref\{([^}]*)\}/g,function(full,body){
    if(body.indexOf('background:#08245d')<0)return full;
    refs++;
    var next=body
      .replace('background:#08245d','background:#facc15')
      .replace('border:3px solid #60a5fa','border:3mm solid #111827')
      .replace('color:#fff!important','color:#111827!important');
    return '.rc352-cover-ref{'+next+'}'
  });
  html=html.replace(/(\.rc352-cover-ref span\{[^}]*?)color:#fff/g,'$1color:#111827');
  html=html.replace(/(\.rc352-cover-ref strong\{)color:#fff!important/g,'$1color:#111827!important');
  html=html.replace(/}\\n\.rc352-qr-slot\.empty/g,'}\n.rc352-qr-slot.empty');
  if(!covers)throw new Error(file+': RC1133 Deckblatt-Grundfläche nicht gefunden');
  if(!refs)throw new Error(file+': RC1133 Deckblatt-Referenzfeld nicht gefunden');
  return html
}

function patchRc1203ActualDeckblatt(html,file){
  if(html.includes('data-rc1281-customer-theme=')&&html.includes('id="exporthub-rc1203-deckblatt-style"'))return html;
  const start=html.indexOf('function coverHtml(sh){');
  const end=start<0?-1:html.indexOf('function rc1095LoadPalletCount',start);
  if(start<0||end<0)throw new Error(file+': RC1281 echter rc390-coverHtml-Renderer fehlt');
  let block=html.slice(start,end);

  const coverFnOld="function coverHtml(sh){var c=cname(sh),addr=caddress(sh),t=totals(sh),d=documents(sh),ref=esc(sref(sh)||sid(sh));return";
  const coverFnNew="function coverHtml(sh){var c=cname(sh),addr=caddress(sh),t=totals(sh),d=documents(sh),ref=esc(sref(sh)||sid(sh)),isEssentra=/\\bessentra\\b/i.test(c),created=dateDe(sh&&(sh.createdAt||sh.createdDateTime||sh.createdOn||sh.createdDate||sh.created));return";
  if(block.split(coverFnOld).length-1!==1)throw new Error(file+': RC1281 coverHtml-Kopf nicht eindeutig');
  block=block.replace(coverFnOld,coverFnNew);

  const coverOld=`<section id="rc565Cover" class="rc390-page rc390-cover rc576-cover rc601-cover" data-shipment-ref="'+ref+'">`;
  const coverNew=`<section id="rc565Cover" class="rc390-page rc390-cover rc576-cover rc601-cover rc1203-cover" data-rc1203-cover-enhanced="1" data-rc1281-customer-theme="'+(isEssentra?'essentra':'customer')+'" data-shipment-ref="'+ref+'" style="box-sizing:border-box!important;border:3mm solid #334155!important;border-top-width:5mm!important;outline:0!important;background:#fff!important;background-image:none!important;color:#1f2937!important;box-shadow:inset 0 0 0 1mm #dbe4ee!important;padding:8mm!important;--rc1281-ref-bg:'+(isEssentra?'#facc15':'#2563eb')+';--rc1281-ref-border:'+(isEssentra?'#ca8a04':'#1d4ed8')+';--rc1281-ref-text:'+(isEssentra?'#111827':'#ffffff')+';--rc1281-recipient-bg:'+(isEssentra?'#fef9c3':'#dbeafe')+';--rc1281-recipient-border:'+(isEssentra?'#eab308':'#60a5fa')+';--rc1281-recipient-text:'+(isEssentra?'#713f12':'#1e3a8a')+';-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important">`;
  if(block.split(coverOld).length-1!==1)throw new Error(file+': RC1281 rc390-Cover-Anker nicht eindeutig');
  block=block.replace(coverOld,coverNew);

  const recipientOld='<div class="rc390-card"><div class="rc390-label">Empfänger</div><strong>';
  const recipientNew='<div class="rc390-card rc1203-cover-recipient" data-rc1203-recipient-highlight="1" style="font-size:14pt!important;line-height:1.2!important;font-weight:750!important;padding:4mm!important;border:1mm solid var(--rc1281-recipient-border)!important;background:var(--rc1281-recipient-bg)!important;color:var(--rc1281-recipient-text)!important"><div class="rc390-label">Empfänger</div><strong style="font-size:17pt!important;line-height:1.15!important;font-weight:800!important;color:var(--rc1281-recipient-text)!important">';
  if(block.split(recipientOld).length-1<1)throw new Error(file+': RC1281 Empfänger-Anker fehlt');
  block=block.replace(recipientOld,recipientNew);

  const refOld='<div class="rc390-cover-ref"><span>Sendungsreferenz</span><b>';
  const refNew='<div class="rc390-cover-ref rc1203-cover-reference" data-rc1203-reference-highlight="1" style="background:var(--rc1281-ref-bg)!important;border:1.2mm solid var(--rc1281-ref-border)!important;color:var(--rc1281-ref-text)!important;padding:4mm!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important"><span style="color:var(--rc1281-ref-text)!important">Sendungsreferenz</span><b style="color:var(--rc1281-ref-text)!important">';
  if(block.split(refOld).length-1!==1)throw new Error(file+': RC1281 Referenz-Anker nicht eindeutig');
  block=block.replace(refOld,refNew);

  const dataOld=`<div class="rc390-card"><div class="rc390-label">Sendungsdaten</div><div class="rc390-txt">Zielland: '+esc(country(sh))+'\\nAnzahl: `;
  const dataNew=`<div class="rc390-card" data-rc1281-created-date="1"><div class="rc390-label">Sendungsdaten</div><div class="rc390-txt"><b>Erstellt am: '+esc(created||'–')+'</b>\\nZielland: '+esc(country(sh))+'\\nAnzahl: `;
  if(block.split(dataOld).length-1!==1)throw new Error(file+': RC1281 Sendungsdaten-Anker nicht eindeutig');
  block=block.replace(dataOld,dataNew);

  const dncOld=`<div class="rc390-card" style="grid-column:1/-1"><div class="rc390-label">Lieferscheine / DNCs</div><div class="rc390-txt">'+esc(d.join('\\n')||'–')+'</div></div></div><div class="rc390-cover-qr`;
  const dncNew=`<div class="rc390-card rc1293-packing-slip-card" data-rc1293-packing-slip-card="1" style="grid-column:1/-1"><div class="rc390-label">Lieferscheine / DNCs</div><div class="rc390-txt rc1293-packing-slip-grid" data-rc1293-packing-slip-grid="1" style="display:grid!important;grid-template-columns:repeat(auto-fit,minmax(36mm,1fr))!important;gap:2mm!important;align-items:stretch!important">'+(d.length?d.map(function(item){return '<span class="rc1293-packing-slip" data-rc1293-packing-slip="1" style="display:flex!important;align-items:center!important;min-width:0!important;padding:1.5mm 2mm!important;border:.4mm solid #cbd5e1!important;border-radius:2mm!important;background:#fff!important;font-size:8.5pt!important;line-height:1.12!important;font-weight:750!important;overflow-wrap:anywhere!important;word-break:break-word!important;break-inside:avoid!important;page-break-inside:avoid!important">'+esc(item)+'</span>'}).join(''):'<span class="rc1293-packing-slip" data-rc1293-packing-slip="1">–</span>')+'</div></div><div class="rc390-card rc1203-cover-remark" data-rc1203-cover-remark="1" style="grid-column:1/-1;border:1mm solid #cbd5e1!important;border-left:3mm solid #e5b51d!important;background:#fffdf5!important;color:#1f2937!important;padding:3.5mm 4mm!important;min-height:18mm!important;max-height:28mm!important;overflow:hidden!important;margin-bottom:5mm!important;break-inside:avoid!important;page-break-inside:avoid!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important"><div class="rc390-label" style="font-size:9pt!important;font-weight:800!important;text-transform:uppercase!important;letter-spacing:.25mm!important;color:#1f2937!important">Bemerkung</div><div class="rc390-txt" style="font-size:10pt!important;line-height:1.18!important;font-weight:700!important;white-space:pre-wrap!important;color:#1f2937!important">'+esc(sh.remark||sh.remarks||sh.bemerkung||sh.comments||sh.comment||sh.note||sh.notes||'–')+'</div></div></div><div class="rc390-cover-qr`;
  if(block.split(dncOld).length-1!==1)throw new Error(file+': RC1281 Bemerkungs-Anker nicht eindeutig');
  block=block.replace(dncOld,dncNew);

  html=html.slice(0,start)+block+html.slice(end);

  const css='<style id="exporthub-rc1203-deckblatt-style">'+
  '#rc576DocumentStage .rc390-cover.rc1203-cover,.rc390-cover.rc1203-cover{font-size:calc(1em - 2pt)!important;box-sizing:border-box!important;border:3mm solid #334155!important;border-top-width:5mm!important;outline:0!important;background:#fff!important;background-image:none!important;color:#1f2937!important;box-shadow:inset 0 0 0 1mm #dbe4ee!important;padding:8mm!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'+
  '#rc576DocumentStage .rc390-cover.rc1203-cover .rc390-cover-ref,.rc390-cover.rc1203-cover .rc390-cover-ref{background:var(--rc1281-ref-bg)!important;border:1.2mm solid var(--rc1281-ref-border)!important;color:var(--rc1281-ref-text)!important;padding:4mm!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'+
  '.rc390-cover.rc1203-cover .rc390-cover-ref span,.rc390-cover.rc1203-cover .rc390-cover-ref b{color:var(--rc1281-ref-text)!important}'+
  '#rc576DocumentStage .rc390-cover.rc1203-cover .rc1203-cover-recipient,.rc390-cover.rc1203-cover .rc1203-cover-recipient{font-size:14pt!important;line-height:1.2!important;font-weight:750!important;padding:4mm!important;border:1mm solid var(--rc1281-recipient-border)!important;background:var(--rc1281-recipient-bg)!important;color:var(--rc1281-recipient-text)!important}'+
  '.rc390-cover.rc1203-cover .rc1203-cover-recipient strong{font-size:17pt!important;line-height:1.15!important;font-weight:800!important;color:var(--rc1281-recipient-text)!important}.rc390-cover.rc1203-cover .rc1203-cover-recipient .rc390-txt{font-size:14pt!important;line-height:1.18!important;font-weight:800!important;color:var(--rc1281-recipient-text)!important}'+
  '.rc390-cover.rc1203-cover [data-rc1281-created-date]{background:#fff!important;color:#334155!important}'+
  '.rc390-cover.rc1203-cover [data-rc1293-packing-slip-grid]{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(36mm,1fr))!important;gap:2mm!important;align-items:stretch!important}.rc390-cover.rc1203-cover [data-rc1293-packing-slip]{display:flex!important;align-items:center!important;min-width:0!important;padding:1.5mm 2mm!important;border:.4mm solid #cbd5e1!important;border-radius:2mm!important;background:#fff!important;font-size:8.5pt!important;line-height:1.12!important;font-weight:750!important;overflow-wrap:anywhere!important;word-break:break-word!important;break-inside:avoid!important;page-break-inside:avoid!important}'+
  '#rc576DocumentStage .rc390-cover.rc1203-cover .rc1203-cover-remark,.rc390-cover.rc1203-cover .rc1203-cover-remark{border:1mm solid #cbd5e1!important;border-left:3mm solid #e5b51d!important;background:#fffdf5!important;color:#1f2937!important;padding:3.5mm 4mm!important;min-height:18mm!important;max-height:28mm!important;overflow:hidden!important;margin-bottom:5mm!important;break-inside:avoid!important;page-break-inside:avoid!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'+
  '.rc390-cover.rc1203-cover .rc1203-cover-remark .rc390-label{font-size:9pt!important;font-weight:800!important;text-transform:uppercase!important;letter-spacing:.25mm!important;color:#1f2937!important}.rc390-cover.rc1203-cover .rc1203-cover-remark .rc390-txt{font-size:10pt!important;line-height:1.18!important;font-weight:700!important;white-space:pre-wrap!important;color:#1f2937!important}'+
  '</style>';
  html=injectDeferredRuntimeInHead(html,css,'exporthub-rc1203-deckblatt-style');

  if(!html.includes('data-rc1203-cover-enhanced="1"'))throw new Error(file+': RC1281 rc390-Cover-Marker fehlt');
  if(!html.includes('data-rc1281-customer-theme='))throw new Error(file+': RC1281 kundenspezifisches Deckblatt-Theme fehlt');
  if(!html.includes('data-rc1281-created-date="1"'))throw new Error(file+': RC1281 Erstellungsdatum fehlt');
  if(!html.includes('data-rc1293-packing-slip-grid="1"')||!html.includes('grid-template-columns:repeat(auto-fit,minmax(36mm,1fr))'))throw new Error(file+': RC1293 Lieferschein-Mehrzeilenraster fehlt');
  if(!html.includes('background:#fff!important'))throw new Error(file+': RC1281 weißer Deckblatt-Hintergrund fehlt');
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

function patchRc1259ContainerSearch(html,file){
  const overviewNeedle="attachmentFiles(x).join(' ')].join(' '))}";
  const overviewReplacement="attachmentFiles(x).join(' '),x&&x.sealNumber,x&&x.containerSealNumber,x&&x.siegelnummer].join(' '))}";
  const overviewCount=html.split(overviewNeedle).length-1;
  if(overviewCount<1)throw new Error(file+': RC1259 Sendungsübersicht-Suchanker fehlt');
  html=html.split(overviewNeedle).join(overviewReplacement);

  const viewNeedle="location&&location.name,location&&location.address,docs.map(function(d){return d.name+' '+d.group}).join(' ')].join(' '))}";
  const viewReplacement="location&&location.name,location&&location.address,sh&&sh.sealNumber,sh&&sh.containerSealNumber,sh&&sh.siegelnummer,docs.map(function(d){return d.name+' '+d.group}).join(' ')].join(' '))}";
  const viewCount=html.split(viewNeedle).length-1;
  if(viewCount<1)throw new Error(file+': RC1259 Sendungsansicht-Suchanker fehlt');
  html=html.split(viewNeedle).join(viewReplacement);

  html=html.replace(/Referenz, Kunde, DNC, POD oder ABD suchen/g,'Referenz, Kunde, Siegel, DNC, POD oder ABD suchen');
  html=html.replace(/Kunde, Referenz, Kundennummer oder Anhang suchen …/g,'Kunde, Referenz, Siegelnummer, Kundennummer oder Anhang suchen …');

  const subPayloadNeedle="plannedPickupDate:q(main.plannedPickupDate||main.pickupDate),subShipmentId:key";
  const subPayloadReplacement="plannedPickupDate:q(main.plannedPickupDate||main.pickupDate),transportMode:q(main.transportMode||main.transportType||main.shippingMode),containerDocumentationRequired:main.containerDocumentationRequired===true,subShipmentId:key";
  if(html.includes(subPayloadNeedle))html=html.split(subPayloadNeedle).join(subPayloadReplacement);
  return html;
}

function patchCompletePrintBundle(html,file){
  const loadStart=html.indexOf('function loadHtml(sh,withQr){');
  const loadEnd=loadStart<0?-1:html.indexOf('function documentCacheKey',loadStart);
  if(loadStart<0||loadEnd<0)throw new Error(file+': RC1345 Ladelisten-/CMR-Druckmodul fehlt');
  let loadBlock=html.slice(loadStart,loadEnd);

  loadBlock=loadBlock.replace("withQr?'1 / 1 · mit QR-Code':'ohne QR-Code'","withQr?'Ladeliste · mit QR-Code':'Ladeliste · ohne QR-Code'");
  loadBlock=loadBlock.replace("withQr?'1 / 2 · mit QR-Code':'2 / 2 · ohne QR-Code'","withQr?'Ladeliste · mit QR-Code':'Ladeliste · ohne QR-Code'");
  loadBlock=loadBlock.replace("for(var i=1;i<=4;i++){","for(var i=1;i<=3;i++){");
  loadBlock=loadBlock.replace("for(var i=1;i<=1;i++){","for(var i=1;i<=3;i++){");
  loadBlock=loadBlock.replace("CMR '+i+' / 4</div></div>'","CMR '+i+' / 3</div></div>'");
  loadBlock=loadBlock.replace("CMR '+i+' / 1</div></div>'","CMR '+i+' / 3</div></div>'");
  html=html.slice(0,loadStart)+loadBlock+html.slice(loadEnd);

  html=html.replace("+coverHtml(sh)+loadHtml(sh,true)+loadHtml(sh,false)+cmrHtml(sh)+","+coverHtml(sh)+loadHtml(sh,true)+cmrHtml(sh)+");
  html=html.replace(
    "if(mode==='load2')return[];return[d.cover,d.load1].concat(d.cmrs.slice(0,3)).filter(Boolean)",
    "if(mode==='load2')return[d.load2].filter(Boolean);return[d.cover,d.load1].concat(d.cmrs.slice(0,3)).filter(Boolean)"
  );
  html=html.replace(
    "if(mode==='load2')return[];return[d.cover,d.load1].concat(d.cmrs.slice(0,1)).filter(Boolean)",
    "if(mode==='load2')return[d.load2].filter(Boolean);return[d.cover,d.load1].concat(d.cmrs.slice(0,3)).filter(Boolean)"
  );
  html=html.replace(
    "return[d.cover,d.load1,d.load2].concat(d.cmrs.slice(0,4)).filter(Boolean)",
    "return[d.cover,d.load1].concat(d.cmrs.slice(0,3)).filter(Boolean)"
  );
  html=html.replace(
    "return[d.cover,d.load1,d.load2].concat(d.cmrs.slice(0,3)).filter(Boolean)",
    "return[d.cover,d.load1].concat(d.cmrs.slice(0,3)).filter(Boolean)"
  );

  if(!html.includes("+coverHtml(sh)+loadHtml(sh,true)+cmrHtml(sh)+"))throw new Error(file+': RC1345 Gesamtdruck muss genau eine Ladeliste enthalten');
  const rc1373SelectNeedle="if(mode==='load2')return[d.load2].filter(Boolean);return[d.cover,d.load1].concat(d.cmrs.slice(0,3)).filter(Boolean)";
  const rc1373SelectReplacement="if(mode==='cover')return[d.cover].filter(Boolean);if(mode==='load2')return[d.load2].filter(Boolean);return[d.cover,d.load1].concat(d.cmrs.slice(0,3)).filter(Boolean)";
  const rc1373SelectCount=html.split(rc1373SelectNeedle).length-1;
  if(rc1373SelectCount!==1)throw new Error(file+': RC1373 Deckblatt-Auswahl '+rc1373SelectCount+'x gefunden');
  html=html.replace(rc1373SelectNeedle,rc1373SelectReplacement);
  if(!html.includes(rc1373SelectReplacement))throw new Error(file+': RC1373 Nur-Deckblatt-Modus fehlt');
  if(!html.includes("if(mode==='load2')return[d.load2].filter(Boolean);return[d.cover,d.load1].concat(d.cmrs.slice(0,3)).filter(Boolean)"))throw new Error(file+': RC1345 Gesamtdruckauswahl 1x Ladeliste/3x CMR fehlt');
  if(!html.includes("withQr?'Ladeliste · mit QR-Code':'Ladeliste · ohne QR-Code'"))throw new Error(file+': RC1345 eindeutige Ladelisten-Beschriftung fehlt');
  if(!html.includes("for(var i=1;i<=3;i++){")||!html.includes("CMR '+i+' / 3</div></div>'"))throw new Error(file+': RC1345 CMR muss genau dreimal erzeugt werden');

  const rc1340Anchor='async function printDocuments(mode){';
  const rc1340Runtime=`
function rc1340PrintableDeliveryAttachments(sh){
 var helper=window.ExportHUBDocumentBlob1059,out=[],seen=Object.create(null),seenName=Object.create(null),keys=['deliveryFiles','deliveryNotesFiles','lieferscheine','files','attachments'];
 function legacyUrl(file){try{if(helper&&typeof helper.legacyUrl==='function')return q(helper.legacyUrl(file))}catch(_){}if(typeof file==='string')return /^(?:data:application\\/pdf|blob:|https?:)/i.test(q(file))?q(file):'';return q(file&&(file.data||file.dataUrl||file.url||file.downloadUrl||file.contentUrl||file.href||file.objectUrl||file.link))}
 function add(raw){
  if(!raw)return;var file=typeof raw==='string'?{name:q(raw),url:/^(?:data:application\\/pdf|blob:|https?:)/i.test(q(raw))?q(raw):''}:raw;if(!file||typeof file!=='object')return;
  if(/deleted|gelöscht|geloscht|replaced|ersetzt|storniert|cancelled|canceled/i.test(q(file.status)))return;
  var name=q(file.name||file.fileName||file.filename||file.number||'Dokument.pdf'),mime=low(file.contentType||file.mimeType||file.mime||file.type),blobBacked=false,blobName='',url=legacyUrl(file);
  try{blobBacked=!!(helper&&typeof helper.isBlobDocument==='function'&&helper.isBlobDocument(file));if(blobBacked&&typeof helper.blobName==='function')blobName=q(helper.blobName(file))}catch(_){blobBacked=false}
  var pdf=/application\\/pdf/i.test(mime)||/\\.pdf(?:$|[?#])/i.test(name)||/^data:application\\/pdf/i.test(url)||/\\.pdf(?:$|[?#])/i.test(url);
  if(!pdf||(!blobBacked&&!url))return;
  var nameKey=low(name).replace(/\s+/g,' '),strongId=q(file.sha256||file.hash||file.documentId||file.itemId||file.id),identity=strongId?'id:'+strongId:(blobBacked?'blob:'+blobName:(nameKey?'name:'+nameKey:(url?'url:'+url:'')));
  if(!identity||seen[identity]||(nameKey&&seenName[nameKey]))return;seen[identity]=true;if(nameKey)seenName[nameKey]=true;out.push({file:file,name:name,identity:identity,blobBacked:blobBacked,legacyUrl:url})
 }
 keys.forEach(function(key){arr(sh&&sh[key]).forEach(add)});return out
}
async function rc1340PrepareDeliveryAttachmentPrints(sh){
 var helper=window.ExportHUBDocumentBlob1059,list=rc1340PrintableDeliveryAttachments(sh),prepared=[];
 try{
  for(var i=0;i<list.length;i++){var item=list[i],url=item.legacyUrl,owned=false;
   if(item.blobBacked){if(!helper||typeof helper.fetchBlob!=='function')throw new Error('Dokumentenspeicher ist nicht verfügbar: '+item.name);var blob=await helper.fetchBlob(item.file);url=URL.createObjectURL(blob);owned=true}
   else if(/^data:application\\/pdf/i.test(url)){var dataResponse=await fetch(url);if(!dataResponse.ok)throw new Error(item.name+' konnte nicht aus dem lokalen PDF-Inhalt geladen werden.');var dataBlob=await dataResponse.blob();url=URL.createObjectURL(dataBlob);owned=true}
   else if(url&&!/^blob:/i.test(url)){var response=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error(item.name+' konnte nicht geladen werden (HTTP '+response.status+').');var fetched=await response.blob();url=URL.createObjectURL(fetched);owned=true}
   if(!url)throw new Error('Kein druckbarer Dateiinhalt für '+item.name+'.');
   prepared.push({name:item.name,identity:item.identity,url:url,owned:owned})
  }
  return prepared
 }catch(e){prepared.forEach(function(item){if(item.owned)try{URL.revokeObjectURL(item.url)}catch(_){}});throw e}
}
async function rc1340PrintPreparedAttachment(item,index,total){
 if(typeof window.__EXPORTHUB_CAPTURE_ATTACHMENT_PRINT__==='function'){await Promise.resolve(window.__EXPORTHUB_CAPTURE_ATTACHMENT_PRINT__({name:item.name,index:index,total:total,identity:item.identity,url:item.url,transport:'capture'}));return true}
 return new Promise(function(resolve,reject){var frame=document.createElement('iframe'),done=false,timer;
  function finish(error){if(done)return;done=true;try{clearTimeout(timer)}catch(_){};try{frame.remove()}catch(_){};if(error)reject(error);else resolve(true)}
  function dispatchPrint(){
   try{
    if(!frame.contentWindow)throw new Error('PDF-Druckfenster fehlt.');
    frame.focus();
    var ua=String(navigator&&navigator.userAgent||''),chromium=/(?:Chrome|Chromium|Edg)\\//.test(ua);
    if(chromium){
     frame.contentWindow.postMessage({type:'print'},'*');
    }else{
     frame.contentWindow.postMessage({type:'print'},'*');
    }
    later(function(){finish()},600)
   }catch(e){finish(e)}
  }
  frame.setAttribute('aria-hidden','true');frame.setAttribute('data-rc1340-attachment-print',String(index+1));frame.setAttribute('data-rc1354-pdf-print-bridge','1');frame.style.cssText='position:fixed;left:-100000px;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
  frame.onload=function(){later(dispatchPrint,350)};
  frame.onerror=function(){finish(new Error('PDF konnte nicht für den Druck geladen werden: '+item.name))};
  timer=later(function(){finish(new Error('Zeitüberschreitung beim PDF-Druck: '+item.name))},15000);document.body.appendChild(frame);frame.src=item.url
 })
}
async function rc1340PrintPreparedAttachments(items){
 items=arr(items);try{for(var i=0;i<items.length;i++)await rc1340PrintPreparedAttachment(items[i],i,items.length);return items.length}
 finally{items.forEach(function(item){if(item&&item.owned)try{URL.revokeObjectURL(item.url)}catch(_){}})}
}
window.ExportHUBRC1340AttachmentPrint=Object.freeze({version:'RC1340',printable:rc1340PrintableDeliveryAttachments,prepare:rc1340PrepareDeliveryAttachmentPrints,printPrepared:rc1340PrintPreparedAttachments,printShipment:async function(sh){var jobs=await rc1340PrepareDeliveryAttachmentPrints(sh);return rc1340PrintPreparedAttachments(jobs)}});
`;
  if(!html.includes('window.ExportHUBRC1340AttachmentPrint=')){
    const count=html.split(rc1340Anchor).length-1;
    if(count!==1)throw new Error(file+': RC1340 Druckanker '+count+'x gefunden');
    const rc1373PrintEntry="async function printDocuments(mode){var rc1373Override=String(window.__EXPORTHUB_PRINT_MODE_OVERRIDE__||'').trim().toLowerCase();if(rc1373Override){mode=rc1373Override;window.__EXPORTHUB_PRINT_MODE_OVERRIDE__=''}";
    html=html.replace(rc1340Anchor,rc1340Runtime+'\n'+rc1373PrintEntry);
  }
  const readyOld="await ensureOutputReady(sh,'normal');docWorkStep(opToken,'Druckseiten werden geöffnet …');";
  const readyNew="await ensureOutputReady(sh,'normal');var attachmentJobs=(mode==='all'||!mode)?await rc1340PrepareDeliveryAttachmentPrints(sh):[];docWorkStep(opToken,'Druckseiten werden geöffnet …');";
  if(!html.includes(readyNew)){
    if(!html.includes(readyOld))throw new Error(file+': RC1340 Output-Ready-Anker fehlt');
    html=html.replace(readyOld,readyNew);
  }
  const printOld="window.__INDEX352_LAST_PRINT__={ok:true,mode:mode||'all',pages:root.children.length,ref:sref(sh)||sid(sh),owner:VERSION,signed:false};docWorkDone(opToken,'Druckdialog wird geöffnet');frame.contentWindow.focus();frame.contentWindow.print()";
  const printNew="frame.contentWindow.focus();frame.contentWindow.print();if(attachmentJobs.length){docWorkStep(opToken,'Lieferscheine werden gedruckt …');await rc1340PrintPreparedAttachments(attachmentJobs)}window.__INDEX352_LAST_PRINT__={ok:true,mode:mode||'all',pages:root.children.length,attachmentCount:attachmentJobs.length,attachmentNames:attachmentJobs.map(function(item){return item.name}),ref:sref(sh)||sid(sh),owner:VERSION,signed:false};docWorkDone(opToken,attachmentJobs.length?'Gesamtdruck vollständig gestartet':'Druckdialog wird geöffnet')";
  if(!html.includes(printNew)){
    if(!html.includes(printOld))throw new Error(file+': RC1340 Druckabschluss-Anker fehlt');
    html=html.replace(printOld,printNew);
  }
  if(!html.includes("version:'RC1340'")||!html.includes('attachmentCount:attachmentJobs.length')||!html.includes('await rc1340PrintPreparedAttachments(attachmentJobs)'))throw new Error(file+': RC1340 Lieferschein-Direktdruck fehlt');
  if(!html.includes("__EXPORTHUB_PRINT_MODE_OVERRIDE__")||!html.includes("if(mode==='cover')return[d.cover].filter(Boolean)"))throw new Error(file+': RC1373 Nur-Deckblatt-Druck ist nicht im finalen Print-Pfad verankert');
  if(!html.includes("data-rc1354-pdf-print-bridge")||!html.includes("frame.contentWindow.postMessage({type:'print'},'*')"))throw new Error(file+': RC1354 PDF-Druckbrücke fehlt');
  var rc1355BridgeStart=html.indexOf('async function rc1340PrintPreparedAttachment(item,index,total){'),rc1355BridgeEnd=rc1355BridgeStart<0?-1:html.indexOf('async function rc1340PrintPreparedAttachments(items){',rc1355BridgeStart);
  if(rc1355BridgeStart<0||rc1355BridgeEnd<0||html.slice(rc1355BridgeStart,rc1355BridgeEnd).includes('frame.contentWindow.print()'))throw new Error(file+': RC1355 Cross-Origin PDF-Druckzugriff ist noch aktiv');
  return html;
}

function patchRc1324PrintScale(html,file){
  const loadStart=html.indexOf('function loadHtml(sh,withQr){');
  const loadEnd=loadStart<0?-1:html.indexOf('function documentCacheKey',loadStart);
  if(loadStart<0||loadEnd<0)throw new Error(file+': RC1324 Ladeliste fehlt');
  let block=html.slice(loadStart,loadEnd);
  block=block.replace('<section class="rc390-load">','<section class="rc390-load rc1324-load-compact" style="font-size:calc(1em - 1pt)!important">');
  html=html.slice(0,loadStart)+block+html.slice(loadEnd);
  return html;
}

function patchRc1305LoadingListPresentation(html,file){
  const loadStart=html.indexOf('function loadHtml(sh,withQr){');
  const loadEnd=loadStart<0?-1:html.indexOf('function documentCacheKey',loadStart);
  if(loadStart<0||loadEnd<0)throw new Error(file+': RC1305 Ladelisten-Renderer fehlt');
  if(!html.includes('__EXPORTHUB_RC1305_LOAD_HTML_WRAPPED__')){
    const wrapper=[
      "var rc1305LoadHtmlOriginal=loadHtml;",
      "loadHtml=function(sh,withQr){var out=rc1305LoadHtmlOriginal(sh,withQr);try{var api=window.ExportHUBRC1305LoadingListPrint;if(api&&typeof api.enhance==='function')return api.enhance(out,sh||{},withQr===true)}catch(e){try{console.warn('RC1305 Ladelisten-Enhancer',e)}catch(_){}}return out};",
      "var rc1316CoverHtmlOriginal=coverHtml;",
      "coverHtml=function(sh){var out=rc1316CoverHtmlOriginal(sh);try{var api=window.ExportHUBRC1305LoadingListPrint;if(api&&typeof api.enhanceCover==='function')return api.enhanceCover(out,sh||{})}catch(e){try{console.warn('RC1316 Deckblatt-Enhancer',e)}catch(_){}}return out};",
      "window.__EXPORTHUB_RC1305_LOAD_HTML_WRAPPED__=true;"
    ].join('\n')+'\n';
    html=html.slice(0,loadEnd)+wrapper+html.slice(loadEnd);
  }
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1305-loading-list-print" defer src="/assets/rc1305-loading-list-print.js?v=1379"></script>','exporthub-rc1305-loading-list-print');
  if(!html.includes('__EXPORTHUB_RC1305_LOAD_HTML_WRAPPED__'))throw new Error(file+': RC1305 interner Ladelisten-Renderer ist nicht angebunden');
  if(!html.includes('assets/rc1305-loading-list-print.js?v=1379'))throw new Error(file+': RC1305 Ladelisten-Druckruntime fehlt');
  return html;
}

function patchRc1305ShipmentViewReliability(html,file){
  function replaceBlock(start,end,replacement,label){
    const a=html.indexOf(start),b=a<0?-1:html.indexOf(end,a+start.length);
    if(a<0||b<0)throw new Error(file+': RC1305 '+label+'-Anker fehlt');
    html=html.slice(0,a)+replacement+html.slice(b);
  }

  const historyReplacement=`/* exporthub-rc1305-shipment-view-reliability */
function historyHtml(sh){
 var list=[],seen={},raw=arr(sh&&sh.statusHistory);
 function add(at,label,detail,key){
  at=q(at);label=q(label);detail=q(detail);if(!label)return;
  var unique=q(key)||low(label)+'|'+at+'|'+low(detail);if(seen[unique])return;seen[unique]=1;
  list.push({at:at,label:label,detail:detail,stamp:Date.parse(at)||0,key:unique})
 }
 raw.forEach(function(row){var h=historyItem(row);if(h)add(h.at,h.label,h.detail,'status|'+h.key+'|'+q(h.at))});
 var created=q(sh&&(sh.createdAt||sh.created||sh.savedAt)),creator=q(sh&&(sh.createdByName||sh.createdBy||sh.creatorName||sh.creator||sh.owner));
 if(created&&!list.some(function(x){return /erstellt|created/i.test(x.label)}))add(created,'Sendung erstellt',creator,'created');
 function pickupRows(rows,prefix){
  arr(rows).forEach(function(p,i){
   var at=q(p&&(p.confirmedAt||p.signatureStoredAt||p.pickedUpAt||p.actualPickupAt));if(!at)return;
   var who=q(p.loaderName||p.driverName),plate=q(p.licensePlate||p.plate),colli=Number(p.colliCount||p.colli);
   var detail=[who,plate?('Kennzeichen '+plate):'',Number.isFinite(colli)&&colli>0?(colli+' Colli'):''].filter(Boolean).join(' · ');
   add(at,p.complete===false?'Teilabholung bestätigt':'Abgeholt',detail,'pickup|'+prefix+'|'+q(p.id||at||i))
  })
 }
 pickupRows(sh&&sh.pickupHistory,'main');
 arr(sh&&sh.subShipments).forEach(function(sub,i){pickupRows(sub&&sub.pickupHistory,'sub'+i)});
 var picked=q(sh&&(sh.actualPickupDate||sh.pickedUpAtDate||sh.pickedUpAt||sh.pickupConfirmedAt||sh.actualPickupAt||sh.collectedAt));
 if(picked&&!list.some(function(x){return /abgeholt|abholung bestätigt/i.test(x.label)}))add(picked,'Abgeholt',q(sh.loader||sh.loadedBy||sh.verlader),'picked|'+picked);
 var podAt=q(sh&&(sh.podUploadedAt||sh.podServerVerifiedAt||sh.podConfirmedAt));
 if(podAt)add(podAt,'POD vorhanden','Abliefernachweis gespeichert','pod|'+podAt);
 var completedAt=q(sh&&sh.completedAt),archivedAt=q(sh&&sh.archivedAt);
 if(completedAt)add(completedAt,'Abgeschlossen',q(sh.completedBy),'completed|'+completedAt);
 if(archivedAt)add(archivedAt,'Archiviert',q(sh.archivedBy),'archived|'+archivedAt);
 var current=status(sh),currentAt=q(sh&&(sh.statusChangedAt||sh.statusUpdatedAt||sh.updatedAt||sh._syncUpdatedAt));
 if(current&&!list.some(function(x){return low(x.label).indexOf(low(current))>=0}))add(currentAt,'Aktueller Status: '+current,'','current|'+low(current));
 list.sort(function(a,b){var aa=a.stamp||Number.MAX_SAFE_INTEGER,bb=b.stamp||Number.MAX_SAFE_INTEGER;return aa-bb});
 if(!list.length)return '<div class="rc776-empty">Für diese Sendung sind noch keine fachlichen Bewegungsdaten gespeichert.</div>';
 return '<div class="rc776-history">'+list.slice(-30).map(function(x){return '<div class="rc776-history-row"><time>'+esc(x.at?fmtDate(x.at):'–')+'</time><div><b>'+esc(x.label)+'</b>'+(x.detail?'<small> · '+esc(x.detail)+'</small>':'')+'</div></div>'}).join('')+'</div>'
}
`;
  replaceBlock('function historyHtml(sh){','\n\nvar referenceCache=',historyReplacement,'Statusverlauf');

  const docHelpers=`function fallbackDocUsable(d){
 if(!d)return false;
 if(d.source==='referenceFolder'&&d.itemId)return true;
 if(d.url)return true;
 var helper=window.ExportHUBDocumentBlob1059,f=d.file;
 try{return !!(helper&&f&&typeof helper.isBlobDocument==='function'&&helper.isBlobDocument(f))}catch(_){return false}
}
function mergeReferenceDocs(live,fallback){
 var out=arr(live).slice(),seen={};out.forEach(function(d){seen[low(q(d&&d.name))]=1});
 arr(fallback).filter(fallbackDocUsable).forEach(function(d){var key=low(q(d&&d.name));if(key&&seen[key])return;if(key)seen[key]=1;out.push(d)});
 return out
}
`;
  const normalizeAnchor='function normalizeFallback(d){';
  const normalizePos=html.indexOf(normalizeAnchor);
  if(normalizePos<0)throw new Error(file+': RC1305 Dokument-Fallback-Anker fehlt');
  html=html.slice(0,normalizePos)+docHelpers+html.slice(normalizePos);

  replaceBlock(
    'function docHtml(d,i){',
    '\nfunction docsPanelHtml',
    `function docHtml(d,i){var usable=fallbackDocUsable(d),buttons=[];if(usable){buttons.push('<button type="button" class="ghost" data-rc786-open-file="'+i+'">Öffnen</button>');buttons.push('<button type="button" class="ghost" data-rc786-download-file="'+i+'">Download</button>');if(isPrintable(d))buttons.push('<button type="button" class="ghost" data-rc786-print-file="'+i+'">Drucken</button>')}return '<article class="rc786-doc-row"><div class="rc786-doc-icon" aria-hidden="true">'+docIcon(d)+'</div><div class="rc786-doc-main"><b>'+esc(d.name||'Dokument')+'</b><small>'+esc(docMeta(d))+'</small></div><div class="rc786-doc-actions">'+buttons.join('')+'</div></article>'}
`,
    'Dokumentaktionen'
  );

  replaceBlock(
    'function docsPanelHtml(docs,source,error){',
    '\nfunction setDocsPanel',
    `function docsPanelHtml(docs,source,error){docs=arr(docs);var sourceText=source==='referenceFolder'?'Vorhandene Dateien direkt aus dem Ref-Ordner der Sendung':source==='combined'?'Ref-Ordner und gespeicherte Anhänge der Sendung':source==='fallback'?'Gespeicherte Anhänge der Sendung':'';var note=sourceText?'<div class="rc786-doc-source">'+esc(sourceText)+(error?' · Ref-Ordner derzeit nicht erreichbar':'')+'</div>':'';var body=docs.length?'<div class="rc776-docs">'+docs.map(docHtml).join('')+'</div>':'<div class="rc776-empty">'+(source==='referenceFolder'?'Im Ref-Ordner und im Sendungsdatensatz sind aktuell keine öffnungsfähigen Dateien vorhanden.':'Keine echte Datei verfügbar. Interne Erzeugungsmetadaten werden nicht als Datei angezeigt.')+'</div>';return note+body}
`,
    'Dokumentpanel'
  );

  replaceBlock(
    'async function loadReferenceDocs(sh,fallback){',
    '\n\nfunction shipmentSearchStamp',
    `async function loadReferenceDocs(sh,fallback){var ref=refOf(sh),expected=idOf(sh)||ref;fallback=arr(fallback).filter(fallbackDocUsable);if(!ref)return setDocsPanel(fallback,'fallback',true);try{var data=await referenceList(ref,false);if(data&&data.available===false){setDocsPanel(fallback,'fallback',true);return false}var live=arr(data.files).map(function(x){return liveDoc(x,ref)}),merged=mergeReferenceDocs(live,fallback),source=live.length?(merged.length>live.length?'combined':'referenceFolder'):(fallback.length?'fallback':'referenceFolder');var current=find(state().shipmentViewId||state().selectedShipmentId||state().activeShipmentId);if(low(state().view)!=='shipmentview'||!current||(idOf(current)||refOf(current))!==expected)return false;setDocsPanel(merged,source,false)}catch(e){if(!(e&&e.code==='GRAPH_NOT_CONFIGURED'))console.warn('RC1305 Ref-Ordner',e);var current2=find(state().shipmentViewId||state().selectedShipmentId||state().activeShipmentId);if(low(state().view)==='shipmentview'&&current2&&(idOf(current2)||refOf(current2))===expected)setDocsPanel(fallback,'fallback',true)}return false}
`,
    'Ref-Ordner-Fallback'
  );

  replaceBlock(
    'async function fetchDocBlob(d){',
    '\nasync function downloadDocObject',
    `async function fetchDocBlob(d){if(!d)throw new Error('Datei fehlt.');if(d._blob instanceof Blob)return d._blob;var helper=window.ExportHUBDocumentBlob1059;if(d.file&&helper&&typeof helper.isBlobDocument==='function'&&helper.isBlobDocument(d.file)&&typeof helper.fetchBlob==='function')return await helper.fetchBlob(d.file);if(d.source==='referenceFolder'&&d.itemId){var ref=q(d.reference)||refOf(currentShipmentForDocs()),res=await fetch('/api/reference-files?reference='+encodeURIComponent(ref)+'&itemId='+encodeURIComponent(d.itemId)+'&mode=inline&_='+Date.now(),{method:'GET',headers:referenceHeaders(),credentials:'same-origin',cache:'no-store'});if(!res.ok){var message='Datei konnte nicht geöffnet werden.';try{var data=await res.json();message=q(data.message)||message}catch(_){}throw new Error(message)}return await res.blob()}var url=q(d.url),urlLower=low(url),localApi=url.indexOf('/api/')===0;if(url&&(urlLower.indexOf('data:')===0||urlLower.indexOf('blob:')===0||localApi)){var r=await fetch(url,{headers:localApi?referenceHeaders():{},credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error('Datei konnte nicht geladen werden.');return await r.blob()}return null}
`,
    'Blob-Dokumentöffnung'
  );

  const oldNote='<p class="rc808-history-note">Nur tatsächliche Statuswechsel der Sendung. Technische RC543-Synchronisierungstexte werden nicht angezeigt.</p>';
  const newNote='<p class="rc808-history-note">Fachliche Bewegung der Sendung: Status, Abholung, POD und Abschluss. Technische Synchronisierung wird ausgeblendet.</p>';
  if(!html.includes(oldNote)&&!html.includes(newNote))throw new Error(file+': RC1305 Statushinweis-Anker fehlt');
  html=html.replace(oldNote,newNote);

  const oldDocs="Vorhandene Originaldateien · Ref-Ordner '+esc(ref)+'";
  const newDocs="Ref-Ordner + gespeicherte Anhänge · Referenz '+esc(ref)+'";
  if(html.includes(oldDocs))html=html.replace(oldDocs,newDocs);

  if(!html.includes('exporthub-rc1305-shipment-view-reliability'))throw new Error(file+': RC1305 Marker fehlt');
  if(!html.includes('mergeReferenceDocs(live,fallback)'))throw new Error(file+': RC1305 Ref-Datei-Merge fehlt');
  if(!html.includes("'Abgeholt'"))throw new Error(file+': RC1305 Abholbewegung fehlt');
  return html;
}

function patchRc1283LoadingListSearch(html,file){
  const anchor="async function downloadDocument(mode,button){";
  const bridge=`window.__EXPORTHUB_RC1283_OPEN_LOAD1__=function(sh,printNow){try{if(!sh)throw new Error('Keine Ladeliste ausgewählt.');var child=window.open('about:blank','_blank','width=1180,height=860');if(!child){alert('Das Ladelistenfenster wurde vom Browser blockiert.');return false}var styles=Array.from(document.querySelectorAll('style,link[rel="stylesheet"]')).map(function(n){return n.outerHTML}).join(''),body=loadHtml(sh,true),title='Ladeliste '+esc(sref(sh)||sid(sh));child.opener=null;child.document.open();child.document.write('<!doctype html><html lang="de"><head><meta charset="utf-8"><title>'+title+'</title>'+styles+'<style>@page{size:A4 portrait;margin:8mm}html,body{background:#fff!important}body{margin:0;padding:0}.rc390-page,.rc352-page{margin:0 auto!important;box-shadow:none!important}</style></head><body>'+body+'</body></html>');child.document.close();if(printNow){var run=function(){try{child.focus();child.print()}catch(e){console.error('RC1283 Ladeliste drucken',e)}};if(child.document.readyState==='complete')setTimeout(run,250);else child.addEventListener('load',function(){setTimeout(run,200)},{once:true})}return true}catch(e){console.error('RC1283 Ladeliste öffnen/drucken',e);alert('Ladeliste konnte nicht geöffnet werden: '+String(e&&e.message||e));return false}}\nwindow.__EXPORTHUB_RC1283_DOWNLOAD_LOAD1__=async function(sh){try{if(!sh)throw new Error('Keine Ladeliste ausgewählt.');var out=await createPdf('load1',sh),name=('Ladeliste_'+(sref(sh)||sid(sh)||'Sendung')+'.pdf').replace(/[^A-Za-z0-9._-]+/g,'_');downloadBlob(out.blob,name);return true}catch(e){console.error('RC1283 Ladeliste herunterladen',e);alert('Ladeliste konnte nicht heruntergeladen werden: '+String(e&&e.message||e));return false}}`;
  const count=html.split(anchor).length-1;
  if(!html.includes('__EXPORTHUB_RC1283_OPEN_LOAD1__')){
    if(count!==1)throw new Error(file+': RC1283 Ladelisten-Druckanker '+count+'x gefunden');
    html=html.replace(anchor,bridge+'\n'+anchor);
  }
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1283-loading-list-search" defer src="/assets/rc1283-loading-list-search.js?v=1305"></script>','exporthub-rc1283-loading-list-search');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1315-loading-list-quick-print" defer src="/assets/rc1315-loading-list-quick-print.js?v=1322"></script>','exporthub-rc1315-loading-list-quick-print');
  if(!html.includes('__EXPORTHUB_RC1283_OPEN_LOAD1__'))throw new Error(file+': RC1283 Ladelisten-Öffnen/Drucken-Bridge fehlt');
  if(!html.includes('__EXPORTHUB_RC1283_DOWNLOAD_LOAD1__'))throw new Error(file+': RC1283 Ladelisten-Download-Bridge fehlt');
  if(!html.includes('assets/rc1283-loading-list-search.js?v=1305'))throw new Error(file+': RC1283 Ladelisten-Suche fehlt');
  if(!html.includes('assets/rc1315-loading-list-quick-print.js?v=1322'))throw new Error(file+': RC1315 QR-/REF-Schnelldruck fehlt');
  return html;
}

function patchRc1319ShipmentSaveFinalization(html,file){
  const replacements=[
    [
      "if(!q(saved.status))saved.status='Entwurf';",
      "if(!q(saved.status)||/^entwurf$/i.test(q(saved.status))){saved.status='Erstellt';saved.processStatus='Erstellt'}",
      'Persistierter Entwurf wird nicht auf Erstellt gesetzt'
    ],
    [
      "function recalc(sh){try{if(window.ExportHUBRC543&&typeof window.ExportHUBRC543.recalculateShipmentStatus==='function')window.ExportHUBRC543.recalculateShipmentStatus(sh)}catch(e){console.error('RC565 Status',e)}}",
      "function recalc(sh){try{if(window.ExportHUBRC543&&typeof window.ExportHUBRC543.recalculateShipmentStatus==='function')window.ExportHUBRC543.recalculateShipmentStatus(sh)}catch(e){console.error('RC565 Status',e)}return q(sh&&(sh.status||sh.processStatus))}",
      'Statusberechnung liefert keinen kanonischen Status zurück'
    ],
    [
      "detail:{id:id,reference:saved.ref,updated:!!existing,azureSaved:true}",
      "detail:{id:id,reference:saved.ref,updated:!!existing,azureSaved:true,shipment:saved}",
      'Save-Event übergibt die persistierte Sendung nicht an QR-Registrierung'
    ]
  ];
  for(const [before,after,label] of replacements){
    if(html.includes(after))continue;
    const count=html.split(before).length-1;
    if(count!==1)throw new Error(file+': RC1319 '+label+' · Anker '+count+'x gefunden');
    html=html.replace(before,after);
  }
  if(html.includes("if(!q(saved.status))saved.status='Entwurf';"))throw new Error(file+': RC1319 Entwurf-Regression ist noch aktiv');
  if(!html.includes("saved.status='Erstellt';saved.processStatus='Erstellt'"))throw new Error(file+': RC1319 Erstellt-Status fehlt');
  if(!html.includes("return q(sh&&(sh.status||sh.processStatus))"))throw new Error(file+': RC1319 Status-Rückgabe fehlt');
  if(!html.includes("azureSaved:true,shipment:saved"))throw new Error(file+': RC1319 Save-Event ohne Sendungsobjekt');
  return html;
}

const RC1329_MULTI_TRUCK_RENDERER="function renderRc1017SubShipments(result){\n var main=shipment(),card=document.getElementById('rc380StowPlan'),count=Math.max(1,num(result&&result.requiredTruckCount||main.requiredTruckCount||1)),subs=arr(result&&result.subShipments&&result.subShipments.length?result.subShipments:main.subShipments),existing=card&&card.querySelector('#rc1017-subshipments');if(existing)existing.remove();\n if(card){card.setAttribute('data-rc1017-truck-count',String(count));card.setAttribute('data-rc1017-multi-truck',count>1?'1':'0')}if(!card||count<=1||subs.length<2)return count;\n var renderMain=main&&typeof main==='object'?Object.assign({},main):{};renderMain.subShipments=subs;\n var picked=subs.filter(rc1017SubPicked).length,section=document.createElement('section');section.id='rc1017-subshipments';section.setAttribute('data-rc1329-multi-truck-rendered','1');section.style.cssText='margin-top:16px;padding-top:16px;border-top:2px solid #dbeafe';section.innerHTML='<div style=\"display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap\"><div><span class=\"pill blue\">'+count+' LKW erforderlich</span><h3 style=\"margin:7px 0 3px\">Teilsendungen</h3><div class=\"muted\">Jeder LKW hat einen eigenen QR-Code, eine eigene Ladeliste und einen eigenen Stauplan.</div></div><span class=\"pill gray\">'+picked+' von '+subs.length+' abgeholt</span></div><div style=\"display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px;margin-top:12px\">'+subs.map(function(sub){var sequence=rc1017SubSequence(sub),total=rc1017SubTotal(renderMain,sub),label='Sendung '+sequence+' von '+total,metrics=rc1017SubMetrics(renderMain,sub),runtime=rc1017SubShipmentQrRuntime[q(sub.subShipmentId)],started=rc1017SubStarted(sub),pickedUp=rc1017SubPicked(sub),qr='',temp=null;if(runtime&&q(runtime.token)&&window.ExportHUBPickupPOD&&typeof window.ExportHUBPickupPOD.qrMarkup==='function'){try{temp=rc1017SubShipmentDocumentShipment(renderMain,sub.subShipmentId);qr=window.ExportHUBPickupPOD.qrMarkup(temp)||''}catch(_){qr=''}}var status=pickedUp?'Abgeholt':started?'Teilweise abgeholt':'Offen',statusClass=pickedUp?'green':started?'orange':'gray',qrBlocked=started&&!runtime;return '<article data-rc1017-subshipment=\"'+esc(sub.subShipmentId)+'\" style=\"border:1px solid #cbd5e1;border-radius:14px;padding:12px;background:#fff\"><div style=\"display:flex;justify-content:space-between;gap:8px;align-items:flex-start\"><div><b>'+esc(label)+'</b><div class=\"muted\">'+metrics.colli+' Collis · '+metrics.weight.toLocaleString('de-DE',{maximumFractionDigits:1})+' kg · '+metrics.ldm.toLocaleString('de-DE',{maximumFractionDigits:2})+' LDM</div></div><span class=\"pill '+statusClass+'\">'+status+'</span></div><div data-rc1017-qr-preview=\"'+esc(sub.subShipmentId)+'\" style=\"margin-top:8px\">'+qr+'</div><div class=\"toolbar\" style=\"margin-top:10px\"><button type=\"button\" class=\"ghost\" data-action=\"rc1017-qr-subshipment\" data-subshipment-id=\"'+esc(sub.subShipmentId)+'\" '+(qrBlocked?'disabled title=\"QR ist nach begonnener Abholung gesperrt\"':'')+'>'+((runtime&&q(runtime.token))?'QR anzeigen':'QR-Code')+'</button><button type=\"button\" class=\"ghost\" data-action=\"rc1017-print-subshipment\" data-subshipment-id=\"'+esc(sub.subShipmentId)+'\" '+(qrBlocked?'disabled title=\"Aktiver QR kann nach begonnener Abholung nicht neu erzeugt werden\"':'')+'>Ladeliste</button><button type=\"button\" class=\"ghost\" data-action=\"rc1017-stow-subshipment\" data-subshipment-id=\"'+esc(sub.subShipmentId)+'\">Stauplan</button></div></article>'}).join('')+'</div>';\n section.addEventListener('click',function(event){var button=event.target&&event.target.closest&&event.target.closest('button[data-action][data-subshipment-id]');if(!button||!section.contains(button)||button.disabled)return;var action=button.getAttribute('data-action'),id=button.getAttribute('data-subshipment-id');if(action==='rc1017-qr-subshipment'){rc1017ActivateSubShipmentQr(id,button);return}if(action==='rc1017-print-subshipment'){rc1017PrintSubShipment(id,button);return}if(action==='rc1017-stow-subshipment'){rc1017PrintSubShipmentStow(id);return}});card.appendChild(section);return count\n}";

function patchRc1329MultiTruckRenderer(html,file){
  const startMarker='function renderRc1017SubShipments(result){';
  const nextMarker='function rc1017SyncSubShipments(target){';
  const start=html.indexOf(startMarker),end=html.indexOf(nextMarker,start);
  if(start<0||end<=start)throw new Error(file+': RC1329 Mehr-LKW-Renderer-Anker fehlt');
  for(const required of [
    'var rc1017SubShipmentQrRuntime=Object.create(null);',
    'function rc1017SubSequence(',
    'function rc1017SubTotal(',
    'function rc1017SubMetrics(',
    'function rc1017SubStarted(',
    'function rc1017SubPicked(',
    'function rc1017ActivateSubShipmentQr(',
    'function rc1017PrintSubShipment(',
    'function rc1017PrintSubShipmentStow('
  ])if(!html.includes(required))throw new Error(file+': RC1329 Mehr-LKW-Helfer fehlt: '+required);
  html=html.slice(0,start)+RC1329_MULTI_TRUCK_RENDERER+'\n'+html.slice(end);
  const renderer=html.slice(start,html.indexOf(nextMarker,start));
  for(const required of [
    "section.id='rc1017-subshipments'",
    'data-rc1017-subshipment',
    'data-action="rc1017-qr-subshipment"',
    'data-action="rc1017-print-subshipment"',
    'data-action="rc1017-stow-subshipment"',
    'card.appendChild(section)'
  ])if(!renderer.includes(required))throw new Error(file+': RC1329 vollständiger Mehr-LKW-Renderer fehlt: '+required);
  return html;
}
function patchRc1337MultiTruckCloneIsolation(html,file){
  const startMarker='var rc1017SubShipmentQrRuntime=Object.create(null);';
  const endMarker='function rc1017SyncSubShipments(target){';
  const start=html.indexOf(startMarker),end=html.indexOf(endMarker,start);
  if(start<0||end<=start)throw new Error(file+': RC1337 Mehr-LKW-Helferblock fehlt');
  let block=html.slice(start,end);
  const helper="function rc1017Clone(value){if(value==null)return value;try{return JSON.parse(JSON.stringify(value))}catch(_){if(Array.isArray(value))return value.slice();if(typeof value==='object')return Object.assign({},value);return value}}\n";
  if(!block.includes('function rc1017Clone('))block=block.replace(startMarker,startMarker+'\n'+helper);
  block=block.replace(/\bcopy\s*\(/g,'rc1017Clone(');
  if(/\bcopy\s*\(/.test(block))throw new Error(file+': RC1337 globale copy()-Abhängigkeit ist im Mehr-LKW-Block noch aktiv');
  if(!block.includes('function rc1017Clone('))throw new Error(file+': RC1337 lokaler Clone-Helper fehlt');
  html=html.slice(0,start)+block+html.slice(end);
  return html;
}

function patchRc1331MultiTruckSaveIsolation(html,file){
  const syncStartMarker='function rc1017SyncSubShipments(target){';
  const syncEndMarker='window.rc1017SyncSubShipments=rc1017SyncSubShipments;';
  const start=html.indexOf(syncStartMarker),end=html.indexOf(syncEndMarker,start);
  if(start<0||end<=start)throw new Error(file+': RC1331 Mehr-LKW-Sync-Anker fehlt');
  const helper="function rc1331RenderRc1017SubShipmentsSafe(result){try{return renderRc1017SubShipments(result)}catch(e){console.error('RC1331 Mehr-LKW UI-Render',e);return 0}}\n";
  if(!html.includes('function rc1331RenderRc1017SubShipmentsSafe('))html=html.slice(0,start)+helper+html.slice(start);
  const syncStart=html.indexOf(syncStartMarker),syncEnd=html.indexOf(syncEndMarker,syncStart);
  let block=html.slice(syncStart,syncEnd);
  const direct=(block.match(/renderRc1017SubShipments\(/g)||[]).length;
  if(direct<1)throw new Error(file+': RC1331 direkter Mehr-LKW-Render-Aufruf fehlt');
  block=block.replace(/renderRc1017SubShipments\(/g,'rc1331RenderRc1017SubShipmentsSafe(');
  html=html.slice(0,syncStart)+block+html.slice(syncEnd);
  const patched=html.slice(html.indexOf(syncStartMarker),html.indexOf(syncEndMarker,html.indexOf(syncStartMarker)));
  if(/(^|[^A-Za-z0-9_])renderRc1017SubShipments\(/.test(patched))throw new Error(file+': RC1331 direkter UI-Render kann Save weiterhin abbrechen');
  if(!patched.includes('rc1331RenderRc1017SubShipmentsSafe('))throw new Error(file+': RC1331 Save-isolierter Renderer fehlt');
  return html;
}
function patchHtml(file){
  const target=path.join(OUT,file);
  let html=fs.readFileSync(target,'utf8');
  html=patchRc1289AuthTransportFallback(html,file);
  html=patchRc1304ThemeRedesign(html,file);
  html=patchRc1306LayoutEngine(html,file);
  html=patchRc1329MultiTruckUiRuntime(html,file);
  html=patchRc1328MultiTruckRefresh(html,file);
  html=patchRc1329MultiTruckRenderer(html,file);
  html=patchRc1331MultiTruckSaveIsolation(html,file);
  html=patchRc1337MultiTruckCloneIsolation(html,file);
  html=patchRc1303LoginExperience(html,file);
  html=patchDemoTestPortalIsolation(html,file);
  html=patchAuthSessionTimeout(html,file);
  html=patchMainCountryDetection(html,file);
  html=patchRc1206ShippingRules(html,file);
  html=patchNotificationTasks(html,file);
  html=patchTaskMasterSaveScope(html,file);
  html=patchTaskDetailTab(html,file);
  html=patchRc1259ContainerSearch(html,file);
  html=patchCompletePrintBundle(html,file);
  html=patchRc1324PrintScale(html,file);
  html=patchRc1305ShipmentViewReliability(html,file);
  html=patchRc1305LoadingListPresentation(html,file);
  html=patchRc1283LoadingListSearch(html,file);
  html=patchDeckblattHighVisibility(html,file);
  html=patchRc1203ActualDeckblatt(html,file);
  html=patchShipmentSuspendSave(html,file);
  html=patchRc1319ShipmentSaveFinalization(html,file);
  html=patchRc1296BrowserBranding(html,file);
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
  html=html.replace(/assets\/rc1074-login-clean\.js\?v=(?:1074|1112|1298|1301|1303|1311)/g,'assets/rc1074-login-clean.js?v=1349');
  html=html.replace(/assets\/rc1014-task-runtime\.js\?v=(?:1016|1266|1312|1353|1359)/g,'assets/rc1014-task-runtime.js?v=1359');
  html=html.replace(/assets\/rc1014-task-ui\.css\?v=(?:1016|1179|1312)/g,'assets/rc1014-task-ui.css?v=1312');
  html=html.replace(/assets\/rc1013-diagnostics\.js\?v=(?:1085|1125|1364)/g,'assets/rc1013-diagnostics.js?v=1364');
  html=html.replace(/assets\/exporthub-environment-hub\.js\?v=\d+/g,'assets/exporthub-environment-hub.js?v=1174');
  html=html.replace(/assets\/rc1081-audit-history\.js\?v=(?:1087|1126|1160|1163)/g,'assets/rc1081-audit-history.js?v=1177');
  html=html.replace(/assets\/rc1071-shipment-history\.js\?v=(?:1095|1151|1178|1305)/g,'assets/rc1071-shipment-history.js?v=1305');
  html=html.replace(/assets\/rc1063-abd-blob-viewer-compat\.js\?v=(?:1063|1151|1248)/g,'assets/rc1063-abd-blob-viewer-compat.js?v=1248');
  html=injectDeferredRuntimeInHead(html,'<!-- id="exporthub-rc1148-history-compat-marker" assets/rc1071-shipment-history.js?v=1095 -->','exporthub-rc1148-history-compat-marker');
  html=injectDeferredRuntimeInHead(html,RC1267_I18N_TAG,'exporthub-rc1267-i18n');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1126-customer-delete" defer src="/assets/rc1126-customer-delete.js?v=1387"></script>','exporthub-rc1126-customer-delete');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1113-stowplan-persist" defer src="/assets/rc1113-stowplan-persist.js?v=1113"></script>','exporthub-rc1113-stowplan-persist');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1114-shipping-neutral" defer src="/assets/rc1114-shipping-neutral.js?v=1386"></script>','exporthub-rc1114-shipping-neutral');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1133-avis-upload-notifications" defer src="/assets/rc1133-avis-upload-notifications.js?v=1133"></script>','exporthub-rc1133-avis-upload-notifications');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1160-customer-portal" defer src="/assets/rc1160-customer-portal-credentials.js?v=1162"></script>','exporthub-rc1160-customer-portal');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1165-pod-backup-status" defer src="/assets/rc1165-pod-backup-status.js?v=1165"></script>','exporthub-rc1165-pod-backup-status');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1166-avis-reminder" defer src="/assets/rc1166-avis-reminder-overview.js?v=1365"></script>','exporthub-rc1166-avis-reminder');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1176-shipment-location" defer src="/assets/rc1176-shipment-location.js?v=1202"></script>','exporthub-rc1176-shipment-location');
  html=injectDeferredRuntimeInHead(html,'<link id="exporthub-rc1259-container-ui" rel="stylesheet" href="/assets/rc1014-shipment-overview.css?v=1284">','exporthub-rc1259-container-ui');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1259-container-runtime" defer src="/assets/rc1014-shipment-overview.js?v=1284"></script>','exporthub-rc1259-container-runtime');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1203-deckblatt-print" defer src="/assets/rc1203-deckblatt-print.js?v=1373"></script>','exporthub-rc1203-deckblatt-print');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1207-pallet-account-fix" defer src="/assets/rc1207-pallet-account-fix.js?v=1246"></script>','exporthub-rc1207-pallet-account-fix');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1294-abd-self-service" defer src="/assets/rc1294-abd-self-service.js?v=1294"></script>','exporthub-rc1294-abd-self-service');
  html=injectDeferredRuntimeInHead(html,`<script id="exporthub-rc1193-visible-release" defer src="/assets/rc1193-visible-release.js?v=${VISIBLE_NUMBER}"></script>`,'exporthub-rc1193-visible-release');
  html=injectDeferredRuntimeInHead(html,`<script id="exporthub-rc1177-release-notes" defer src="/assets/rc1177-release-notes.js?v=${VISIBLE_NUMBER}"></script>`,'exporthub-rc1177-release-notes');
  if(!html.includes('assets/rc1014-shipment-overview.css?v=1284'))throw new Error(file+': RC1259 Container-CSS fehlt');
  if(!html.includes('assets/rc1014-shipment-overview.js?v=1284'))throw new Error(file+': RC1259 Container-Runtime fehlt');
  if(!html.includes('x&&x.sealNumber')||!html.includes('sh&&sh.sealNumber'))throw new Error(file+': RC1259 Siegelnummer ist nicht in beiden Sendungssuchen');
  if(html.includes(LEGACY_TESTSERVICE_HOST))throw new Error(file+': alter TESTSERVICE-Endpunkt ist noch aktiv');
  if(!html.includes(CURRENT_TESTSERVICE_HOST))throw new Error(file+': aktueller TESTSERVICE-Endpunkt fehlt');
  if(!html.includes(`version:'${VERSION}'`))throw new Error(file+': BUILD '+VERSION+' fehlt');
  if(!html.includes(`ExportHUB ${VERSION} environment=`))throw new Error(file+': Environment '+VERSION+' fehlt');
  if(file!=='demo.html'&&!html.includes('assets/rc1289-auth-transport-fallback.js?v=1289'))throw new Error(file+': RC1289 Desktop-Auth-Fallback fehlt');
  if(!html.includes('assets/rc1074-login-clean.js?v=1349'))throw new Error(file+': RC1349 Login-/Browser-Branding-Cache-Key fehlt');
  if(!html.includes('assets/rc1014-task-runtime.js?v=1359'))throw new Error(file+': RC1359 Aufgaben-Runtime Cache-Key fehlt');
  if(!html.includes('assets/rc1014-task-ui.css?v=1312'))throw new Error(file+': RC1312 Aufgaben-CSS Cache-Key fehlt');
  if(!html.includes('assets/rc1013-diagnostics.js?v=1364'))throw new Error(file+': RC1364 Diagnose Cache-Key fehlt');
  if(!html.includes('assets/exporthub-environment-hub.js?v=1174'))throw new Error(file+': RC1174 Android-Diagnose-Hub Cache-Key fehlt');
  if(!html.includes('assets/rc1081-audit-history.js?v=1177'))throw new Error(file+': RC1177 Historie Cache-Key fehlt');
  if(!html.includes('assets/rc1071-shipment-history.js?v=1305'))throw new Error(file+': RC1305 Dokument-History Cache-Key fehlt');
  if(file!=='demo.html'&&!html.includes('assets/rc1063-abd-blob-viewer-compat.js?v=1248'))throw new Error(file+': RC1248 Dokumentaktionen Cache-Key fehlt');
  if(!html.includes('assets/rc1071-shipment-history.js?v=1095'))throw new Error(file+': RC1148 History-Kompatibilitätsmarker fehlt');
  if(!html.includes('assets/rc1126-customer-delete.js?v=1387'))throw new Error(file+': RC1126 Kundenlöschung fehlt');
  if(!html.includes('assets/rc1113-stowplan-persist.js?v=1113'))throw new Error(file+': RC1113 Stauplan-Erweiterung fehlt');
  if(!html.includes('assets/rc1114-shipping-neutral.js?v=1386'))throw new Error(file+': RC1114 neutrale Versandkostenoberfläche fehlt');
  if(!html.includes('assets/rc1133-avis-upload-notifications.js?v=1133'))throw new Error(file+': RC1133 AVIS-Upload-Benachrichtigungen fehlen');
  if(!html.includes('assets/rc1160-customer-portal-credentials.js?v=1162'))throw new Error(file+': RC1160 Kundenportal-Runtime fehlt');
  if(!html.includes('assets/rc1165-pod-backup-status.js?v=1165'))throw new Error(file+': RC1165 POD-Sicherungsstatus-Runtime fehlt');
  if(!html.includes('assets/rc1166-avis-reminder-overview.js?v=1365'))throw new Error(file+': RC1207 Avis-Erinnerung-Runtime fehlt');
  if(!html.includes('assets/rc1176-shipment-location.js?v=1202'))throw new Error(file+': RC1191 Standort-Capture-Runtime fehlt');
  if(!html.includes('assets/rc1203-deckblatt-print.js?v=1373'))throw new Error(file+': RC1205 Deckblatt-Runtime fehlt');
  if(!html.includes('assets/rc1283-loading-list-search.js?v=1305'))throw new Error(file+': RC1283 Ladelisten-Suchruntime fehlt');
  if(!html.includes('assets/rc1315-loading-list-quick-print.js?v=1322'))throw new Error(file+': RC1315 QR-/REF-Schnelldruck-Runtime fehlt');
  if(!html.includes('assets/rc1305-loading-list-print.js?v=1379'))throw new Error(file+': RC1360 Ladelisten-Druckruntime fehlt im HTML');
  if(!html.includes('__EXPORTHUB_RC1283_OPEN_LOAD1__'))throw new Error(file+': RC1283 Ladelisten-Öffnen/Drucken-Bridge fehlt');
  if(!html.includes('assets/rc1207-pallet-account-fix.js?v=1246'))throw new Error(file+': RC1207 Palettenkonto-Runtime fehlt');
  if(!html.includes('assets/rc1294-abd-self-service.js?v=1294'))throw new Error(file+': RC1294 ABD-Self-Service-Runtime fehlt');
  if(!html.includes('assets/rc1193-visible-release.js?v='+VISIBLE_NUMBER))throw new Error(file+': '+VISIBLE_VERSION+' sichtbare Release-Version fehlt');
  if(!html.includes('assets/rc1177-release-notes.js?v='+VISIBLE_NUMBER))throw new Error(file+': '+VISIBLE_VERSION+' Änderungshinweise Cache-Key fehlt');
  if(!/\.rc352-cover\{[^}]*border:10mm solid #08245d!important;[^}]*border-top-width:18mm!important;/.test(html))throw new Error(file+': RC1133 Deckblatt-Rahmen fehlt');
  if(!/\.rc352-cover-ref\{(?=[^}]*background:#facc15)(?=[^}]*border:3mm solid #111827)[^}]*\}/.test(html))throw new Error(file+': RC1159 Deckblatt-Referenzfeld ist nicht ausreichend hervorgehoben');
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
fs.mkdirSync(path.join(OUT,'assets'),{recursive:true});
fs.copyFileSync(path.join(ROOT,'assets/rc1267-i18n.js'),path.join(OUT,'assets/rc1267-i18n.js'));
fs.cpSync(path.join(ROOT,'assets/i18n'),path.join(OUT,'assets/i18n'),{recursive:true,force:true});
for(const rel of [
  'assets/rc1014-shipment-overview.js',
  'assets/rc1014-shipment-overview.css',
  'assets/rc1027-lieferavis-immediate.js',
  'assets/rc1037-lieferavis-timing-diagnostics.js',
  'assets/exporthub-environment-hub.js',
  'assets/exporthub-demo-bootstrap.js',
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
  'assets/rc1203-deckblatt-print.js',
  'assets/rc1283-loading-list-search.js',
  'assets/rc1305-loading-list-print.js',
  'assets/rc1315-loading-list-quick-print.js',
  'assets/rc1328-multi-truck-ui-refresh.js',
  'assets/rc1289-auth-transport-fallback.js',
  'assets/rc1294-abd-self-service.js',
  'assets/rc1177-release-notes.js',
  'assets/rc1193-visible-release.js',
  'assets/exporthub360-favicon.svg',
  'assets/rc1304-theme-switcher.css',
  'assets/rc1304-theme-switcher.js',
  'assets/rc1306-layout-engine.css',
  'assets/rc1306-layout-engine.js'
]){
  const src=path.join(ROOT,rel),dst=path.join(OUT,rel);
  if(!fs.existsSync(src))throw new Error('RC1124 Pflicht-Runtime fehlt: '+rel);
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(src,dst);
  if(!fs.existsSync(dst)||fs.statSync(dst).size===0)throw new Error('RC1124 Pflicht-Runtime wurde nicht gebaut: '+rel);
}
const environmentHubBuilt=fs.readFileSync(path.join(OUT,'assets','exporthub-environment-hub.js'),'utf8');
if(!environmentHubBuilt.includes("android.time")||!environmentHubBuilt.includes("android.diagnosticTitle"))throw new Error('RC1287 lokalisierter Android-Diagnose-Hub fehlt im finalen Build');
const visibleRuntimeFile=path.join(OUT,'assets','rc1193-visible-release.js');
let visibleRuntime=fs.readFileSync(visibleRuntimeFile,'utf8');
if(!/var VERSION='RC\d+';/.test(visibleRuntime))throw new Error('RC1265 sichtbare Release-Runtime enthält keinen ersetzbaren Versionsanker');
visibleRuntime=visibleRuntime.replace(/var VERSION='RC\d+';/,`var VERSION='${VISIBLE_VERSION}';`);
fs.writeFileSync(visibleRuntimeFile,visibleRuntime);

const releaseNotesFile=path.join(OUT,'assets','rc1177-release-notes.js');
let releaseNotes=fs.readFileSync(releaseNotesFile,'utf8');
releaseNotes=releaseNotes.replace(/return'RC\d+'/,`return'${VISIBLE_VERSION}'`);
fs.writeFileSync(releaseNotesFile,releaseNotes);

for(const requiredApi of ['shared/pod-archive.js','shared/graph-drive.js','shared/container-document-store.js','shared/reference-folder-upload.js','shared/customer-portal-store.js','customer-portal-credentials/index.js','customer-portal-credentials/function.json','customer-portal-readiness/index.js','customer-portal-readiness/function.json','avis-upload-mail-readiness/index.js','avis-upload-mail-readiness/function.json','pickup-confirm-v2/index.js','pickup-container-document/index.js','pickup-container-document/function.json','container-document/index.js','container-document/function.json','pod-backup/index.js','avis-reminder-mail/index.js','avis-reminder-mail/function.json','abd-analysis/index.js','abd-analysis/function.json','shared/abd-analysis.js','shared/graph-mail.js','package.json']){
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
// RC1267 public pages: central language runtime must load before the legacy compatibility runtime.
for(const file of ['customer-avis.html','pickup.html','location.html','pod-notfall.html']){
  const target=path.join(OUT,file);if(!fs.existsSync(target))continue;
  let publicHtml=fs.readFileSync(target,'utf8');
  if(!publicHtml.includes('exporthub-rc1267-i18n')){
    const marker='id="exporthub-rc1018-public-language"',at=publicHtml.indexOf(marker);
    if(at>=0){const start=publicHtml.lastIndexOf('<script',at);publicHtml=publicHtml.slice(0,start)+RC1267_I18N_TAG+'\n'+publicHtml.slice(start)}
    else publicHtml=publicHtml.replace('</head>',RC1267_I18N_TAG+'\n</head>');
    fs.writeFileSync(target,publicHtml);
  }
}

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
    visibleVersion:VISIBLE_VERSION,
    taskDetailAndManagedRoster:'RC1179 dedicated Aufgabenansicht tab + RC1152 recurring roster + targeted legacy cleanup',
    abdDashboardCustomer:true,
    androidBuildSetup:'runner-sdkmanager',
    loginAbdAssetCache:'1112',
    stowPlanInstructionsAndPersistence:'RC1113',
    shippingProviderNeutralUi:'RC1114',
    podReliability:'RC1220 Azure primary + immutable Azure archive; M365 optional',
    podGraphReadiness:'RC1220 Graph optional; Azure archive is release-critical secondary backup',
    podTargetFailClosed:'RC1195 explicit drive user + folder required, no personal OneDrive fallback',
    podBackupStatusUi:'RC1220 shipment overview Azure/archive backup status',
    podTargetedProof:'RC1220 targeted archive proof: found/already-saved/saved-now/not-found/pending',
    podArchiveIntegrity:'RC1226 archive read-back + scheduled integrity verification',
    containerDocumentation:'RC1259 sea freight container seal + 3 QR photos + reference-folder storage + shipment overview download',
    avisReminderOverview:'RC1358 Despatch Graph sender + customer/carrier first send + Sales/CC/Tobias CC + three-business-day reminder gate + resilient shipment-card injection + secure avis link + recipient exclusion',
    abdSelfService:'RC1294 Defender-scanned PDF/XLSX/CSV analysis preview with customs position fields; no customs submission',
    avisUploadNotifications:'RC1133 secure customer PDF notice + open/print action',
    documentActionHistory:'RC1178 print/open/download + user + filename, including resumed print flow',
    deckblattHighVisibility:'RC1281 white cover + Essentra yellow / customer blue reference + lighter recipient + shipment created date',
    loadingListSearch:'RC1305 full-width search by reference/customer/attachment/remark + compact result/detail workspace + open/print/download',
    loadingListPrintRedesign:'RC1379 single-signature POD layout + ABD handover confirmation + cover/loading-list recipient and DNC fixes',
    loadingListQuickPrint:'RC1322 dedicated print QR + QR/REF complete print + Edge silent-print workstation setup',
    coverOnlyPrint:'RC1205 single Nur Deckblatt drucken action inside Speichern & Ausgabe',
    palletAccountDirectionAndAdminDelete:'RC1207 visible direction is saved, admin tombstone delete, one-time production cleanup 2026-09-21',
    coverRemark:'RC1281 compact remark block above QR without overlap',
    customerPortalCredentials:'RC1160 AES-256-GCM + re-auth + use/manage rights',
    customerPortalReadiness:'RC1162 safe key-status + UI readiness guard',
    avisAppointmentRevisionHistory:'RC1163 old/new pickup appointment history before actual pickup',
    diagnosticsNonAdminProof:'RC1169 live non-admin rights view + diagnostics-read 403',
    customerPortalReleaseReadiness:'RC1170 OIDC live configured=true gate in TESTSERVICE and PRODUCTION',
    customerPortalKeyStrength:'RC1187 minimum 32 characters, fail-closed before portal use and production release',
    customerPortalKeyDiagnostics:'RC1194 safe missing-vs-too-short readiness without secret or exact length disclosure',
    shipmentCreateUiE2E:'RC1171 UI customer + location + reference + colli + save + reload + overview',
    testserviceGateOrder:'RC1172 browser/mutation gate before external readiness blocker, production still protected',
    shipmentLocationPersistence:'RC1202 current draft priority + synthetic empty rerender guard',
    historyConsolidationAndReleaseNotes:'RC1177 duplicate shipment history cleanup + current Update changelog',
    visibleProductVersion:VISIBLE_VERSION+' current visible release label while RC1112 remains the stable build/deploy pipeline'
  },
  compatibility:{
    qr:'stable-existing-links',
    historicalBuildPath:'RC1048 preserved'
  },
  environments:{production:'index.html',testservice:'TESTVERSION.html',demo:'demo.html'}
},null,2)+'\n');


const rc1206Source=path.join(ROOT,'assets/rc1206-shipping-rules.js'),rc1206Target=path.join(OUT,'assets/rc1206-shipping-rules.js');
if(!fs.existsSync(rc1206Source))throw new Error('RC1206 Versandkosten-Runtime fehlt');
fs.mkdirSync(path.dirname(rc1206Target),{recursive:true});fs.copyFileSync(rc1206Source,rc1206Target);

const rc1207Source=path.join(ROOT,'assets/rc1207-pallet-account-fix.js'),rc1207Target=path.join(OUT,'assets/rc1207-pallet-account-fix.js');
if(!fs.existsSync(rc1207Source))throw new Error('RC1207 Palettenkonto-Runtime fehlt');
fs.copyFileSync(rc1207Source,rc1207Target);

console.log('RC1112 build pipeline ready: sichtbare Produktversion '+VISIBLE_VERSION+' auf geprüfter RC1048-Basis, RC1194 sichere Kundenportal-Key-Diagnose aktiv.');
