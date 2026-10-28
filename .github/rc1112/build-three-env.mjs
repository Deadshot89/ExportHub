import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {integrateTour} from '../rc1501/build-three-env.mjs';
import {integrateEditor} from '../rc1502/build-three-env.mjs';
import {integrateTraining} from '../rc1503/build-three-env.mjs';
import {integrateCoverageAdmin} from '../rc1506/build-three-env.mjs';
import {integrateAbdProforma} from '../rc1549/integrate-abd-proforma.mjs';
import {fingerprintAssets} from '../asset-fingerprint/fingerprint-assets.mjs';
import {patchRc1576StateBodyDeadline} from '../../scripts/rc1576-state-read-body-timeout.mjs';
import {patchRc1619LargeStateWorkerParse} from '../../scripts/rc1619-large-state-worker-parse.mjs';
import {hardenCustomerSaveHtml} from '../../scripts/rc1600-customer-save-readback.mjs';
import {hardenAckMergeSaveHtml} from '../../scripts/rc1627-ack-merge-save.mjs';
import {patchRc1662SavedShipmentDeltaHtml} from '../../scripts/rc1662-abd-saved-shipment-delta.mjs';
import {patchRc1602PodBrowserHtml} from '../../scripts/rc1602-pod-browser-pagination.mjs';

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
const RC1267_I18N_TAG='<script id="exporthub-rc1267-i18n" defer src="/assets/rc1267-i18n.js?v=1667"></script>';
const RC1206_SHIPPING_ID='exporthub-rc1206-shipping-rules';
const RC1206_SHIPPING_TAG='<script id="'+RC1206_SHIPPING_ID+'" defer src="/assets/rc1206-shipping-rules.js?v=1419"></script>';
const RC1296_BROWSER_TITLE='ExportHUB360';
const RC1296_FAVICON_TAG='<link id="exporthub360-favicon" rel="icon" type="image/svg+xml" href="/assets/exporthub360-favicon.svg?v=1296">';
const RC1304_THEME_STYLE_TAG='<link id="exporthub-rc1304-theme-style" rel="stylesheet" href="/assets/rc1304-theme-switcher.css?v=1306">';
const RC1304_THEME_SCRIPT_TAG='<script id="exporthub-rc1304-theme-script" src="/assets/rc1304-theme-switcher.js?v=1305"><\/script>';
const RC1630_LOGIN_STYLE_TAG='<link id="exporthub-rc1630-login-style" rel="stylesheet" href="/assets/rc1630-login-experience.css?v=1630">';
const RC1630_LOGIN_SCRIPT_TAG='<script id="exporthub-rc1630-login-script" src="/assets/rc1630-login-experience.js?v=1631"><\/script>';
const RC1306_LAYOUT_STYLE_TAG='<link id="exporthub-rc1306-layout-style" rel="stylesheet" href="/assets/rc1306-layout-engine.css?v=1306">';
const RC1306_LAYOUT_SCRIPT_TAG='<script id="exporthub-rc1306-layout-script" defer src="/assets/rc1306-layout-engine.js?v=1306.1"><\/script>';
const RC1371_DASHBOARD_STYLE_TAG='<link id="exporthub-rc1371-dashboard-style" rel="stylesheet" href="/assets/rc1371-dashboard-personalization.css?v=1371">';
const RC1371_DASHBOARD_I18N_TAG='<script id="exporthub-rc1371-dashboard-i18n" defer src="/assets/i18n/rc1371-dashboard-personalization.js?v=1371"><\/script>';
const RC1371_DASHBOARD_SCRIPT_TAG='<script id="exporthub-rc1371-dashboard-script" defer src="/assets/rc1371-dashboard-personalization.js?v=1371"><\/script>';
const RC1560_FULL_WIDTH_STYLE_TAG='<link id="exporthub-rc1560-full-width" rel="stylesheet" href="/assets/rc1560-full-width.css?v=1560">';
const RC1579_MENU_STYLE_TAG='<link id="exporthub-rc1579-menu-style" rel="stylesheet" href="/assets/rc1579-menu-redesign.css?v=1579">';
const RC1579_MENU_I18N_TAG='<script id="exporthub-rc1579-menu-i18n" defer src="/assets/i18n/rc1579-menu-redesign.js?v=1579"></script>';
const RC1579_MENU_SCRIPT_TAG='<script id="exporthub-rc1579-menu-script" defer src="/assets/rc1579-menu-redesign.js?v=1630"></script>';
const CUSTOMER_FOLDER_STYLE_TAG='<link id="exporthub-customer-folder-style" rel="stylesheet" href="/assets/customer-folder-redesign.css?v=2">';
// Früher Haken direkt nach <head>: muss vor den Menü-Handlern (RC325, Window-Capture) liegen, damit die Rückfrage bei
// ungespeicherten Änderungen im Kundenordner vor dem Seitenwechsel greift. Die Logik selbst liegt in customer-folder-redesign.js.
const CUSTOMER_FOLDER_GUARD_TAG='<script id="exporthub-customer-folder-guard">window.__EXPORTHUB_CF_EARLY_GUARD__=true;window.addEventListener(\'click\',function(e){var g=window.ExportHUBCustomerFolder;if(g&&g.onLeaveClick)g.onLeaveClick(e)},true);window.addEventListener(\'keydown\',function(e){var g=window.ExportHUBCustomerFolder;if(g&&g.onKey)g.onKey(e)},true);</script>';
const CUSTOMER_FOLDER_SCRIPT_TAG='<script id="exporthub-customer-folder-script" defer src="/assets/customer-folder-redesign.js?v=2"></script>';
const RC1577_OVERVIEW_COMPACT_STYLE_TAG='<link id="exporthub-rc1577-overview-compact" rel="stylesheet" href="/assets/rc1577-shipment-overview-compact.css?v=1577">';
const RC1558_OVERVIEW_STYLE_TAG='<link id="exporthub-rc1558-overview-style" rel="stylesheet" href="/assets/rc1558-dashboard-overview.css?v=1666">';
const RC1558_OVERVIEW_I18N_TAG='<script id="exporthub-rc1558-overview-i18n" defer src="/assets/i18n/rc1558-dashboard-overview.js?v=1667"><\/script>';
const RC1558_OVERVIEW_SCRIPT_TAG='<script id="exporthub-rc1558-overview-script" defer src="/assets/rc1558-dashboard-overview.js?v=1667"><\/script>';
const RC1570_TASKS_STYLE_TAG='<link id="exporthub-rc1570-tasks-style" rel="stylesheet" href="/assets/rc1570-tasks-focus.css?v=1570">';
const RC1570_TASKS_I18N_TAG='<script id="exporthub-rc1570-tasks-i18n" defer src="/assets/i18n/rc1570-tasks-focus.js?v=1570"></script>';
const RC1570_TASKS_SCRIPT_TAG='<script id="exporthub-rc1570-tasks-script" defer src="/assets/rc1570-tasks-focus.js?v=1571"></script>';
const RC1650_SHIPMENT_TASKS_SCRIPT_TAG='<script id="exporthub-rc1650-shipment-tasks-script" defer src="/assets/rc1650-shipment-task-link.js?v=1650"></script>';
const RC1630_SELF_CORRECT_I18N_TAG='<script id="exporthub-rc1630-self-correct-i18n" defer src="/assets/i18n/rc1630-self-correct.js?v=1630"></script>';
const RC1630_SELF_CORRECT_SCRIPT_TAG='<script id="exporthub-rc1630-self-correct-script" defer src="/assets/rc1630-self-correct.js?v=1630"></script>';
const RC1660_SHIPMENT_SOP_STYLE_TAG='<link id="exporthub-rc1660-shipment-sop-style" rel="stylesheet" href="/assets/rc1660-shipment-sop-popup.css?v=1660">';
const RC1660_SHIPMENT_SOP_I18N_TAG='<script id="exporthub-rc1660-shipment-sop-i18n" defer src="/assets/i18n/rc1660-shipment-sop-popup.js?v=1660"></script>';
const RC1660_SHIPMENT_SOP_SCRIPT_TAG='<script id="exporthub-rc1660-shipment-sop-script" defer src="/assets/rc1660-shipment-sop-popup.js?v=1660"></script>';
const RC1650_DIAG_PLAIN_I18N_TAG='<script id="exporthub-rc1650-diagnostics-plain-i18n" defer src="/assets/i18n/rc1650-diagnostics-plain.js?v=1650"></script>';
const RC1650_DIAG_PLAIN_SCRIPT_TAG='<script id="exporthub-rc1650-diagnostics-plain-script" defer src="/assets/rc1650-diagnostics-plain.js?v=1650"></script>';
// Web Push: phone notifications without website login (assets/web-push, api/web-push)
const WEB_PUSH_MANIFEST_TAG='<link id="exporthub-web-push-manifest" rel="manifest" href="/assets/web-push/manifest.json">';
const WEB_PUSH_I18N_TAG='<script id="exporthub-web-push-i18n" defer src="/assets/i18n/web-push.js?v=1701"></script>';
const WEB_PUSH_SCRIPT_TAG='<script id="exporthub-web-push-client" defer src="/assets/web-push/client.js?v=1700"></script>';
const RC1577_POD_AUDIT_I18N_TAG='<script id="exporthub-rc1577-pod-audit-i18n" defer src="/assets/i18n/rc1577-pod-quality-audit.js?v=1577"></script>';
const RC1577_POD_AUDIT_SCRIPT_TAG='<script id="exporthub-rc1577-pod-audit-script" defer src="/assets/rc1577-pod-quality-audit.js?v=1596"></script>';
const RC1596_POD_FOLDER_SCRIPT_TAG='<script id="exporthub-rc1596-pod-folder-reconnect" defer src="/assets/rc1596-pod-folder-reconnect.js?v=1596"></script>';
const RC1602_OFFICIAL_POD_SCRIPT_TAG='<script id="exporthub-rc1602-official-pod" src="/assets/rc1602-official-pod-server-download.js?v=1623"></script>';
const RC1558_WORKSPACE_MARKER='window.__EXPORTHUB_RC885_CLEAN_WORKSPACE__ = true;';
const RC1558_WORKSPACE_EXPORT="window.ExportHUBWorkspace885=Object.freeze({shipments:shipments,tasks:tasks,shipmentOpenList:shipmentOpenList,taskOpenList:taskOpenList,dueTask:dueTask,shipmentNeedsDocuments:shipmentNeedsDocuments,shipmentNeedsPickup:shipmentNeedsPickup,shipmentNeedsPod:shipmentNeedsPod,routeTo:routeTo});";
const RC1328_MULTI_TRUCK_REFRESH_TAG='<script id="exporthub-rc1328-multi-truck-refresh" defer src="/assets/rc1328-multi-truck-ui-refresh.js?v=1333"><\/script>';

function patchTaskPlannerV2UiCutover(html,file){
  const marker='__EXPORTHUB_TASKPLANNER_V2_UI_CUTOVER__';
  if(html.includes(marker))return html;
  const needle="function render(){if(rendering||view()!=='planning')return false;";
  const at=html.indexOf(needle);
  if(at<0)return html;
  html=html.slice(0,at)+needle+"if(window.__EXPORTHUB_TASKPLANNER_V2_UI_CUTOVER__!==false&&window.ExportHUBTaskUIV2&&typeof window.ExportHUBTaskUIV2.renderPlannerPage==='function'){var __tpv2root=root();if(!__tpv2root)return false;window.__EXPORTHUB_TASKPLANNER_V2_UI_CUTOVER__=true;return window.ExportHUBTaskUIV2.renderPlannerPage(__tpv2root,{state:st(),weekStart:selectedWeek(),runtime:window.ExportHUBRC1014TaskRuntime});}"+html.slice(at+needle.length);
  if(!html.includes(marker)||!html.includes('return window.ExportHUBTaskUIV2.renderPlannerPage'))throw new Error(file+': TaskPlanner V2 Planner-Cutover unvollständig');
  return html;
}

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
  if(!html.includes('rc1304-theme-switcher.css?v=1306'))throw new Error(file+': RC1304 Theme-CSS fehlt');
  if(!html.includes('rc1304-theme-switcher.js?v=1305'))throw new Error(file+': RC1304 Theme-Switcher fehlt');
  return html;
}

function patchRc1630LoginVisuals(html,file){
  html=injectDeferredRuntimeInHead(html,RC1630_LOGIN_STYLE_TAG,'exporthub-rc1630-login-style');
  html=injectDeferredRuntimeInHead(html,RC1630_LOGIN_SCRIPT_TAG,'exporthub-rc1630-login-script');
  if(!html.includes('rc1630-login-experience.css?v=1630'))throw new Error(file+': RC1630 Login-CSS fehlt');
  if(!html.includes('rc1630-login-experience.js?v=1631'))throw new Error(file+': RC1630 Login-UI fehlt');
  return html;
}

function patchRc1400MobileNavigationCache(html,file){
  const before='assets/rc1016-mobile-navigation.js?v=1016';
  const after='assets/rc1016-mobile-navigation.js?v=1400';
  const count=html.split(before).length-1;
  if(count!==1)throw new Error(file+': RC1400 Mobile-Navigation Cache-Anker '+count+'x gefunden');
  html=html.replace(before,after);
  if(!html.includes(after))throw new Error(file+': RC1400 Mobile-Navigation Cache-Key fehlt');
  return html;
}

function patchRc1560FullWidth(html,file){
  // last stylesheet in <head>: lifts the screen width caps of #content and the view wrappers
  html=injectDeferredRuntimeInHead(html,RC1560_FULL_WIDTH_STYLE_TAG,'exporthub-rc1560-full-width');
  if(!html.includes('rc1560-full-width.css?v=1560'))throw new Error(file+': RC1560 Vollbreite-CSS fehlt');
  return html;
}

function patchRc1577OverviewCompact(html,file){
  // after RC1560: compact shipment overview tiles, purely visual
  html=injectDeferredRuntimeInHead(html,RC1577_OVERVIEW_COMPACT_STYLE_TAG,'exporthub-rc1577-overview-compact');
  if(!html.includes('rc1577-shipment-overview-compact.css?v=1577'))throw new Error(file+': RC1577 kompakte Sendungsübersicht fehlt');
  return html;
}

function patchRc1579Menu(html,file){
  // after RC1577: menu sections with submenus and one icon set; buttons stay canonical in #nav
  html=injectDeferredRuntimeInHead(html,RC1579_MENU_STYLE_TAG,'exporthub-rc1579-menu-style');
  html=injectDeferredRuntimeInHead(html,RC1579_MENU_I18N_TAG,'exporthub-rc1579-menu-i18n');
  html=injectDeferredRuntimeInHead(html,RC1579_MENU_SCRIPT_TAG,'exporthub-rc1579-menu-script');
  if(!html.includes('rc1579-menu-redesign.css?v=1579')||!html.includes('i18n/rc1579-menu-redesign.js?v=1579')||!html.includes('/assets/rc1579-menu-redesign.js?v=1630'))throw new Error(file+': RC1579 Menü fehlt');
  return html;
}

function patchCustomerFolderRedesign(html,file){
  // after RC1579: fixed section order in every design, section navigation and sticky save bar; never saves on its own
  html=injectDeferredRuntimeInHead(html,CUSTOMER_FOLDER_STYLE_TAG,'exporthub-customer-folder-style');
  html=injectDeferredRuntimeInHead(html,CUSTOMER_FOLDER_SCRIPT_TAG,'exporthub-customer-folder-script');
  if(!html.includes('id="exporthub-customer-folder-guard"')){
    const headOpen=/<head\b[^>]*>/i.exec(html);
    if(!headOpen)throw new Error(file+': <head> für Kundenordner-Rückfrage fehlt');
    const at=headOpen.index+headOpen[0].length;
    html=html.slice(0,at)+'\n'+CUSTOMER_FOLDER_GUARD_TAG+html.slice(at);
  }
  if(!html.includes('customer-folder-redesign.css?v=2')||!html.includes('/assets/customer-folder-redesign.js?v=2'))throw new Error(file+': Kundenordner-Redesign fehlt');
  return html;
}

function patchRc1371Dashboard(html,file){
  html=injectDeferredRuntimeInHead(html,RC1371_DASHBOARD_STYLE_TAG,'exporthub-rc1371-dashboard-style');
  html=injectDeferredRuntimeInHead(html,RC1371_DASHBOARD_I18N_TAG,'exporthub-rc1371-dashboard-i18n');
  html=injectDeferredRuntimeInHead(html,RC1371_DASHBOARD_SCRIPT_TAG,'exporthub-rc1371-dashboard-script');
  if(!html.includes('rc1371-dashboard-personalization.css?v=1371'))throw new Error(file+': RC1371 Dashboard-CSS fehlt');
  if(!html.includes('i18n/rc1371-dashboard-personalization.js?v=1371'))throw new Error(file+': RC1371 Dashboard-I18n fehlt');
  if(!html.includes('rc1371-dashboard-personalization.js?v=1371'))throw new Error(file+': RC1371 Dashboard-Runtime fehlt');
  return html;
}

function patchRc1558DashboardOverview(html,file){
  // The overview reuses the canonical RC885 predicates instead of computing its own KPIs.
  if(!html.includes(RC1558_WORKSPACE_EXPORT)){
    const count=html.split(RC1558_WORKSPACE_MARKER).length-1;
    if(count!==1)throw new Error(file+': RC1558 RC885-Workspace-Anker '+count+'x statt genau 1x gefunden');
    html=html.replace(RC1558_WORKSPACE_MARKER,RC1558_WORKSPACE_MARKER+'\n  '+RC1558_WORKSPACE_EXPORT);
  }
  html=injectDeferredRuntimeInHead(html,RC1558_OVERVIEW_STYLE_TAG,'exporthub-rc1558-overview-style');
  html=injectDeferredRuntimeInHead(html,RC1558_OVERVIEW_I18N_TAG,'exporthub-rc1558-overview-i18n');
  html=injectDeferredRuntimeInHead(html,RC1558_OVERVIEW_SCRIPT_TAG,'exporthub-rc1558-overview-script');
  if(!html.includes(RC1558_WORKSPACE_EXPORT))throw new Error(file+': RC1558 RC885-Workspace-Export fehlt');
  if(!html.includes('rc1558-dashboard-overview.css?v=1666'))throw new Error(file+': RC1558 Dashboard-Übersicht-CSS fehlt');
  if(!html.includes('i18n/rc1558-dashboard-overview.js?v=1667'))throw new Error(file+': RC1558 Dashboard-Übersicht-I18n fehlt');
  if(!html.includes('rc1558-dashboard-overview.js?v=1667'))throw new Error(file+': RC1558 Dashboard-Übersicht-Runtime fehlt');
  // RC1570 task focus view (overdue/today first, new-task form, working task detail view)
  html=injectDeferredRuntimeInHead(html,RC1570_TASKS_STYLE_TAG,'exporthub-rc1570-tasks-style');
  html=injectDeferredRuntimeInHead(html,RC1570_TASKS_I18N_TAG,'exporthub-rc1570-tasks-i18n');
  html=injectDeferredRuntimeInHead(html,RC1570_TASKS_SCRIPT_TAG,'exporthub-rc1570-tasks-script');
  if(!html.includes('i18n/rc1570-tasks-focus.js?v=1570')||!html.includes('/assets/rc1570-tasks-focus.js?v=1571')||!html.includes('rc1570-tasks-focus.css?v=1570'))throw new Error(file+': RC1570 Aufgaben-Fokus fehlt');
  // RC1650 tasks with a customer number are completed by a new shipment for that customer
  html=injectDeferredRuntimeInHead(html,RC1650_SHIPMENT_TASKS_SCRIPT_TAG,'exporthub-rc1650-shipment-tasks-script');
  if(!html.includes('/assets/rc1650-shipment-task-link.js?v=1650'))throw new Error(file+': RC1650 Aufgaben-Sendungsabgleich fehlt');
  // RC1577 admin POD audit (report first, regenerate / review flag only after confirmation)
  html=injectDeferredRuntimeInHead(html,RC1577_POD_AUDIT_I18N_TAG,'exporthub-rc1577-pod-audit-i18n');
  html=injectDeferredRuntimeInHead(html,RC1577_POD_AUDIT_SCRIPT_TAG,'exporthub-rc1577-pod-audit-script');
  html=injectDeferredRuntimeInHead(html,RC1596_POD_FOLDER_SCRIPT_TAG,'exporthub-rc1596-pod-folder-reconnect');
  if(!html.includes('i18n/rc1577-pod-quality-audit.js?v=1577')||!html.includes('/assets/rc1577-pod-quality-audit.js?v=1596')||!html.includes('/assets/rc1596-pod-folder-reconnect.js?v=1596'))throw new Error(file+': RC1577 POD-Prüfung fehlt');
  // RC1630 "Selbst korrigieren" in the IT area (global admins; uploads become pull requests, never live edits)
  html=injectDeferredRuntimeInHead(html,RC1630_SELF_CORRECT_I18N_TAG,'exporthub-rc1630-self-correct-i18n');
  html=injectDeferredRuntimeInHead(html,RC1630_SELF_CORRECT_SCRIPT_TAG,'exporthub-rc1630-self-correct-script');
  if(!html.includes('i18n/rc1630-self-correct.js?v=1630')||!html.includes('/assets/rc1630-self-correct.js?v=1630'))throw new Error(file+': RC1630 Selbst korrigieren fehlt');
  // RC1660 "SOP öffnen" in Sendung erstellen: movable popup + click simulation for every SOP (no navigation, no productive actions)
  html=injectDeferredRuntimeInHead(html,RC1660_SHIPMENT_SOP_STYLE_TAG,'exporthub-rc1660-shipment-sop-style');
  html=injectDeferredRuntimeInHead(html,RC1660_SHIPMENT_SOP_I18N_TAG,'exporthub-rc1660-shipment-sop-i18n');
  html=injectDeferredRuntimeInHead(html,RC1660_SHIPMENT_SOP_SCRIPT_TAG,'exporthub-rc1660-shipment-sop-script');
  if(!html.includes('rc1660-shipment-sop-popup.css?v=1660')||!html.includes('i18n/rc1660-shipment-sop-popup.js?v=1660')||!html.includes('/assets/rc1660-shipment-sop-popup.js?v=1660'))throw new Error(file+': RC1660 SOP-Popup fehlt');
  // RC1650 Fehlerdiagnose in Klartext (explanations, urgency, AI fix from a message)
  html=injectDeferredRuntimeInHead(html,RC1650_DIAG_PLAIN_I18N_TAG,'exporthub-rc1650-diagnostics-plain-i18n');
  html=injectDeferredRuntimeInHead(html,RC1650_DIAG_PLAIN_SCRIPT_TAG,'exporthub-rc1650-diagnostics-plain-script');
  if(!html.includes('i18n/rc1650-diagnostics-plain.js?v=1650')||!html.includes('/assets/rc1650-diagnostics-plain.js?v=1650'))throw new Error(file+': RC1650 Fehlerdiagnose-Klartext fehlt');
  return html;
}

function patchRc1617AbdUploadFailureFeedback(html,file){
  // RC1617: The asynchronous central uploader used to alert on failed Azure
  // saves without notifying the ABD status component. Keep the original
  // document persistence flow but propagate a terminal failure immediately.
  const begin=html.indexOf('window.rc524UploadFile=function(input,key){');
  if(begin<0){if(file==='demo.html')return html;throw new Error(file+': RC1617 zentraler Uploader fehlt');}
  const end=html.indexOf('window.rc524DeleteFile=',begin);
  if(end<begin)throw new Error(file+': RC1617 Upload-Endanker fehlt');
  let part=html.slice(begin,end);
  function replaceExactly(before,after){
    const occurrences=part.split(before).length-1;
    if(occurrences!==1)throw new Error(file+': RC1617 Upload-Anker '+occurrences+'x statt 1x');
    part=part.replace(before,after);
  }
  replaceExactly(
    'var sh=findShipment(input.dataset.id)||currentShipment(),file=input.files&&input.files[0];if(!sh||!file)return false;',
    "var sh=key==='abdFiles'?findShipment(input.dataset.id):findShipment(input.dataset.id)||currentShipment(),file=input.files&&input.files[0];if(!sh||!file){if(key==='abdFiles'){var msg=sh?'Kein ABD-Dokument ausgewählt.':'Die gewählte Sendung konnte nicht eindeutig gefunden werden. ABD nicht hochgeladen.';rc1617AbdUploadFailed(sh,input,msg);alert(msg)}return false;}"
  );
  replaceExactly(
    "if(!ok){alert((kind==='pod'?'POD':'ABD')",
    "if(!ok){if(kind==='abd')rc1617AbdUploadFailed(sh,input,'Azure-Speicherung konnte nicht bestätigt werden.');alert((kind==='pod'?'POD':'ABD')"
  );
  replaceExactly(
    '}).catch(function(e){alert(e.message||e)});return false};',
    "}).catch(function(e){if(key==='abdFiles')rc1617AbdUploadFailed(sh,input,e&&e.message||String(e));alert(e.message||e)});return false};"
  );
  const helper="function rc1617AbdUploadFailed(sh,input,message){try{window.dispatchEvent(new CustomEvent('exporthub:shipment-document-upload-failed',{detail:{kind:'abd',shipmentId:sh?shipmentId(sh):Q(input&&input.dataset&&input.dataset.id),reference:sh?shipmentRef(sh):'',message:Q(message)}}))}catch(_){}}\n";
  const helperAnchor='function overrideUploads(){';
  if(!html.includes(helperAnchor))throw new Error(file+': RC1617 Helper-Anker fehlt');
  html=html.replace(helperAnchor,helper+helperAnchor);
  return html.slice(0,begin+helper.length)+part+html.slice(end+helper.length);
}

function patchRc1619AbdFailClosedRollback(html,file){
  // Preserve the prior ABD state when the async Azure save cannot be confirmed.
  // Without this rollback a failed upload locally marks ABD as completed and
  // can temporarily clear the shipping gate before reloading from the server.
  const begin=html.indexOf('window.rc524UploadFile=function(input,key){');
  if(begin<0){if(file==='demo.html')return html;throw new Error(file+': RC1619 zentraler Uploader fehlt');}
  const end=html.indexOf('window.rc524DeleteFile=',begin);
  if(end<begin)throw new Error(file+': RC1619 Upload-Endanker fehlt');
  let part=html.slice(begin,end);
  function replaceExactly(before,after){
    const n=part.split(before).length-1;
    if(n!==1)throw new Error(file+': RC1619 Upload-Anker '+n+'x statt 1x');
    part=part.replace(before,after);
  }
  replaceExactly('fileToPdf(file).then(async function(pdf){','var abdRollback=null;fileToPdf(file).then(async function(pdf){');
  replaceExactly("if(kind==='abd'){applyAbdDocumentDurably(sh,item)}","if(kind==='abd'){abdRollback=rc1619CaptureAbdState(sh,item.id);applyAbdDocumentDurably(sh,item)}");
  replaceExactly(
    "if(!ok){if(kind==='abd')rc1617AbdUploadFailed(sh,input,'Azure-Speicherung konnte nicht bestätigt werden.');alert(",
    "if(!ok){if(kind==='abd'){if(abdRollback){abdRollback();abdRollback=null}rc1617AbdUploadFailed(sh,input,'Azure-Speicherung konnte nicht bestätigt werden.')}alert("
  );
  replaceExactly("if(kind==='pod'){try{var cloud=", "if(kind==='abd')abdRollback=null;if(kind==='pod'){try{var cloud=");
  replaceExactly(
    "}).catch(function(e){if(key==='abdFiles')rc1617AbdUploadFailed(sh,input,e&&e.message||String(e));alert(e.message||e)});return false};",
    "}).catch(function(e){if(key==='abdFiles'){if(abdRollback){abdRollback();abdRollback=null}rc1617AbdUploadFailed(sh,input,e&&e.message||String(e))}alert(e.message||e)});return false};"
  );
  html=html.slice(0,begin)+part+html.slice(end);
  const helper="function rc1619CaptureAbdState(sh,fileId){\n var state=S(),id=shipmentId(sh),ref=L(shipmentRef(sh)),saved=[],seen=[];\n var shipmentKeys=['abdFiles','documentHistory','abdStatus','abdDone','abdCompleted','abdUploadedAt','abdCompletedAt','updatedAt','_syncUpdatedAt','status','shipmentStatus','statusReason','statusReasons'];\n var requestKeys=['abdFiles','linkedShipmentId','ref','reference','status','abdStatus','done','abdDone','completed','completedAt','updatedAt','_syncUpdatedAt'];\n function same(x){if(!x||typeof x!=='object')return false;var xi=shipmentId(x),xr=L(shipmentRef(x));return !!((id&&xi===id&&(!ref||!xr||xr===ref))||(ref&&xr===ref&&(!id||!xi||xi===id)))}\n function copy(k,v){if((k==='abdFiles'||k==='documentHistory')&&Array.isArray(v))return v.map(function(f){return f&&typeof f==='object'?Object.assign({},f):f});return v}\n function take(obj,keys,isShipment){if(!obj||seen.indexOf(obj)>=0)return;seen.push(obj);var fields={};keys.forEach(function(k){fields[k]={had:Object.prototype.hasOwnProperty.call(obj,k),value:copy(k,obj[k])}});saved.push({obj:obj,fields:fields,isShipment:!!isShipment})}\n [state.shipments,state.savedShipments,state.sharedShipments].forEach(function(list){if(Array.isArray(list))list.forEach(function(x){if(same(x))take(x,shipmentKeys,true)})});\n [state.shipment,state.currentShipment,state.selectedShipment,state.activeShipment,state.documentShipment,sh].forEach(function(x){if(same(x))take(x,shipmentKeys,true)});\n abdRequestsForShipment(sh).forEach(function(x){take(x,requestKeys,false)});\n return function(){\n  // First detect whether the failed upload was actually attached to a shipment.\n  // A linked ABD request can have its completion flags changed without receiving\n  // an abdFiles entry; the original rollback missed that request completely.\n  var touchedShipment=saved.some(function(entry){\n   if(!entry.isShipment)return false;\n   var rows=Array.isArray(entry.obj.abdFiles)?entry.obj.abdFiles:[];\n   return rows.some(function(f){return Q(f&&f.id)===Q(fileId)});\n  });\n  saved.forEach(function(entry){\n   var rows=Array.isArray(entry.obj.abdFiles)?entry.obj.abdFiles:[];\n   var ownsFile=rows.some(function(f){return Q(f&&f.id)===Q(fileId)});\n   var changedRequest=!entry.isShipment&&touchedShipment&&\n    ['status','abdStatus','done','abdDone','completed','completedAt'].some(function(k){\n     var before=entry.fields[k],had=Object.prototype.hasOwnProperty.call(entry.obj,k);\n     return before&&(had!==before.had||entry.obj[k]!==before.value);\n    });\n   entry.touched=ownsFile||changedRequest;\n   if(!entry.touched)return;\n   Object.keys(entry.fields).forEach(function(k){\n    // Preserve unrelated request documents and identifiers when the failed\n    // file was only attached to the shipment, not this request.\n    if(!entry.isShipment&&!ownsFile&&\n       (k==='abdFiles'||k==='linkedShipmentId'||k==='ref'||k==='reference'))return;\n    var f=entry.fields[k];\n    if(f.had)entry.obj[k]=copy(k,f.value);else delete entry.obj[k];\n   });\n  });\n  saved.forEach(function(entry){if(entry.isShipment&&entry.touched)try{recalculateShipmentStatus(entry.obj)}catch(_){}});\n\n };\n}\n";
  const anchor='function overrideUploads(){';
  if(html.split(anchor).length!==2)throw new Error(file+': RC1619 Helper-Anker nicht eindeutig');
  return html.replace(anchor,helper+anchor);
}

function patchRc1626AbdUploadBoundedSave(html,file){
  // RC1626: A failing or slow Azure save kept the ABD status on "wird verarbeitet"
  // for 80-140 s while flushSave was retried every 250 ms with the full PDF.
  // Bound every await, back off between attempts, never count an unqueued save
  // as stored, and name the Azure error in the failure message.
  const begin=html.indexOf('async function flushDocumentUpload(reason){');
  if(begin<0){if(file==='demo.html')return html;throw new Error(file+': RC1626 flushDocumentUpload fehlt');}
  const verifyAnchor='async function verifyAbdUploadAfterAzure(sh,item){';
  const verifyBegin=html.indexOf(verifyAnchor,begin);
  if(verifyBegin<begin)throw new Error(file+': RC1626 verifyAbdUploadAfterAzure fehlt');
  const flush="function rc1626Wait(clean,ms){return new Promise(function(resolve){(clean&&clean.native&&clean.native.setTimeout||window.setTimeout)(resolve,ms)})}\n"+
    "function rc1626Bounded(clean,value,ms,fallback){return Promise.race([Promise.resolve(value),rc1626Wait(clean,ms).then(function(){return fallback})])}\n"+
    "function rc1626SaveError(clean){var rt=clean&&clean.runtime;return Q(rt&&rt.lastSaveErrorCode)||'AZURE_SAVE_UNCONFIRMED'}\n"+
    "async function flushDocumentUpload(reason){var clean=window.ExportHUBClean;if(!clean||typeof clean.queueSave!=='function')return false;var rt=clean.runtime,before=rt?Number(rt.changeGeneration||0):0;await rc1626Bounded(clean,clean.queueSave(reason),5000,false);var target=rt?Number(rt.changeGeneration||0):0,queued=target>before,deadline=Date.now()+45000,attempt=0,ok=false;function saved(){return !!(rt&&queued&&Number(rt.lastSavedGeneration||0)>=target)}while(!ok&&attempt<3&&Date.now()<deadline){while(rt&&rt.saving&&Date.now()<deadline)await rc1626Wait(clean,100);if(saved()){ok=true;break}if(typeof clean.flushSave!=='function')break;attempt++;ok=(await rc1626Bounded(clean,clean.flushSave(reason,{force:true,userInitiated:true}),Math.max(1,deadline-Date.now()),false))===true;if(!ok&&attempt<3&&Date.now()<deadline)await rc1626Wait(clean,Math.min(8000,1500*Math.pow(2,attempt-1)))}if(!ok&&saved())ok=true;return ok}\n";
  html=html.slice(0,begin)+flush+html.slice(verifyBegin);
  const vBegin=html.indexOf(verifyAnchor);
  const vEnd=html.indexOf('function overrideUploads(){',vBegin);
  if(vEnd<vBegin)throw new Error(file+': RC1626 Verify-Endanker fehlt');
  let verify=html.slice(vBegin,vEnd);
  const sync='await Promise.resolve(window.ExportHUBSync.syncNow())';
  const syncCount=verify.split(sync).length-1;
  if(syncCount!==2)throw new Error(file+': RC1626 syncNow-Anker '+syncCount+'x statt 2x');
  verify=verify.split(sync).join('await rc1626Bounded(window.ExportHUBClean,window.ExportHUBSync.syncNow(),15000,false)');
  html=html.slice(0,vBegin)+verify+html.slice(vEnd);
  const failed="rc1617AbdUploadFailed(sh,input,'Azure-Speicherung konnte nicht bestätigt werden.')";
  if(html.split(failed).length!==2)throw new Error(file+': RC1626 Fehlermeldungs-Anker fehlt');
  html=html.replace(failed,"rc1617AbdUploadFailed(sh,input,'Azure-Speicherung konnte nicht bestätigt werden ('+rc1626SaveError(window.ExportHUBClean)+').')");
  const alertText="' wurde lokal übernommen, konnte aber noch nicht dauerhaft in Azure bestätigt werden. Bitte die Seite nicht aktualisieren und die Verbindung prüfen.')";
  if(html.split(alertText).length!==2)throw new Error(file+': RC1626 Alert-Anker fehlt');
  html=html.replace(alertText,"(kind==='abd'?' konnte nicht dauerhaft in Azure gespeichert werden ('+rc1626SaveError(window.ExportHUBClean)+'). Bitte erneut hochladen.':"+alertText.slice(0,-1)+"))");
  return html;
}

function patchRc1624AbdUploadCrossCollection(html,file){
  // RC1624: document status must stay consistent across all persisted copies.
  // RC1626 already owns the bounded, user-initiated Azure flush. Do not
  // replace that runtime or widen the POD/background save policy here.
  const original='function shipmentDocumentCopies(sh){var out=[];function add(x){if(!x||out.indexOf(x)>=0||!sameShipmentRecord(x,sh))return;out.push(x)}A(S().shipments).forEach(add);add(S().shipment);add(sh);return out}';
  const corrected='function shipmentDocumentCopies(sh){var out=[],id=shipmentId(sh),ref=L(shipmentRef(sh));function add(x){if(!x||out.indexOf(x)>=0)return;var xi=shipmentId(x),xr=L(shipmentRef(x));if(id&&xi&&xi!==id)return;if(ref&&xr&&xr!==ref)return;if(!((id&&xi&&xi===id)||(ref&&xr&&xr===ref)))return;out.push(x)}A(S().shipments).forEach(add);A(S().savedShipments).forEach(add);A(S().sharedShipments).forEach(add);add(S().shipment);add(sh);return out}';
  if(html.split(original).length!==2){if(file==='demo.html'&&!html.includes('function shipmentDocumentCopies(sh){'))return html;throw new Error(file+': RC1624 shipmentDocumentCopies anchor not unique');}
  return html.replace(original,corrected);
}

function patchRc1602OfficialPod(html,file){
  html=injectImmediateRuntimeAfterHead(html,RC1602_OFFICIAL_POD_SCRIPT_TAG,'exporthub-rc1602-official-pod');
  html=html.replace(/rc1602-official-pod-server-download\.js\?v=(?:1602|1616)/g,'rc1602-official-pod-server-download.js?v=1623');
  if(!html.includes('rc1602-official-pod-server-download.js?v=1623'))
    throw new Error(file+': RC1602 offizieller signierter POD-Download fehlt');
  return html;
}
function patchRc1306LayoutEngine(html,file){
  html=injectDeferredRuntimeInHead(html,RC1306_LAYOUT_STYLE_TAG,'exporthub-rc1306-layout-style');
  html=injectDeferredRuntimeInHead(html,RC1306_LAYOUT_SCRIPT_TAG,'exporthub-rc1306-layout-script');
  if(!html.includes('rc1306-layout-engine.css?v=1306'))throw new Error(file+': RC1306 Layout-CSS fehlt');
  if(!html.includes('rc1306-layout-engine.js?v=1306.1'))throw new Error(file+': RC1306 Layout-Engine fehlt');
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
  if(!html.includes('rc1206-shipping-rules.js?v=1419'))throw new Error(file+': RC1419 Versandkosten-Runtime fehlt');
  return html;
}

function patchMainCountryDetection(html,file){
  const linesAnchor=" var lines=raw.split(/[\\n,;|]+/).map(q).filter(Boolean);";
  const italyRule=" var italian=raw.match(/\\b([0-9]{5})\\b[\\s\\S]*\\b([A-Za-z]{2})\\s*$/),itProvinces='|AG|AL|AN|AO|AP|AQ|AR|AT|AV|BA|BG|BI|BL|BN|BO|BR|BS|BT|BZ|CA|CB|CE|CH|CI|CL|CN|CO|CR|CS|CT|CZ|EN|FC|FE|FG|FI|FM|FR|GE|GO|GR|IM|IS|KR|LC|LE|LI|LO|LT|LU|MB|MC|ME|MI|MN|MO|MS|MT|NA|NO|NU|OR|PA|PC|PD|PE|PG|PI|PN|PO|PR|PT|PU|PV|PZ|RA|RC|RE|RG|RI|RM|RN|RO|SA|SI|SO|SP|SR|SS|SU|SV|TA|TE|TN|TO|TP|TR|TS|TV|UD|VA|VB|VC|VE|VI|VR|VS|VT|VV|';if(italian&&itProvinces.indexOf('|'+String(italian[2]).toUpperCase()+'|')>=0)return countryName('IT');\n";
  const count=html.split(linesAnchor).length-1;
  if(count!==1)throw new Error(file+': RC1237 countryFromAddress-Anker '+count+'x gefunden');
  html=html.replace(linesAnchor,italyRule+linesAnchor);

  // Keep the selected delivery location and recipient fields intact. RC1048
  // also includes a location-address fallback and shipment-country fields
  // between them, so the historical loc-prefix is no longer a stable anchor.
  const customerFirst="||firstValue(c,['country','land','countryName','countryCode','iso','iso2'])||countryFromAddress(address)";
  const addressFirst="||countryFromAddress(address)||firstValue(c,['country','land','countryName','countryCode','iso','iso2'])";
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

// Web Push (phone notifications without login): manifest for "Add to Home Screen" (required on iOS)
// and the client that subscribes the device in "Benachrichtigungen". Not in the demo.
function patchWebPush(html,file){
  if(file==='demo.html')return html;
  html=injectDeferredRuntimeInHead(html,WEB_PUSH_MANIFEST_TAG,'exporthub-web-push-manifest');
  html=injectDeferredRuntimeInHead(html,WEB_PUSH_I18N_TAG,'exporthub-web-push-i18n');
  html=injectDeferredRuntimeInHead(html,WEB_PUSH_SCRIPT_TAG,'exporthub-web-push-client');
  if(!html.includes('/assets/web-push/manifest.json')||!html.includes('/assets/web-push/client.js?v=1700'))throw new Error(file+': Web Push fehlt');
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

// RC1566: notifications recognise tasks assigned by user id (assignedTo/effectiveAssignee) and dated by dueAt,
// and browser notifications/hints name the concrete tasks (title, priority, due date) instead of only a count.
function patchNotificationTaskDetails(html,file){
  const moduleStart='<script id="index236-notification-controller">';
  const moduleEnd='<!-- INDEX 236 NOTIFICATION CENTER END -->';
  const a=html.indexOf(moduleStart),b=a>=0?html.indexOf(moduleEnd,a+moduleStart.length):-1;
  if(a<0||b<0)throw new Error(file+': RC1566 Benachrichtigungsmodul fehlt');
  let block=html.slice(a,b);
  const oldOwner=String.raw`function taskOwner(t){return q(t&&(t.owner||t.assignee||t.responsible||t.zustaendig||t.eowner||''))}`;
  const newOwner=String.raw`function taskOwner(t){return q(t&&(t.assignedToName||t.owner||t.assignee||t.responsible||t.zustaendig||t.eowner||''))}
function taskOwnerKeys(t){if(!t)return[];var eff=low(t.effectiveAssignee);if(eff)return[eff];return[t.owner,t.assignee,t.assigneeId,t.assignedTo,t.userId,t.responsible,t.zustaendig,t.eowner,t.assignedToName].map(low).filter(Boolean)}
function taskPriorityRank(t){var m=q(t&&t.priority).match(/^P(\d)$/i);return m?Number(m[1]):9}
function taskLine(t){var d=taskDate(t),p=q(t&&t.priority);return taskTitle(t)+(/^P\d$/i.test(p)?' · '+p.toUpperCase():'')+(d?' · fällig '+fmtDate(d):'')}
function urgentTasks(){return openTasks().slice().sort(function(x,y){var dx=taskDate(x)||'9999-99-99',dy=taskDate(y)||'9999-99-99';if(dx!==dy)return dx<dy?-1:1;return taskPriorityRank(x)-taskPriorityRank(y)})}
function hintTaskList(){var list=urgentTasks().slice(0,3);if(!list.length)return'';return '<ul class="index236-hint-tasks" style="list-style:none;margin:10px 0 0;padding:0;display:grid;gap:6px">'+list.map(function(t){return '<li><button type="button" class="soft" style="width:100%;text-align:left;white-space:normal" data-index236-action="open-task" data-id="'+esc(taskId(t))+'">'+esc(taskLine(t))+'</button></li>'}).join('')+'</ul>'}`;
  const oldForUser=String.raw`function taskForUser(t){var own=low(taskOwner(t)),u=low(userName()),login=low(user().user||user().login||user().username);return !own||own==='alle'||own==='all'||own.indexOf(u)>=0||u.indexOf(own)>=0||(login&&own.indexOf(login)>=0)}`;
  const newForUser=String.raw`function taskForUser(t){var keys=taskOwnerKeys(t);if(!keys.length)return true;var u=user(),ids=[u.id,u.userId].map(low).filter(Boolean),names=[userName(),u.user,u.login,u.username].map(low).filter(Boolean);return keys.some(function(own){if(own==='alle'||own==='all'||ids.indexOf(own)>=0)return true;return names.some(function(n){return own===n||(own.length>2&&n.length>2&&(own.indexOf(n)>=0||n.indexOf(own)>=0))})})}`;
  const oldDate=String.raw`function taskDate(t){return iso(t&&(t.dueDate||t.date||t.targetDate||t.plannedDate||t.deadline))}`;
  const newDate=String.raw`function taskDate(t){var v=q(t&&(t.dueDate||t.dueAt||t.date||t.targetDate||t.plannedDate||t.plannedAt||t.deadline));if(/T\d{2}:\d{2}/.test(v)&&/(?:Z|[+-]\d{2}:?\d{2})$/.test(v)){var d=new Date(v);if(!isNaN(d.getTime()))return localISO(d)}return iso(v)}`;
  const oldNotify=String.raw`function nativeNotify(c,label){if(!('Notification' in window)||Notification.permission!=='granted'||!c.tasks)return;try{var n=new Notification('ExportHUB · '+label,{body:c.tasks+' offene Aufgabe'+(c.tasks===1?'':'n')+' · '+c.overdueTasks+' überfällig',tag:'exporthub-'+localISO()+'-'+label.replace(/\D/g,''),renotify:true,silent:true,requireInteraction:false});n.onclick=function(){try{window.focus()}catch(_){ }openView();try{n.close()}catch(_){ }}}catch(e){console.warn('Browser-Benachrichtigung',e)}}`;
  const newNotify=String.raw`function nativeNotify(c,label){if(!('Notification' in window)||Notification.permission!=='granted'||!c.tasks)return;try{var list=urgentTasks(),one=list.length===1?list[0]:null,lines=list.slice(0,3).map(taskLine);if(list.length>3)lines.push('+'+(list.length-3)+' weitere');if(c.overdueTasks)lines.push(c.overdueTasks+' überfällig');var n=new Notification(one?'ExportHUB · '+taskTitle(one):'ExportHUB · '+c.tasks+' offene Aufgaben',{body:lines.join('\n')||label,tag:'exporthub-'+localISO()+'-'+label.replace(/\D/g,''),renotify:true,silent:true,requireInteraction:false});n.onclick=function(){try{window.focus()}catch(_){ }if(one)openTask(taskId(one));else openView();try{n.close()}catch(_){ }}}catch(e){console.warn('Browser-Benachrichtigung',e)}}`;
  const oldHint=String.raw`+'<div class="index236-hint-actions"><button class="btn" data-index236-action="open-center">`;
  const newHint=String.raw`+(empty?'':hintTaskList())+'<div class="index236-hint-actions"><button class="btn" data-index236-action="open-center">`;
  const oldOpen=String.raw`function openTask(id){var t=findTask(id);`;
  const newOpen=String.raw`function openTask(id){removeHint();var t=findTask(id);`;
  const oldCenterList=String.raw`tasks=openTasks()`;
  const newCenterList=String.raw`tasks=urgentTasks()`;
  const oldCardMeta=String.raw`<p>'+esc(taskOwner(t)||'Alle')+`;
  const newCardMeta=String.raw`<p>'+esc(taskOwner(t)||'Alle')+(/^P\d$/i.test(q(t&&t.priority))?' · '+esc(q(t.priority).toUpperCase()):'')+`;
  // the start-up check ran before the real state (__EXPORTHUB_GET_STATE__) and the user were loaded, counted 0 and marked the due slot (e.g. 09:00) as done
  const oldBoot=String.raw`updateBadge();checkSchedule(false);scheduleNext();`;
  const newBoot=String.raw`updateBadge();bootCheck(0);scheduleNext();`;
  const oldReady=String.raw`if(low(main().view)==='notifications')renderView();checkSchedule(false);scheduleNext()}`;
  const newReady=String.raw`if(low(main().view)==='notifications')renderView();bootCheck(0);scheduleNext()}`;
  const oldVisible=String.raw`if(!document.hidden){checkSchedule(false);`;
  const newVisible=String.raw`if(!document.hidden){bootCheck(0);`;
  const oldBootFn=String.raw`function boot(){`;
  const newBootFn=String.raw`function bootCheck(n){var u=user();if((typeof window.__EXPORTHUB_GET_STATE__!=='function'||!arr(main().tasks).length||!q(u.id||u.user||u.login||u.username))&&n<20){later(function(){bootCheck(n+1)},1500);return}checkSchedule(false);updateBadge()}
function boot(){`;
  for(const [before,after,label] of [[oldBoot,newBoot,'boot'],[oldReady,newReady,'exporthub:ready'],[oldVisible,newVisible,'visibilitychange'],[oldBootFn,newBootFn,'bootCheck'],[oldOwner,newOwner,'taskOwner'],[oldForUser,newForUser,'taskForUser'],[oldDate,newDate,'taskDate'],[oldNotify,newNotify,'nativeNotify'],[oldHint,newHint,'hintHtml'],[oldOpen,newOpen,'openTask'],[oldCenterList,newCenterList,'renderView'],[oldCardMeta,newCardMeta,'taskCard']]){
    const n=block.split(before).length-1;
    if(n!==1)throw new Error(file+': RC1566 '+label+' im Benachrichtigungsmodul '+n+'x gefunden');
    block=block.replace(before,()=>after);
  }
  if(!block.includes('function taskOwnerKeys(t)')||!block.includes('hintTaskList()'))throw new Error(file+': RC1566 konkrete Aufgaben-Benachrichtigung fehlt');
  return html.slice(0,a)+block+html.slice(b);
}

// TaskPlanner V2 reminders (spec §15): per-task slots 09:00/13:00/15:30 are delivered by
// ExportHUBTaskRemindersV2 with a synced ledger; the legacy centre keeps its list and manual check but
// no longer fires its own global 09/12/15 summary, and "Erledigt" goes through the V2 core (history, sync)
function patchNotificationTaskPlannerV2(html,file){
  const moduleStart='<script id="index236-notification-controller">';
  const moduleEnd='<!-- INDEX 236 NOTIFICATION CENTER END -->';
  const a=html.indexOf(moduleStart),b=a>=0?html.indexOf(moduleEnd,a+moduleStart.length):-1;
  if(a<0||b<0)throw new Error(file+': TaskPlanner V2 Benachrichtigungsmodul fehlt');
  let block=html.slice(a,b);
  const replacements=[
    [String.raw`{id:'1200',label:'12:00 Uhr',minutes:720},`,String.raw`{id:'1300',label:'13:00 Uhr',minutes:780},`,'slot 13:00'],
    [String.raw`{id:'1500',label:'15:00 Uhr',minutes:900}`,String.raw`{id:'1530',label:'15:30 Uhr',minutes:930}`,'slot 15:30'],
    [String.raw`function checkSchedule(manual){var c=counts();if(manual){showHint(c,'Manuelle Prüfung',true);renderView();return false}`,
     String.raw`function checkSchedule(manual){var c=counts();if(manual){showHint(c,'Manuelle Prüfung',true);renderView();return false}if(window.ExportHUBTaskRemindersV2&&typeof window.ExportHUBTaskRemindersV2.active==='function'&&window.ExportHUBTaskRemindersV2.active()){updateBadge();return false}`,'checkSchedule'],
    [String.raw`function completeTask(id){var t=findTask(id);if(!t)return false;`,
     String.raw`function completeTask(id){var t=findTask(id);if(!t)return false;var v2=window.ExportHUBTaskUIV2;if(v2&&typeof v2.completeTask==='function'){try{var res=v2.completeTask(taskId(t),{},{state:main(),user:user(),persist:function(){try{if(window.ExportHUBClean&&typeof window.ExportHUBClean.queueSave==='function')window.ExportHUBClean.queueSave('Aufgabe aus Benachrichtigung erledigt')}catch(_){ }}});if(res&&res.changed){renderView();updateBadge();return false}}catch(e){console.warn('TaskPlanner V2 Erledigen',e)}}`,'completeTask'],
    [String.raw`ExportHUB erinnert an Arbeitstagen um 09:00, 12:00 und 15:00 Uhr.`,String.raw`ExportHUB erinnert an Arbeitstagen zu den Zeiten, die an der jeweiligen Aufgabe eingestellt sind (Standard 09:00, 13:00 und 15:30 Uhr).`,'center text'],
    [String.raw`Erinnerungen erscheinen um 09:00, 12:00 und 15:00 Uhr, solange ExportHUB geöffnet ist.`,String.raw`Erinnerungen erscheinen zu den Zeiten der jeweiligen Aufgabe (Standard 09:00, 13:00 und 15:30 Uhr), solange ExportHUB geöffnet ist.`,'enable text']
  ];
  for(const [before,after,label] of replacements){
    const n=block.split(before).length-1;
    if(n!==1)throw new Error(file+': TaskPlanner V2 Benachrichtigung '+label+' '+n+'x gefunden');
    block=block.replace(before,()=>after);
  }
  return html.slice(0,a)+block+html.slice(b);
}

// RC1569: dashboard "Aufgaben fällig" / "Meine Aufgaben" (RC885 workspace) also count tasks assigned by user id
// (assignedTo/effectiveAssignee) and dated by dueAt/plannedAt – same rule as the notification center (RC1566)
function patchWorkspaceTaskOwnership(html,file){
  const oldForUser=String.raw`function workspaceTaskForUser(t){var own=low(workspaceTaskOwner(t)),`;
  const newForUser=String.raw`function workspaceTaskForUserId(t){if(!t)return false;var u=workspaceCurrentUser(),ids=[u.id,u.userId].map(low).filter(Boolean);if(!ids.length)return false;var eff=low(t.effectiveAssignee),keys=eff?[eff]:[t.owner,t.assignee,t.assigneeId,t.assignedTo,t.userId,t.eowner].map(low).filter(Boolean);return keys.some(function(k){return ids.indexOf(k)>=0})}
  function workspaceTaskForUser(t){if(workspaceTaskForUserId(t))return true;var own=low(workspaceTaskOwner(t)),`;
  const oldDate=String.raw`function workspaceTaskDate(t){var keys=['dueDate','due','date','plannedDate','targetDate','deadline'];`;
  const newDate=String.raw`function workspaceTaskDate(t){var keys=['dueDate','dueAt','due','date','plannedDate','plannedAt','targetDate','deadline'];`;
  for(const [before,after,label] of [[oldForUser,newForUser,'workspaceTaskForUser'],[oldDate,newDate,'workspaceTaskDate']]){
    const n=html.split(before).length-1;
    if(n!==1)throw new Error(file+': RC1569 '+label+' '+n+'x gefunden');
    html=html.replace(before,()=>after);
  }
  return html;
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

function patchRc1412ShipmentCreateDomPreserve(html,file){
  const startMarker='function startFreshShipment(){';
  const endMarker='function enforceFreshDraft(){';
  const start=html.indexOf(startMarker),end=html.indexOf(endMarker,start);
  if(start<0||end<=start)throw new Error(file+': RC1412 Fresh-Draft-Block fehlt');
  let block=html.slice(start,end);
  const before="var r=root();if(r){r.className='content';r.removeAttribute('data-view');r.removeAttribute('data-rc562-layout');r.replaceChildren()}document.body.removeAttribute('data-rc420-shipment-readonly');\n try{if(window.ExportHUBRC325&&typeof window.ExportHUBRC325.route==='function')window.ExportHUBRC325.route('shipment','new-shipment');else throw new Error('Zentraler Router nicht verfügbar')}catch(e){console.error('RC455 Neue Sendung',e)}";
  const after="var r=root(),mountedLayout=document.getElementById('rc363FixedShipmentLayout')||document.getElementById('rc573ShipmentShell'),preserveMountedShipment=!!(r&&mountedLayout&&r.contains(mountedLayout));if(r&&!preserveMountedShipment){r.className='content';r.removeAttribute('data-view');r.removeAttribute('data-rc562-layout');r.replaceChildren()}document.body.removeAttribute('data-rc420-shipment-readonly');\n if(preserveMountedShipment){try{patch()}catch(e){console.error('RC1412 Neue Sendung im bestehenden Layout',e)}}else{try{if(window.ExportHUBRC325&&typeof window.ExportHUBRC325.route==='function')window.ExportHUBRC325.route('shipment','new-shipment');else throw new Error('Zentraler Router nicht verfügbar')}catch(e){console.error('RC455 Neue Sendung',e)}}";
  const count=block.split(before).length-1;
  if(count!==1)throw new Error(file+': RC1412 Root-Reset/Router-Anker '+count+'x gefunden');
  block=block.replace(before,after);
  if(!block.includes("preserveMountedShipment=!!(r&&mountedLayout&&r.contains(mountedLayout))"))throw new Error(file+': RC1412 DOM-Erhalt-Erkennung fehlt');
  if(!block.includes("if(r&&!preserveMountedShipment)"))throw new Error(file+': RC1412 Root-Clear ist nicht auf echten Ansichtswechsel begrenzt');
  if(!block.includes("if(preserveMountedShipment){try{patch()}"))throw new Error(file+': RC1412 lokaler Fresh-Draft-Patch fehlt');
  if(block.includes("if(r){r.className='content';r.removeAttribute('data-view');r.removeAttribute('data-rc562-layout');r.replaceChildren()}"))throw new Error(file+': RC1412 alter unbedingter Root-Clear ist noch aktiv');
  return html.slice(0,start)+block+html.slice(end);
}

function patchRc1414ShipmentCreateNoRerender(html,file){
  const startMarker='function startFreshShipment(){';
  const endMarker='function enforceFreshDraft(){';
  const start=html.indexOf(startMarker),end=html.indexOf(endMarker,start);
  if(start<0||end<=start)throw new Error(file+': RC1414 Fresh-Draft-Block fehlt');
  let block=html.slice(start,end);

  const eagerPatch="if(preserveMountedShipment){try{patch()}catch(e){console.error('RC1412 Neue Sendung im bestehenden Layout',e)}}else{try{if(window.ExportHUBRC325&&typeof window.ExportHUBRC325.route==='function')window.ExportHUBRC325.route('shipment','new-shipment');else throw new Error('Zentraler Router nicht verfügbar')}catch(e){console.error('RC455 Neue Sendung',e)}}";
  const noEagerPatch="if(!preserveMountedShipment){try{if(window.ExportHUBRC325&&typeof window.ExportHUBRC325.route==='function')window.ExportHUBRC325.route('shipment','new-shipment');else throw new Error('Zentraler Router nicht verfügbar')}catch(e){console.error('RC455 Neue Sendung',e)}}";
  const eagerCount=block.split(eagerPatch).length-1;
  if(eagerCount!==1)throw new Error(file+': RC1414 RC1412-Eager-Patch-Anker '+eagerCount+'x gefunden');
  block=block.replace(eagerPatch,noEagerPatch);

  const finalizeAnchor=" function finalize(){var sh=shipment();";
  const resetHelper=" function resetMountedFreshVolatile(){if(!preserveMountedShipment||!mountedLayout)return;var changed=[];try{Array.from(mountedLayout.querySelectorAll('textarea')).forEach(function(el){if(el.closest&&el.closest('#rc543MailArea,#rc363BlockMail'))return;var owner=el.closest&&el.closest('[data-rc896-field]'),key=((el.getAttribute&&el.getAttribute('data-rc408-shipment-field'))||el.name||el.id||(owner&&owner.getAttribute('data-rc896-field'))||'').toLowerCase(),label=el.closest&&el.closest('label'),text=((label&&label.textContent)||'').toLowerCase();if(!/(comment|remark|bemerk)/.test(key+' '+text))return;el.value='';changed.push(el)});Array.from(mountedLayout.querySelectorAll('input[type=file]')).forEach(function(el){try{el.value=''}catch(_){}changed.push(el)});changed.forEach(function(el){try{el.dispatchEvent(new Event(el.tagName==='INPUT'?'change':'input',{bubbles:true}))}catch(_){}if(el.tagName!=='INPUT')try{el.dispatchEvent(new Event('change',{bubbles:true}))}catch(_){}})}catch(e){console.error('RC1453 Neue Sendung volatile Felder',e)}}\n function resetMountedFreshDom(){if(!preserveMountedShipment)return false;var box=rowBox();if(box){rowNodes().forEach(function(node){node.remove()});box.appendChild(ownedRow(0,blankFreshRow()));reindex()}try{if(window.ExportHUBIndex289&&typeof window.ExportHUBIndex289.patch==='function')window.ExportHUBIndex289.patch()}catch(e){console.error('RC1414 Standort lokal zurücksetzen',e)}resetMountedFreshVolatile();safePatchDuringEdit();return true}\n";
  if(block.split(finalizeAnchor).length-1!==1)throw new Error(file+': RC1414 Finalize-Anker fehlt');
  block=block.replace(finalizeAnchor,resetHelper+finalizeAnchor);

  const finalizeTail="if(el.tagName==='SELECT')el.selectedIndex=0;else el.value=''}})}\n finalize();var nt=window.ExportHUBClean&&window.ExportHUBClean.native&&window.ExportHUBClean.native.setTimeout||window.setTimeout;nt(finalize,90);";
  const finalizeTailNext="if(el.tagName==='SELECT')el.selectedIndex=0;else el.value=''}});resetMountedFreshDom()}\n finalize();if(!preserveMountedShipment){var nt=window.ExportHUBClean&&window.ExportHUBClean.native&&window.ExportHUBClean.native.setTimeout||window.setTimeout;nt(finalize,90)};";
  const tailCount=block.split(finalizeTail).length-1;
  if(tailCount!==1)throw new Error(file+': RC1414 Doppel-Finalize-Anker '+tailCount+'x gefunden');
  block=block.replace(finalizeTail,finalizeTailNext);

  if(block.includes("if(preserveMountedShipment){try{patch()}"))throw new Error(file+': RC1414 großer Shipment-Patch ist beim lokalen Reset noch aktiv');
  if(!block.includes('function resetMountedFreshDom()'))throw new Error(file+': RC1414 lokaler DOM-Reset fehlt');
  if(!block.includes('safePatchDuringEdit();return true'))throw new Error(file+': RC1414 sicherer Visual-Patch fehlt');
  if(!block.includes('if(!preserveMountedShipment){var nt='))throw new Error(file+': RC1414 zweiter Finalizer ist nicht auf echten Ansichtsaufbau begrenzt');
  return html.slice(0,start)+block+html.slice(end);
}

function patchRc1418ShipmentSaveNoRerender(html,file){
  const before="window.addEventListener('exporthub:sync',function(event){if(event&&event.detail&&event.detail.remote===true)scheduleRemoteMerge(0)})";
  const after="window.addEventListener('exporthub:sync',function(event){var detail=event&&event.detail||{},localSaveConfirmation=detail.remote===true&&detail.reason==='save-confirmation'&&window.__EXPORTHUB_SHIPMENT_SAVE_TX__===true;if(localSaveConfirmation)return;if(detail.remote===true)scheduleRemoteMerge(0)})";
  if(html.includes(after))return html;
  const count=html.split(before).length-1;
  if(count!==1)throw new Error(file+': RC1418 Shipment-Sync-Anker '+count+'x gefunden');
  html=html.replace(before,after);
  if(!html.includes("localSaveConfirmation=detail.remote===true&&detail.reason==='save-confirmation'&&window.__EXPORTHUB_SHIPMENT_SAVE_TX__===true"))throw new Error(file+': RC1418 lokaler Save-Confirmation-Guard fehlt');
  return html;
}

function patchRc1505SaveConfirmationRenderGate(html,file){
  const syncBefore="reason:reason||'poll',remote:true";
  const syncAfter="reason:reason||'poll',remote:true,concurrentMerge:options.concurrentMerge===true";
  if(!html.includes(syncAfter)){
    const hits=html.split(syncBefore).length-1;
    if(hits!==1)throw new Error(file+': RC1505 Sync-Metadaten-Anker '+hits+'x gefunden');
    html=html.replace(syncBefore,syncAfter);
  }
  const applyBefore="applyRemoteDocument(authoritative,'save-confirmation',{allowWhileSaving:true})";
  const applyAfter="applyRemoteDocument(authoritative,'save-confirmation',{allowWhileSaving:true,concurrentMerge:authoritative&&authoritative.concurrentMerge===true})";
  let afterCount=html.split(applyAfter).length-1;
  if(afterCount!==2){
    const hits=html.split(applyBefore).length-1;
    if(hits!==2)throw new Error(file+': RC1505 Save-Confirmation-Apply-Anker '+hits+'x gefunden');
    html=html.split(applyBefore).join(applyAfter);
    afterCount=html.split(applyAfter).length-1;
  }
  if(afterCount!==2)throw new Error(file+': RC1505 concurrentMerge nicht an beide Save-Pfade weitergegeben');
  const shipmentBefore="window.addEventListener('exporthub:sync',function(event){var detail=event&&event.detail||{},localSaveConfirmation=detail.remote===true&&detail.reason==='save-confirmation'&&window.__EXPORTHUB_SHIPMENT_SAVE_TX__===true;if(localSaveConfirmation)return;if(detail.remote===true)scheduleRemoteMerge(0)})";
  const shipmentAfter="window.addEventListener('exporthub:sync',function(event){var detail=event&&event.detail||{},localSaveConfirmation=detail.remote===true&&detail.reason==='save-confirmation'&&window.__EXPORTHUB_SHIPMENT_SAVE_TX__===true,saveConfirmationNoMerge=detail.remote===true&&detail.reason==='save-confirmation'&&detail.concurrentMerge!==true;if(saveConfirmationNoMerge)return;if(localSaveConfirmation)return;if(detail.remote===true)scheduleRemoteMerge(0)})";
  if(!html.includes(shipmentAfter)){
    const hits=html.split(shipmentBefore).length-1;
    if(hits!==1)throw new Error(file+': RC1505 Shipment-Sync-Anker '+hits+'x gefunden');
    html=html.replace(shipmentBefore,shipmentAfter);
  }
  const postBefore="window.addEventListener('exporthub:sync',function(){schedulePost(220,true)})";
  const postAfter="window.addEventListener('exporthub:sync',function(event){var detail=event&&event.detail||{};if(detail.reason==='save-confirmation'&&detail.concurrentMerge!==true)return;schedulePost(220,true)})";
  if(!html.includes(postAfter)){
    const hits=html.split(postBefore).length-1;
    if(hits!==1)throw new Error(file+': RC1505 Postprocessing-Anker '+hits+'x gefunden');
    html=html.replace(postBefore,postAfter);
  }
  return html;
}

function patchRc1470NewShipmentCleanSlate(html,file){
  const startMarker='function startFreshShipment(){';
  const endMarker='function enforceFreshDraft(){';
  const start=html.indexOf(startMarker),end=html.indexOf(endMarker,start);
  if(start<0||end<=start)throw new Error(file+': RC1470 Fresh-Draft-Block fehlt');
  let block=html.slice(start,end);
  if(block.includes('var rc1470FreshDefaults={'))return html;
  const finalizeAnchor=" function finalize(){var sh=shipment();";
  if(block.split(finalizeAnchor).length-1!==1)throw new Error(file+': RC1470 Finalize-Anker fehlt');
  const helper=" function rc1470ResetFreshShipment(sh){if(!sh||typeof sh!=='object')return;var rc1470FreshDefaults={customerId:'',customerNo:'',customerName:'',customerSearch:'',carrier:'',carrierName:'',comments:'',notes:'',goodsDescription:'',incoterm:'',licensePlate:'',loader:'',documents:[],files:[],docs:[],deliveryFiles:[],deliveryNotesFiles:[],lieferscheine:[],podFiles:[],abdFiles:[],cmrFiles:[],invoiceFiles:[],mailAttachments:[],attachments:[],totalWeight:0,totalColli:0,totalLdm:0,goodsValue:0,status:'Entwurf',processStatus:'Entwurf',shipmentStatus:'Entwurf',draft:true,pod:[],pods:[],podFile:null,podUrl:'',podBackup:{},podStatus:'',podAvailable:false,podConfirmed:false,hasPod:false,podServerVerified:false,podServerVerifiedAt:'',podUpdatedAt:'',automaticPodBlobName:'',pickupHistory:[],pickupResetHistory:[],subShipments:[],pickupConfirmed:false,pickupConfirmedAt:'',qrPickupConfirmed:false,qrPickupConfirmedAt:'',pickupCompleted:false,pickupCompletedAt:'',pickupQrUsed:false,pickupQrUsedAt:'',pickupQrRegistered:false,pickupRegistered:false,pickupStatus:'',pickupToken:'',pickupAccessKeyHash:'',pickupSequence:0,pickupCollectedColliCount:0,collectedPickupCollis:0,pickedUp:false,pickedUpAt:'',pickedUpAtDate:'',actualPickupDate:'',actualPickupAt:'',actualPickupTime:'',manualPickupConfirmedAt:'',manualPickupConfirmedBy:'',signatureAvailable:false,signatureBlobName:'',driverSignature:'',pickupDriverSignature:'',driverSignatureUrl:'',pickupDriverSignatureUrl:'',customsDocumentsSignatureBlobName:'',customsDocumentsReceived:false,customsDocumentsSignatureStored:false,podReviewRequired:false,podReviewReason:''};Object.assign(sh,rc1470FreshDefaults)}\n";
  block=block.replace(finalizeAnchor,helper+" function finalize(){var sh=shipment();rc1470ResetFreshShipment(sh);");
  if(!block.includes('cmrFiles:[]')||!block.includes("status:'Entwurf'")||!block.includes('rc1470ResetFreshShipment(sh)'))throw new Error(file+': RC1470 Clean-Slate-Patch unvollständig');
  return html.slice(0,start)+block+html.slice(end);
}

function patchRc1471ReminderEligibility(html,file){
  const before="function reminderEligible(sh){if(!sh||isDone(sh)||sh.actualPickupDate||sh.pickedUpAt)return false;var d=shipmentPickup(sh);return !!d&&dayDiff(d,localISO())>0}";
  const after="function reminderEligible(sh){return !!sh&&!isDone(sh)&&!sh.actualPickupDate&&!sh.pickedUpAt}";
  const count=html.split(before).length-1;
  if(count===0)return html;
  if(count!==1)throw new Error(file+': RC1471 reminderEligible-Anker '+count+'x gefunden');
  html=html.replace(before,after);
  if(!html.includes(after)||html.includes(before))throw new Error(file+': RC1471 Reminder-Eligibility-Patch unvollständig');
  return html;
}

function patchRc1495LegacyQrPersistence(html,file){
  const before="function persisted(sh){var id=sid(sh),ref=sref(sh);if(!sh||!id||/^DRAFT-/i.test(id)||!/^[A-Z0-9]{6}$/.test(ref))return false;return states().some(function(st){return arr(st.shipments).concat(arr(st.savedShipments)).some(function(x){return x===sh||sid(x)===id||sref(x)===ref})})}";
  const rc1495="function persisted(sh){var id=sid(sh),ref=sref(sh);if(!sh||/^DRAFT-/i.test(id)||!/^[A-Z0-9]{6}$/.test(ref))return false;return states().some(function(st){return arr(st.shipments).concat(arr(st.savedShipments)).some(function(x){var xid=sid(x),xref=sref(x);if(x===sh)return true;if(id&&xid&&xid===id)return true;return xref===ref})})}";
  const rc1496="function persisted(sh){var id=sid(sh),ref=sref(sh);if(!sh||!/^[A-Z0-9]{6}$/.test(ref))return false;return states().some(function(st){return arr(st.shipments).concat(arr(st.savedShipments)).some(function(x){var xid=sid(x),xref=sref(x);if(x===sh)return true;if(ref&&xref===ref)return true;if(id&&!/^DRAFT-/i.test(id)&&xid&&xid===id)return true;return false})})}";
  const after="function persisted(sh){var id=sid(sh),ref=sref(sh);if(!sh||!/^[A-Z0-9]{6}$/.test(ref))return false;var roots=states(),names=['shipments','savedShipments','salesSharedShipments','sharedShipments'];roots=Array.isArray(roots)?roots.slice():[];function add(st){if(st&&typeof st==='object'&&roots.indexOf(st)<0)roots.push(st)}try{add(window.ExportHUBClean&&window.ExportHUBClean.runtime&&window.ExportHUBClean.runtime.state);add(window.ExportHUBClean&&window.ExportHUBClean.state);add(window.appState);add(window.state)}catch(_){}return roots.some(function(st){return names.some(function(name){return arr(st&&st[name]).some(function(x){var xid=sid(x),xref=sref(x);if(x===sh)return true;if(ref&&xref===ref)return true;if(id&&!/^DRAFT-/i.test(id)&&xid&&xid===id)return true;return false})})})}";
  if(html.includes(after))return html;
  if(html.includes(rc1496))html=html.replace(rc1496,after);
  else if(html.includes(rc1495))html=html.replace(rc1495,after);
  else{
    const count=html.split(before).length-1;
    if(count!==1)throw new Error(file+': RC1495/RC1496/RC1498 persisted()-Anker '+count+'x gefunden');
    html=html.replace(before,after);
  }
  if(!html.includes(after)||html.includes(before)||html.includes(rc1495)||html.includes(rc1496))throw new Error(file+': RC1498 Legacy-QR-Persistenz-Patch unvollständig');
  return html;
}

function patchRc1498QrStatusSync(html,file){
  const before="function done(data,compat){var serverToken=q(data&&data.token);";
  const after="function done(data,compat){function rc1498QrCopies(one){var out=[],id=sid(one),ref=sref(one),roots=states(),names=['shipments','savedShipments','salesSharedShipments','sharedShipments'];var add=function(x){if(!x||typeof x!=='object'||out.indexOf(x)>=0)return;var xid=sid(x),xref=sref(x);if(x===one||(ref&&xref===ref)||(id&&!/^DRAFT-/i.test(id)&&xid&&xid===id))out.push(x)};add(one);roots=Array.isArray(roots)?roots.slice():[];var addRoot=function(st){if(st&&typeof st==='object'&&roots.indexOf(st)<0)roots.push(st)};try{addRoot(window.ExportHUBClean&&window.ExportHUBClean.runtime&&window.ExportHUBClean.runtime.state);addRoot(window.ExportHUBClean&&window.ExportHUBClean.state);addRoot(window.appState);addRoot(window.state)}catch(_){}roots.forEach(function(st){names.forEach(function(name){arr(st&&st[name]).forEach(add)})});return out}var serverToken=q(data&&data.token);";
  if(!html.includes(after)){
    const count=html.split(before).length-1;
    if(count!==1)throw new Error(file+': RC1498 QR-done()-Anker '+count+'x gefunden');
    html=html.replace(before,after);
  }
  const start=html.indexOf(after);
  const status="one.status='Bereit zur Abholung';one.processStatus='Bereit zur Abholung'";
  const statusAt=html.indexOf(status,start);
  if(start<0||statusAt<start)throw new Error(file+': RC1498 QR-Erfolgsblock fehlt');
  const returnAt=html.indexOf('return true}',statusAt);
  if(returnAt<statusAt)throw new Error(file+': RC1498 QR-done()-Ende fehlt');
  const end=returnAt+'return true}'.length;
  let block=html.slice(start,end);
  block=block.replace('copies(sh).map(function(x)','rc1498QrCopies(sh).map(function(x)');
  block=block.replace('copies(sh).forEach(function(x)','rc1498QrCopies(sh).forEach(function(x)');
  if(!block.includes('rc1498QrCopies(sh).map(function(x)')||!block.includes('rc1498QrCopies(sh).forEach(function(x)'))throw new Error(file+': RC1498 QR-Kopien-Synchronisierung unvollständig');
  html=html.slice(0,start)+block+html.slice(end);
  return html;
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

  const rc1452GoodsHelper="function rc1452PrintGoodsDescription(sh){var v=q(sh&&(sh.goodsDescription||sh.warenbeschreibung||sh.description));if(!v)return'';var l=v.toLowerCase(),score=0;if(l.indexOf('lieferavis')>=0||l.indexOf('collection notice')>=0)score+=2;if(l.indexOf('sehr geehrte damen und herren')>=0||l.indexOf('dear sir or madam')>=0||l.indexOf('mit freundlichen grüßen')>=0||l.indexOf('mit freundlichen grüssen')>=0||l.indexOf('mit freundlichen grussen')>=0||l.indexOf('kind regards')>=0)score++;if(l.indexOf('http://')>=0||l.indexOf('https://')>=0||l.indexOf('/avis/')>=0||l.indexOf('customer-avis')>=0)score++;if(l.indexOf('abholdatum')>=0||l.indexOf('zeitfenster')>=0||l.indexOf('kennzeichen des abholfahrzeugs')>=0||l.indexOf('pickup date')>=0||l.indexOf('time window')>=0||l.indexOf('license plate')>=0)score++;return score>=2?'':v}";
  loadBlock=rc1452GoodsHelper+String.fromCharCode(10)+loadBlock;
  loadBlock=loadBlock.replace(/esc\\(q\\(sh&&sh\\.goodsDescription\\)\\)/g,'esc(rc1452PrintGoodsDescription(sh))');
  loadBlock=loadBlock.replace(/q\\(sh&&sh\\.goodsDescription\\)/g,'rc1452PrintGoodsDescription(sh)');
  loadBlock=loadBlock.replace(/esc\\(q\\(sh&&sh\\.warenbeschreibung\\)\\)/g,'esc(rc1452PrintGoodsDescription(sh))');
  loadBlock=loadBlock.replace(/q\\(sh&&sh\\.warenbeschreibung\\)/g,'rc1452PrintGoodsDescription(sh)');
  loadBlock=loadBlock.replace(/esc\\(q\\(sh&&sh\\.description\\)\\)/g,'esc(rc1452PrintGoodsDescription(sh))');
  if(!loadBlock.includes('function rc1452PrintGoodsDescription(sh)'))throw new Error(file+': RC1452 Druck-Sanitizer fehlt');

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
 var helper=window.ExportHUBDocumentBlob1059,out=[],seen=Object.create(null),keys=['deliveryFiles','deliveryNotesFiles','lieferscheine','files','attachments'];
 function legacyUrl(file){try{if(helper&&typeof helper.legacyUrl==='function')return q(helper.legacyUrl(file))}catch(_){}if(typeof file==='string')return /^(?:data:application\\/pdf|blob:|https?:)/i.test(q(file))?q(file):'';return q(file&&(file.data||file.dataUrl||file.url||file.downloadUrl||file.contentUrl||file.href||file.objectUrl||file.link))}
 function add(raw){
  if(!raw)return;var file=typeof raw==='string'?{name:q(raw),url:/^(?:data:application\\/pdf|blob:|https?:)/i.test(q(raw))?q(raw):''}:raw;if(!file||typeof file!=='object')return;
  if(/deleted|gelöscht|geloscht|replaced|ersetzt|storniert|cancelled|canceled/i.test(q(file.status)))return;
  var name=q(file.name||file.fileName||file.filename||file.number||'Dokument.pdf'),mime=low(file.contentType||file.mimeType||file.mime||file.type),blobBacked=false,blobName='',url=legacyUrl(file);
  try{blobBacked=!!(helper&&typeof helper.isBlobDocument==='function'&&helper.isBlobDocument(file));if(blobBacked&&typeof helper.blobName==='function')blobName=q(helper.blobName(file))}catch(_){blobBacked=false}
  var pdf=/application\\/pdf/i.test(mime)||/\\.pdf(?:$|[?#])/i.test(name)||/^data:application\\/pdf/i.test(url)||/\\.pdf(?:$|[?#])/i.test(url);
  if(!pdf||(!blobBacked&&!url))return;
  var nameKey=low(name).replace(/\s+/g,' '),strongId=q(file.sha256||file.hash||file.documentId||file.itemId||file.id);
  // RC1715: dedupe actual file identity, never only the visible filename.
  // The same original may appear in multiple collections with different IDs.
  // Different originals with an identical filename must remain printable.
  var identity=blobBacked&&blobName?'blob:'+blobName:(url?'url:'+url:(strongId?'id:'+strongId:(nameKey?'name:'+nameKey:'')));
  if(!identity||seen[identity])return;seen[identity]=true;out.push({file:file,name:name,identity:identity,blobBacked:blobBacked,legacyUrl:url})
 }
 keys.forEach(function(key){arr(sh&&sh[key]).forEach(add)});return out
}
async function rc1703VerifiedPdfBlob(blob,name){
 // Never print a Microsoft login page, JSON error, or missing original as PDF.
 var bytes=blob&&typeof blob.slice==='function'&&typeof blob.arrayBuffer==='function'?new Uint8Array(await blob.slice(0,5).arrayBuffer()):[];
 if(bytes.length!==5||String.fromCharCode.apply(null,bytes)!=='%PDF-'){var e=new Error('Original-PDF ist nicht verfügbar: '+name);e.code='DOCUMENT_NOT_PDF';throw e}
 return blob
}
async function rc1340PrepareDeliveryAttachmentPrints(sh){
 var helper=window.ExportHUBDocumentBlob1059,list=rc1340PrintableDeliveryAttachments(sh),prepared=[];
 prepared.failed=[];
  for(var i=0;i<list.length;i++){var item=list[i],url=item.legacyUrl,owned=false;
   try{
   if(item.blobBacked){if(!helper||typeof helper.fetchBlob!=='function')throw new Error('Dokumentenspeicher ist nicht verfügbar: '+item.name);var blob=await helper.fetchBlob(item.file);url=URL.createObjectURL(await rc1703VerifiedPdfBlob(blob,item.name));owned=true}
   else if(/^data:application\\/pdf/i.test(url)){var dataResponse=await fetch(url);if(!dataResponse.ok)throw new Error(item.name+' konnte nicht aus dem lokalen PDF-Inhalt geladen werden.');var dataBlob=await dataResponse.blob();url=URL.createObjectURL(await rc1703VerifiedPdfBlob(dataBlob,item.name));owned=true}
   else if(/^blob:/i.test(url)){var localResponse=await fetch(url);if(!localResponse.ok)throw new Error(item.name+' konnte nicht aus dem PDF-Speicher geladen werden.');url=URL.createObjectURL(await rc1703VerifiedPdfBlob(await localResponse.blob(),item.name));owned=true}
   else if(url){
    var options={credentials:'same-origin',cache:'no-store',redirect:'manual'},documentApi=false;
    try{var resolved=new URL(url,window.location.href);documentApi=resolved.origin===window.location.origin&&resolved.pathname==='/api/exporthub-document'}catch(_){}
    // RC1703: migrated delivery-note URLs must carry the existing ExportHUB
    // session, otherwise Azure may return a Microsoft login document instead.
    if(documentApi){if(!helper||typeof helper.headers!=='function')throw new Error('ExportHUB-Sitzung für Lieferschein fehlt.');options.headers=helper.headers()}
    var response=await fetch(url,options);
    if(response.type==='opaqueredirect'||response.redirected===true||/\\/\\.auth\\/|login\\.microsoftonline\\.com/i.test(q(response.url))){var redirectError=new Error('Die Dokumenten-API hat zur Anmeldung umgeleitet.');redirectError.code='DOCUMENT_API_LOGIN_REDIRECT';throw redirectError}
    if(!response.ok)throw new Error(item.name+' konnte nicht geladen werden (HTTP '+response.status+').');
    var fetched=await response.blob();url=URL.createObjectURL(await rc1703VerifiedPdfBlob(fetched,item.name));owned=true
   }
   if(!url)throw new Error('Kein druckbarer Dateiinhalt für '+item.name+'.');
   prepared.push({name:item.name,identity:item.identity,url:url,owned:owned})
   }catch(e){if(owned)try{URL.revokeObjectURL(url)}catch(_){};prepared.failed.push({name:item.name,code:q(e&&e.code)||'DOCUMENT_FETCH_FAILED'});try{console.warn('RC1684 Lieferschein für Druck nicht erreichbar',item.name,e)}catch(_){}}
  }
  return prepared
}
async function rc1340PrintPreparedAttachment(item,index,total,failed){
 if(typeof window.__EXPORTHUB_CAPTURE_ATTACHMENT_PRINT__==='function'){await Promise.resolve(window.__EXPORTHUB_CAPTURE_ATTACHMENT_PRINT__({name:item.name,index:index,total:total,identity:item.identity,url:item.url,transport:'capture'}));return true}
 // RC1715: a hidden 1x1 PDF iframe with a postMessage and 600ms cleanup
 // cannot prove a multi-page PDF was rendered or printed. Show the original
 // PDF with the browser's native PDF page/print controls; keep it loaded until
 // the user explicitly moves on. Never cut/recreate the PDF's pages in HTML.
 return new Promise(function(resolve,reject){
  var overlay=document.createElement('div'),card=document.createElement('section'),header=document.createElement('div');
  var title=document.createElement('strong'),help=document.createElement('p'),viewer=document.createElement('iframe');
  var actions=document.createElement('div'),open=document.createElement('a'),next=document.createElement('button'),cancel=document.createElement('button');
  var done=false,priorFocus=document.activeElement;
  function finish(error){if(done)return;done=true;try{overlay.remove()}catch(_){};try{if(priorFocus&&typeof priorFocus.focus==='function')priorFocus.focus()}catch(_){};if(error)reject(error);else resolve(true)}
  overlay.setAttribute('data-rc1715-delivery-print-preview','1');
  overlay.setAttribute('role','presentation');
  overlay.style.cssText='position:fixed;inset:0;z-index:2147483600;background:rgba(15,23,42,.88);display:flex;align-items:center;justify-content:center;padding:12px';
  card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');
  card.setAttribute('aria-label','Lieferschein als Original-PDF drucken');
  card.style.cssText='background:#fff;color:#0f172a;width:min(1120px,100%);height:min(92vh,100%);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;box-sizing:border-box';
  header.style.cssText='display:flex;flex-direction:column;gap:3px;flex-shrink:0';
  title.textContent='Lieferschein '+(index+1)+' / '+total+' · '+item.name;
  help.textContent='Original-PDF im Viewer drucken. Im Druckdialog alle Seiten wählen; keine Seiten werden durch ExportHUB neu formatiert.';
  help.style.cssText='font-size:13px;margin:0';
  header.appendChild(title);header.appendChild(help);
  if(index===0&&failed&&failed.length){var warning=document.createElement('p');warning.style.cssText='color:#991b1b;font-weight:600;margin:2px 0';warning.textContent='Nicht verfügbar und nicht im Druck: '+failed.map(function(x){return x.name}).join(', ');header.appendChild(warning)}
  viewer.setAttribute('title','Original-PDF: '+item.name);viewer.setAttribute('data-rc1715-original-pdf','1');
  viewer.style.cssText='width:100%;height:100%;min-height:160px;flex:1 1 auto;border:1px solid #cbd5e1;background:#fff';
  viewer.src=item.url;
  actions.style.cssText='display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:10px;flex-shrink:0';
  open.href=item.url;open.target='_blank';open.rel='noopener noreferrer';open.textContent='PDF im neuen Tab öffnen';
  // Keep the Blob URL valid when the browser PDF viewer is opened separately.
  open.addEventListener('click',function(){item.persistUrl=true});
  open.style.cssText='color:#1d4ed8;text-decoration:underline;margin-right:auto';
  next.type='button';next.textContent=index+1<total?'Nächster Lieferschein':'PDF-Vorschau schließen';
  next.style.cssText='background:#1d4ed8;color:white;border:0;border-radius:6px;padding:11px 16px;cursor:pointer';
  cancel.type='button';cancel.textContent='Abbrechen';
  cancel.style.cssText='background:#f1f5f9;color:#0f172a;border:1px solid #94a3b8;border-radius:6px;padding:10px 14px;cursor:pointer';
  next.addEventListener('click',function(){finish()});
  cancel.addEventListener('click',function(){var error=new Error('Lieferschein-Druckvorschau abgebrochen');error.code='DOCUMENT_PRINT_CANCELLED';finish(error)});
  actions.appendChild(open);actions.appendChild(cancel);actions.appendChild(next);
  card.appendChild(header);card.appendChild(viewer);card.appendChild(actions);overlay.appendChild(card);
  document.body.appendChild(overlay);next.focus();
 })
}
async function rc1340PrintPreparedAttachments(items){
 items=arr(items);try{for(var i=0;i<items.length;i++)await rc1340PrintPreparedAttachment(items[i],i,items.length,items.failed);return items.length}
 finally{items.forEach(function(item){if(!item||!item.owned)return;if(item.persistUrl){if(typeof window.addEventListener==='function')window.addEventListener('pagehide',function(){try{URL.revokeObjectURL(item.url)}catch(_){}} ,{once:true});return}try{URL.revokeObjectURL(item.url)}catch(_){}})}
}
window.ExportHUBRC1340AttachmentPrint=Object.freeze({version:'RC1340',printable:rc1340PrintableDeliveryAttachments,prepare:rc1340PrepareDeliveryAttachmentPrints,printPrepared:rc1340PrintPreparedAttachments,printShipment:async function(sh){var jobs=await rc1340PrepareDeliveryAttachmentPrints(sh);var count=await rc1340PrintPreparedAttachments(jobs);if(jobs.failed&&jobs.failed.length){var error=new Error('Nicht alle Lieferschein-PDFs verfügbar: '+jobs.failed.map(function(x){return x.name}).join(', '));error.code='DELIVERY_DOCUMENTS_INCOMPLETE';error.failed=jobs.failed;error.opened=count;throw error}if(!count){var missing=new Error('Keine druckbaren Lieferschein-PDFs vorhanden.');missing.code='DELIVERY_DOCUMENTS_EMPTY';throw missing}return count}});
`;
  if(!html.includes('window.ExportHUBRC1340AttachmentPrint=')){
    const count=html.split(rc1340Anchor).length-1;
    if(count!==1)throw new Error(file+': RC1340 Druckanker '+count+'x gefunden');
    const rc1373PrintEntry="async function printDocuments(mode){var rc1373Override=String(window.__EXPORTHUB_PRINT_MODE_OVERRIDE__||'').trim().toLowerCase();if(rc1373Override){mode=rc1373Override;window.__EXPORTHUB_PRINT_MODE_OVERRIDE__=''}";
    html=html.replace(rc1340Anchor,rc1340Runtime+'\n'+rc1373PrintEntry);
  }
  // RC1710: Ladeliste/CMR and cover printing must never fetch or print
  // attached Lieferscheine. They remain accessible through the separate
  // document actions and ExportHUBRC1340AttachmentPrint.printShipment().
  const printReadiness="await ensureOutputReady(sh,'normal');docWorkStep(opToken,'Druckseiten werden geöffnet …');";
  const printFinish="window.__INDEX352_LAST_PRINT__={ok:true,mode:mode||'all',pages:root.children.length,ref:sref(sh)||sid(sh),owner:VERSION,signed:false};docWorkDone(opToken,'Druckdialog wird geöffnet');frame.contentWindow.focus();frame.contentWindow.print()";
  if(!html.includes(printReadiness)||!html.includes(printFinish))throw new Error(file+': RC1710 Ladeliste-Druck darf nicht an Lieferdokument-API gekoppelt sein');
  if(html.includes('attachmentJobsPromise')||html.includes('var attachmentJobs=await attachmentJobsPromise;')||html.includes('Folgende Lieferscheine konnten wegen eines Abruffehlers nicht mitgedruckt werden'))throw new Error(file+': RC1710 Keine automatische Lieferschein-Abfrage beim Ladelisten-/CMR-Druck');
  if(!html.includes("__EXPORTHUB_PRINT_MODE_OVERRIDE__")||!html.includes("if(mode==='cover')return[d.cover].filter(Boolean)"))throw new Error(file+': RC1373 Nur-Deckblatt-Druck ist nicht im finalen Print-Pfad verankert');
  // RC1715: never silently discard PDF pages, display original in a visible viewer.
  if(!html.includes('data-rc1715-delivery-print-preview')||!html.includes('data-rc1715-original-pdf')||!html.includes('DELIVERY_DOCUMENTS_INCOMPLETE'))throw new Error(file+': RC1715 Lieferschein-Druckvorschau oder Teilfehler fehlt');
  var rc1715BridgeStart=html.indexOf('async function rc1340PrintPreparedAttachment(item,index,total,failed){'),rc1715BridgeEnd=rc1715BridgeStart<0?-1:html.indexOf('async function rc1340PrintPreparedAttachments(items){',rc1715BridgeStart);
  if(rc1715BridgeStart<0||rc1715BridgeEnd<0||html.slice(rc1715BridgeStart,rc1715BridgeEnd).includes('contentWindow.postMessage')||html.slice(rc1715BridgeStart,rc1715BridgeEnd).includes('contentWindow.print')||html.slice(rc1715BridgeStart,rc1715BridgeEnd).includes('later(function(){finish()},600)'))throw new Error(file+': RC1715 versteckter PDF-Druck oder verfrühte Freigabe wieder aktiv');
  return html;
}

function patchRc1700PreviouslyRegisteredQrPrintGate(html,file){
  // RC1700 P0: A warehouse Location-API outage must not prevent printing
  // documents whose pickup QR is already registered server-side. New QR
  // shipments keep the existing strict registration requirement.
  const oldGate="if(warehouse&&typeof warehouse.register==='function'&&!/abgeholt|pod vorhanden|abgeschlossen|archiviert|storn/i.test(status(sh))){var locationReady=await timed(Promise.resolve(warehouse.register(sh,false)),8000,'QR-Location konnte nicht rechtzeitig registriert werden.');if(locationReady!==true)throw new Error('QR-Location konnte nicht serverseitig registriert werden. Bitte Verbindung prüfen und erneut drucken.')}";
  const newGate="if(warehouse&&typeof warehouse.register==='function'&&!/abgeholt|pod vorhanden|abgeschlossen|archiviert|storn/i.test(status(sh))){var rc1700KnownQr=sh.pickupQrRegistered===true&&/^[a-f0-9]{48}$/i.test(q(sh.pickupToken||sh.pickupQrToken||sh.qrToken));if(rc1700KnownQr){Promise.resolve().then(function(){return warehouse.register(sh,false)}).then(function(ok){if(ok!==true){console.warn('RC1700 bereits registrierte QR-Sendung: Lager-Location-Synchronisierung fehlgeschlagen');message('Ladeliste bereit. Die Lager-Location konnte nicht synchronisiert werden.','info')}}).catch(function(e){console.warn('RC1700 Lager-Location-Synchronisierung',e);message('Ladeliste bereit. Die Lager-Location konnte nicht synchronisiert werden.','info')})}else{var locationReady=await timed(Promise.resolve(warehouse.register(sh,false)),8000,'QR-Location konnte nicht rechtzeitig registriert werden.');if(locationReady!==true)throw new Error('QR-Location konnte nicht serverseitig registriert werden. Bitte Verbindung prüfen und erneut drucken.')}}";
  const count=html.split(oldGate).length-1;
  if(count!==1)throw new Error(file+': RC1700 erwartete genau eine QR-Lager-Freigabestelle, gefunden '+count);
  html=html.replace(oldGate,newGate);
  if(!html.includes('rc1700KnownQr=sh.pickupQrRegistered===true')||!html.includes('if(locationReady!==true)throw new Error'))throw new Error(file+': RC1700 Drucksicherheitsvertrag fehlt');
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
 raw.forEach(function(row){var h=historyItem(row);if(h){var actor=q(row&&row.actor&&row.actor.name||row&&row.actorName||row&&row.user||row&&row.by),detail=[h.detail,actor?('Benutzer: '+actor):''].filter(Boolean).join(' · ');add(h.at,h.label,detail,'status|'+h.key+'|'+q(h.at))}});
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
 list.sort(function(a,b){var aa=a.stamp||Number.MAX_SAFE_INTEGER,bb=b.stamp||Number.MAX_SAFE_INTEGER;return aa-bb});
 if(!list.length)return '<div class="rc776-empty">Für diese Sendung sind noch keine fachlichen Bewegungsdaten gespeichert.</div>';
 return '<div class="rc776-history">'+list.slice(-30).map(function(x){return '<div class="rc776-history-row"><time>'+esc(x.at?fmtDate(x.at):'–')+'</time><div><b>'+esc(x.label)+'</b>'+(x.detail?'<small> · '+esc(x.detail)+'</small>':'')+'</div></div>'}).join('')+'</div>'
}
`;
  replaceBlock('function historyHtml(sh){','\n\nvar referenceCache=',historyReplacement,'Statusverlauf');

  const docHelpers=`var rcShipmentDocumentRequestSeq=0;
function fallbackDocUsable(d){
 if(!d)return false;
 if(d.source==='referenceFolder'&&d.itemId)return true;
 if(d.url)return true;
 // RC1616: previously uploaded inline PDFs are real files, not metadata-only rows.
 // Never synthesize documents from DNC numbers without stored file bytes.
 var inline=q(d.file&&(d.file.dataUrl||d.file.data||d.file.content));
 if(/^data:(?:application\\/pdf|image\\/(?:png|jpeg|webp));base64,[A-Za-z0-9+\\/=\\s]+$/i.test(inline))return true;
 var helper=window.ExportHUBDocumentBlob1059,f=d.file;
 try{return !!(helper&&f&&typeof helper.isBlobDocument==='function'&&helper.isBlobDocument(f))}catch(_){return false}
}

function shipmentAssociatedDocs(sh,prior){
 var out=arr(prior).slice(),ref=refOf(sh),sid=idOf(sh),visited=[],sources=typeof roots==='function'?roots():[state()];
 // A recycled technical shipment ID must not associate files with another REF.
 // Legacy ID-only relations are permitted only when every known owner uses
 // this exact REF; an explicit pack-notification link remains authoritative.
 function safeLegacyIdLink(){
  if(!sid||!ref)return false;
  var refs={};
  function include(row,pack){
   if(!row||(pack?q(row.shipmentId):idOf(row))!==sid)return;
   var candidate=pack?q(row.shipmentRef||row.shipmentReference).toUpperCase():refOf(row);
   if(candidate)refs[candidate]=true;
  }
  sources.forEach(function(root){
   if(!root)return;
   arr(root.shipments).concat(arr(root.savedShipments),arr(root.salesSharedShipments),arr(root.sharedShipments),arr(root.shipmentArchive),arr(root.archivedShipments),[root.shipment,root.currentShipment,root.selectedShipment]).forEach(function(row){include(row,false)});
   arr(root.packNotifications).forEach(function(note){include(note,true)})
  });
  var keys=Object.keys(refs);
  return keys.length===1&&keys[0]===ref
 }
 var legacyIdSafe=safeLegacyIdLink();
 function safeLegacyPackId(note){
  if(!legacyIdSafe||q(sh&&sh.packNotificationId))return false;
  var peers=0;
  sources.forEach(function(root){
   arr(root&&root.packNotifications).forEach(function(other){
    if(q(other&&other.shipmentId)===sid&&!q(other&&other.shipmentRef||other&&other.shipmentReference))peers++
   })
  });
  return peers===1&&q(note&&note.shipmentId)===sid
 }
 function addFile(file,group,field,index){
  if(!file)return;
  var entry={file:file,group:group,field:field,index:index,name:fileName(file,group+' '+(index+1)),url:fileUrl(file)};
  try{
   var doc=normalizeFallback(entry),key=q(doc&&doc.file&&doc.file.blobName),name=low(q(doc&&doc.name));
   // The canonical document collector may already expose this same file.
   // Deduplicate only an identical stored Blob + name, never by a recycled shipment ID.
   if(key&&out.some(function(existing){return low(q(existing&&existing.name))===name&&q(existing&&existing.file&&existing.file.blobName)===key}))return;
   out.push(doc)
  }catch(_){}
 }
 function addFields(owner,fields){
  fields.forEach(function(x){arr(owner&&owner[x[0]]).forEach(function(file,i){addFile(file,x[1],x[0],i)})})
 }
 function matches(other){
  if(!other||typeof other!=='object')return false;
  if(other===sh)return true;
  var otherRef=refOf(other),otherId=idOf(other);
  if(ref&&otherRef===ref)return true;
  return !!(legacyIdSafe&&sid&&otherId===sid&&(!ref||!otherRef||otherRef===ref))
 }
 function collect(copy){
  if(!matches(copy)||visited.indexOf(copy)>=0)return;
  visited.push(copy);
  try{arr(collectDocs(copy)).forEach(function(d){out.push(normalizeFallback(d))})}catch(_){}
  // Keep shipment UI discovery aligned with persisted DOCUMENT_FIELDS in
  // api/shared/document-blob-store.js. Each owner remains REF-scoped by matches().
  addFields(copy,[['lieferscheine','Lieferscheine'],['deliveryFiles','Lieferscheine'],['deliveryNoteFiles','Lieferscheine'],['deliveryNotesFiles','Lieferscheine'],['deliveryNotes','Lieferscheine'],['podFiles','POD'],['abdFiles','ABD'],['documents','Dokumente'],['generatedDocuments','Dokumente'],['files','Anhänge'],['attachments','Anhänge'],['invoiceFiles','Rechnungen'],['invoiceDocuments','Rechnungen'],['mailAttachments','Mail-Anhänge'],['cmrFiles','CMR'],['avFiles','AV'],['photos','Fotos'],['pickupPhotos','Abholfotos'],['containerPhotos','Containerfotos']])
 }
 collect(sh);
 sources.forEach(function(root){
  arr(root&&root.shipments).concat(arr(root&&root.savedShipments),arr(root&&root.salesSharedShipments),arr(root&&root.sharedShipments),arr(root&&root.shipmentArchive),arr(root&&root.archivedShipments),[root&&root.shipment,root&&root.currentShipment,root&&root.selectedShipment]).forEach(collect);
  arr(root&&root.abdRequests).forEach(function(request){
   if(!request||typeof request!=='object')return;
   var linkedRef=refOf(request),linkedId=q(request.linkedShipmentId||request.shipmentId);
   if(!((ref&&linkedRef===ref)||(legacyIdSafe&&sid&&linkedId===sid&&(!ref||!linkedRef||linkedRef===ref))))return;
   addFields(request,[['invoiceFiles','Rechnungen'],['abdFiles','ABD'],['documents','ABD-Dokumente'],['attachments','ABD-Anhänge'],['avFiles','Ausgangsvermerk']])
  });
  arr(root&&root.packNotifications).forEach(function(note){
   if(!note||typeof note!=='object')return;
   var linkedRef=q(note.shipmentRef||note.shipmentReference).toUpperCase(),linkedId=q(note.shipmentId),notificationId=q(note.id),wantedId=q(sh&&sh.packNotificationId);
   if(ref&&linkedRef&&linkedRef!==ref)return;
   if(!((ref&&linkedRef===ref)||(wantedId&&notificationId===wantedId)||safeLegacyPackId(note)))return;
   addFields(note,[['documents','Lieferscheine'],['files','Anhänge']])
  })
 });
 return out.filter(Boolean).filter(fallbackDocUsable)
}
function mergeReferenceDocs(live,fallback){
 // A filename is not a storage identity: two independent original files can
 // legitimately have the same name. Deduplicate only proven identical items.
 function identity(d){
  if(!d)return '';
  var item=q(d.itemId||d.file&&d.file.itemId);
  if(d.source==='referenceFolder'&&item)return 'graph:'+item;
  var blob=q(d.file&&d.file.blobName||d.blobName);
  if(blob)return 'blob:'+blob;
  return ''
 }
 var out=[],seen=Object.create(null);
 arr(live).concat(arr(fallback).filter(fallbackDocUsable)).forEach(function(d){
  var key=identity(d);
  if(key&&seen[key])return;
  if(key)seen[key]=true;
  out.push(d)
 });
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
    `function docHtml(d,i){var usable=fallbackDocUsable(d),buttons=[];if(usable){buttons.push('<button type="button" class="ghost" data-rc786-open-file="'+i+'">Öffnen</button>');buttons.push('<button type="button" class="ghost" data-rc786-download-file="'+i+'">Download</button>');if(isPrintable(d))buttons.push('<button type="button" class="ghost" data-rc786-print-file="'+i+'">Drucken</button>')}return '<article class="rc786-doc-row"'+(d.file&&d.file.blobName?' data-rc786-blob-name="'+esc(d.file.blobName)+'"':'')+'><div class="rc786-doc-icon" aria-hidden="true">'+docIcon(d)+'</div><div class="rc786-doc-main"><b>'+esc(d.name||'Dokument')+'</b><small>'+esc(docMeta(d))+'</small></div><div class="rc786-doc-actions">'+buttons.join('')+'</div></article>'}
`,
    'Dokumentaktionen'
  );

  replaceBlock(
    'function docsPanelHtml(docs,source,error){',
    '\nfunction setDocsPanel',
    `function docsPanelHtml(docs,source,error){docs=arr(docs);var sourceText=source==='missingFolder'?'Ref-Ordner über die konfigurierte Microsoft-Verbindung nicht gefunden':source==='referenceFolder'?'Vorhandene Dateien direkt aus dem Ref-Ordner der Sendung':source==='combined'?'Ref-Ordner und gespeicherte Anhänge der Sendung':source==='fallback'?'Gespeicherte Anhänge der Sendung':'';var note=sourceText?'<div class="rc786-doc-source">'+esc(sourceText)+(error?' · Ref-Ordner derzeit nicht erreichbar':'')+'</div>':'';var sh=currentShipmentForDocs(),ref=refOf(sh),signed='pod_'+low(ref)+'_ladeliste_mit_unterschrift.pdf',other='pod_'+low(ref)+'_ladeliste_unterschrieben.pdf',useGroup=arr(sh&&sh.subShipments).length<2&&docs.some(function(d){return low(q(d.name))===signed&&fallbackDocUsable(d)}),shown=[],versions=[];docs.forEach(function(d,i){var html=docHtml(d,i);if(useGroup&&low(q(d.name))===other)versions.push(html);else shown.push(html)});var body=docs.length?'<div class="rc776-docs">'+shown.join('')+(versions.length?'<details class="rc1616-pod-versions"><summary>Weitere gespeicherte POD-Versionen ('+versions.length+')</summary>'+versions.join('')+'</details>':'')+'</div>':'<div class="rc776-empty">'+(error?'Der Ref-Ordner ist nicht erreichbar. In den gespeicherten Sendungsdaten wurde keine abrufbare Datei gefunden.':source==='missingFolder'?'Der konfigurierte Ref-Ordner konnte nicht gefunden werden. Bitte Microsoft-Verbindung und Ordnerpfad prüfen; vorhandene Sendungsanhänge bleiben erhalten.':source==='referenceFolder'?'Die Ordnerabfrage war erfolgreich, hat aber keine abrufbare Datei geliefert. Bitte Referenzzuordnung und Dateispeicherung prüfen.':'Keine abrufbare Datei vorhanden. Bitte Dateispeicherung und Sendungszuordnung prüfen.')+'</div>';return note+body}
`,
    'Dokumentpanel'
  );

  replaceBlock(
    'async function loadReferenceDocs(sh,fallback){',
    '\n\nfunction shipmentSearchStamp',
    `async function loadReferenceDocs(sh,fallback){var ref=refOf(sh),expectedId=idOf(sh),expectedRef=ref,requestSeq=++rcShipmentDocumentRequestSeq;fallback=shipmentAssociatedDocs(sh,fallback);if(!ref)return setDocsPanel(fallback,'fallback',true);function currentForRequest(){var s=state(),current=find(s.shipmentViewId||s.selectedShipmentId||s.activeShipmentId);if(requestSeq!==rcShipmentDocumentRequestSeq||low(s.view)!=='shipmentview'||!current)return null;var currentRef=refOf(current),currentId=idOf(current);return(expectedRef&&currentRef===expectedRef)||(expectedId&&currentId===expectedId&&(!expectedRef||!currentRef||currentRef===expectedRef))?current:null}try{var data=await referenceList(ref,true),current=currentForRequest();if(!current)return false;var latest=shipmentAssociatedDocs(current,fallback);if(data&&data.available===false){setDocsPanel(latest,'fallback',true);return false}var live=arr(data&&data.files).map(function(x){return liveDoc(x,ref)}),merged=mergeReferenceDocs(live,latest),source=data&&data.folderMissing?'missingFolder':live.length?(merged.length>live.length?'combined':'referenceFolder'):(latest.length?'fallback':'referenceFolder');setDocsPanel(merged,source,false)}catch(e){if(!(e&&e.code==='GRAPH_NOT_CONFIGURED'))console.warn('RC1305 Ref-Ordner',e);var current=currentForRequest();if(current)setDocsPanel(shipmentAssociatedDocs(current,fallback),'fallback',true)}return false}
`,
    'Ref-Ordner-Fallback'
  );

  replaceBlock(
    'async function fetchDocBlob(d){',
    '\nasync function downloadDocObject',
    `async function fetchDocBlob(d){if(!d)throw new Error('Datei fehlt.');if(d._blob instanceof Blob)return d._blob;var helper=window.ExportHUBDocumentBlob1059;if(d.file&&helper&&typeof helper.isBlobDocument==='function'&&helper.isBlobDocument(d.file)&&typeof helper.fetchBlob==='function')return await helper.fetchBlob(d.file);if(d.source==='referenceFolder'&&d.itemId){var ref=q(d.reference)||refOf(currentShipmentForDocs()),res=await fetch('/api/reference-files?reference='+encodeURIComponent(ref)+'&itemId='+encodeURIComponent(d.itemId)+'&mode=inline&_='+Date.now(),{method:'GET',headers:referenceHeaders(),credentials:'same-origin',cache:'no-store'});if(!res.ok){var message='Datei konnte nicht geöffnet werden.';try{var data=await res.json();message=q(data.message)||message}catch(_){}throw new Error(message)}return await res.blob()}var inline=q(d.file&&(d.file.dataUrl||d.file.data||d.file.content));if(/^data:(?:application\\/pdf|image\\/(?:png|jpeg|webp));base64,[A-Za-z0-9+\\/=\\s]+$/i.test(inline)){var decoded=await fetch(inline).then(function(r){if(!r.ok)throw new Error('Hochgeladene Datei nicht lesbar.');return r.blob()});if(decoded.size<5||decoded.size>35000000)throw new Error('Hochgeladene Datei hat eine unzulässige Größe.');if(/^data:application\\/pdf/i.test(inline)&&await decoded.slice(0,5).text()!=='%PDF-')throw new Error('Hochgeladene PDF hat keinen gültigen PDF-Header.');return decoded}var url=q(d.url),urlLower=low(url),localApi=url.indexOf('/api/')===0;if(url&&(urlLower.indexOf('data:')===0||urlLower.indexOf('blob:')===0||localApi)){var r=await fetch(url,{headers:localApi?referenceHeaders():{},credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error('Datei konnte nicht geladen werden.');return await r.blob()}return null}
`,
    'Blob-Dokumentöffnung'
  );

  const legacyBlobOpenGuard="if(!((d.source==='referenceFolder'&&d.itemId)||d.url)){alert('Diese Zeile enthält keine vorhandene Datei.');return false}";
  const fixedBlobOpenGuard="if(!fallbackDocUsable(d)){alert('Diese Zeile enthält keine vorhandene Datei.');return false}";
  if(html.includes(legacyBlobOpenGuard))html=html.replace(legacyBlobOpenGuard,fixedBlobOpenGuard);
  else if(!html.includes(fixedBlobOpenGuard))throw new Error(file+': Dokumentöffnen-Guard fehlt');

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
  html=patchRc1576StateBodyDeadline(html,file);
  html=patchRc1619LargeStateWorkerParse(html,file);
  html=patchRc1304ThemeRedesign(html,file);
  html=patchRc1630LoginVisuals(html,file);
  html=patchRc1400MobileNavigationCache(html,file);
  html=patchRc1371Dashboard(html,file);
  html=patchRc1558DashboardOverview(html,file);
  html=patchRc1306LayoutEngine(html,file);
  html=patchRc1560FullWidth(html,file);
  html=patchRc1577OverviewCompact(html,file);
  html=patchRc1579Menu(html,file);
  html=patchCustomerFolderRedesign(html,file);
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
  html=patchNotificationTaskDetails(html,file);
  html=patchWorkspaceTaskOwnership(html,file);
  html=patchNotificationTaskPlannerV2(html,file);
  html=patchWebPush(html,file);
  html=patchTaskMasterSaveScope(html,file);
  html=patchTaskDetailTab(html,file);
  html=patchRc1259ContainerSearch(html,file);
  html=patchCompletePrintBundle(html,file);
  html=patchRc1700PreviouslyRegisteredQrPrintGate(html,file);
  html=patchRc1324PrintScale(html,file);
  html=patchRc1305ShipmentViewReliability(html,file);
  html=patchRc1305LoadingListPresentation(html,file);
  html=patchRc1283LoadingListSearch(html,file);
  html=patchDeckblattHighVisibility(html,file);
  html=patchRc1203ActualDeckblatt(html,file);
  html=patchShipmentSuspendSave(html,file);
  html=patchRc1412ShipmentCreateDomPreserve(html,file);
  html=patchRc1414ShipmentCreateNoRerender(html,file);
  html=patchRc1470NewShipmentCleanSlate(html,file);
  html=patchRc1471ReminderEligibility(html,file);
  html=patchRc1495LegacyQrPersistence(html,file);
  html=patchRc1498QrStatusSync(html,file);
  html=patchRc1418ShipmentSaveNoRerender(html,file);
  html=patchRc1505SaveConfirmationRenderGate(html,file);
  html=patchRc1319ShipmentSaveFinalization(html,file);
  html=patchRc1617AbdUploadFailureFeedback(html,file);
  html=patchRc1619AbdFailClosedRollback(html,file);
  html=patchRc1626AbdUploadBoundedSave(html,file);
  html=patchRc1624AbdUploadCrossCollection(html,file);
  html=patchRc1296BrowserBranding(html,file);
  html=patchRc1602OfficialPod(html,file);
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
  html=html.replace(/assets\/rc1074-login-clean\.js\?v=(?:1074|1112|1298|1301|1303|1311|1349)/g,'assets/rc1074-login-clean.js?v=1630');
  html=html.replace(/assets\/rc1014-task-runtime\.js\?v=(?:1016|1266|1312|1353|1359)/g,'assets/rc1014-task-runtime.js?v=1359');
  const taskRuntimeTag=/<script\b[^>]*src=["']\/assets\/rc1014-task-runtime\.js\?v=[^"']+["'][^>]*><\/script>/i;
  if(!html.includes('id="exporthub-taskplanner-v2-runtime-bridge"')){
    const taskRuntimeMatch=html.match(taskRuntimeTag);
    if(!taskRuntimeMatch)throw new Error(file+': TaskPlanner V2 Runtime-Anker fehlt');
    html=html.replace(taskRuntimeMatch[0],taskRuntimeMatch[0]+'\n<script id="exporthub-taskplanner-v2-runtime-bridge" defer src="/assets/taskplanner-v2-runtime-bridge.js?v=2000"></script>\n<script id="exporthub-taskplanner-v2-workflow" defer src="/assets/taskplanner-v2-workflow.js?v=2000"></script>\n<script id="exporthub-taskplanner-v2-ui" defer src="/assets/taskplanner-v2-ui.js?v=2000"></script>\n<script id="exporthub-taskplanner-v2-projection-ui" defer src="/assets/taskplanner-v2-projection-ui.js?v=2000"></script>\n<script id="exporthub-taskplanner-v2-planner-ui" defer src="/assets/taskplanner-v2-planner-ui.js?v=2000"></script>\n<script id="exporthub-taskplanner-rc1537-canonical-source" defer src="/assets/rc1537-taskplanner-canonical-source.js?v=1537"></script>');
  }
  const taskLifecycleTag=/<script\b[^>]*src=["']\/assets\/rc1014-task-lifecycle\.js\?v=[^"']+["'][^>]*><\/script>/i;
  if(!html.includes('id="exporthub-taskplanner-v2-core"')){
    const taskLifecycleMatch=html.match(taskLifecycleTag);
    if(!taskLifecycleMatch)throw new Error(file+': TaskPlanner V2 Lifecycle-Anker fehlt');
    html=html.replace(taskLifecycleMatch[0],'<link id="exporthub-taskplanner-v2-style" rel="stylesheet" href="/assets/taskplanner-v2.css?v=2000">\n<link id="exporthub-taskplanner-v2-projection-style" rel="stylesheet" href="/assets/taskplanner-v2-projections.css?v=2000">\n<script id="exporthub-taskplanner-v2-core" defer src="/assets/taskplanner-v2-core.js?v=2000"></script>\n<script id="exporthub-taskplanner-v2-recurrence" defer src="/assets/taskplanner-v2-recurrence.js?v=2000"></script>\n<script id="exporthub-taskplanner-v2-planner" defer src="/assets/taskplanner-v2-planner.js?v=2000"></script>\n<script id="exporthub-taskplanner-v2-projections" defer src="/assets/taskplanner-v2-projections.js?v=2000"></script>\n'+taskLifecycleMatch[0]);
  }
  html=html.replace(/assets\/rc1014-task-ui\.css\?v=(?:1016|1179|1312)/g,'assets/rc1014-task-ui.css?v=1312');
  html=html.replace(/assets\/rc1013-diagnostics\.js\?v=(?:1085|1125|1364)/g,'assets/rc1013-diagnostics.js?v=1364');
  html=html.replace(/assets\/exporthub-environment-hub\.js\?v=\d+/g,'assets/exporthub-environment-hub.js?v=1174');
  html=html.replace(/assets\/rc1081-audit-history\.js\?v=(?:1087|1126|1160|1163)/g,'assets/rc1081-audit-history.js?v=1177');
  html=html.replace(/assets\/rc1071-shipment-history\.js\?v=(?:1095|1151|1178|1305|1434)/g,'assets/rc1071-shipment-history.js?v=1468');
  html=html.replace(/assets\/rc1063-abd-blob-viewer-compat\.js\?v=(?:1063|1151|1248|1682|1683)/g,'assets/rc1063-abd-blob-viewer-compat.js?v=1683');
  html=injectDeferredRuntimeInHead(html,'<!-- id="exporthub-rc1148-history-compat-marker" assets/rc1071-shipment-history.js?v=1095 -->','exporthub-rc1148-history-compat-marker');
  html=injectDeferredRuntimeInHead(html,RC1267_I18N_TAG,'exporthub-rc1267-i18n');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1460-shipment-view-fix" defer src="/assets/rc1460-shipment-view-files-avis-preview.js?v=1616"></script>','exporthub-rc1460-shipment-view-fix');
  html=html.replace(/rc1460-shipment-view-files-avis-preview\.js\?v=1460/g,'rc1460-shipment-view-files-avis-preview.js?v=1616');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-av-upload-i18n" defer src="/assets/i18n/av-upload.js?v=1"></script>','exporthub-av-upload-i18n');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-av-upload" defer src="/assets/av-upload.js?v=1"></script>','exporthub-av-upload');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1126-customer-delete" defer src="/assets/rc1126-customer-delete.js?v=1387"></script>','exporthub-rc1126-customer-delete');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1113-stowplan-persist" defer src="/assets/rc1113-stowplan-persist.js?v=1113"></script>','exporthub-rc1113-stowplan-persist');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1114-shipping-neutral" defer src="/assets/rc1114-shipping-neutral.js?v=1386"></script>','exporthub-rc1114-shipping-neutral');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1133-avis-upload-notifications" defer src="/assets/rc1133-avis-upload-notifications.js?v=1133"></script>','exporthub-rc1133-avis-upload-notifications');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1160-customer-portal" defer src="/assets/rc1160-customer-portal-credentials.js?v=1412"></script>','exporthub-rc1160-customer-portal');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1165-pod-backup-status" defer src="/assets/rc1165-pod-backup-status.js?v=1165"></script>','exporthub-rc1165-pod-backup-status');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1166-avis-reminder" defer src="/assets/rc1166-avis-reminder-overview.js?v=20261005-outlook"></script>','exporthub-rc1166-avis-reminder');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1176-shipment-location" defer src="/assets/rc1176-shipment-location.js?v=1202"></script>','exporthub-rc1176-shipment-location');
  html=injectDeferredRuntimeInHead(html,'<link id="exporthub-rc1259-container-ui" rel="stylesheet" href="/assets/rc1014-shipment-overview.css?v=1370">','exporthub-rc1259-container-ui');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1259-container-runtime" defer src="/assets/rc1014-shipment-overview.js?v=1370"></script>','exporthub-rc1259-container-runtime');
  // RC1672: The historical RC1059 script occurrence is inside the Stauplan
  // popup HTML string only. Shipments/Packmeldungen require the viewer in the
  // actual application window. Load it synchronously at the start of HEAD so
  // quick navigation cannot cancel its pending request before it initializes.
  html=injectImmediateRuntimeAfterHead(html,'<script id="exporthub-rc1672-document-blob-viewer" src="/assets/rc1059-document-blob.js?v=1672"></script>','exporthub-rc1672-document-blob-viewer');
  const outerHead=html.slice(0,html.toLowerCase().indexOf('</head>'));
  if(!outerHead.includes('id="exporthub-rc1672-document-blob-viewer"'))throw new Error(file+': RC1672 echter Hauptfenster-Dokumentenviewer fehlt');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1203-deckblatt-print" defer src="/assets/rc1203-deckblatt-print.js?v=1373"></script>','exporthub-rc1203-deckblatt-print');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1207-pallet-account-fix" defer src="/assets/rc1207-pallet-account-fix.js?v=1418"></script>','exporthub-rc1207-pallet-account-fix');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1294-abd-self-service" defer src="/assets/rc1294-abd-self-service.js?v=1407"></script>','exporthub-rc1294-abd-self-service');
  html=injectDeferredRuntimeInHead(html,`<script id="exporthub-rc1193-visible-release" defer src="/assets/rc1193-visible-release.js?v=${VISIBLE_NUMBER}-1410"></script>`,'exporthub-rc1193-visible-release');
  html=injectDeferredRuntimeInHead(html,`<script id="exporthub-rc1177-release-notes" defer src="/assets/rc1177-release-notes.js?v=${VISIBLE_NUMBER}"></script>`,'exporthub-rc1177-release-notes');
  if(!html.includes('assets/rc1014-shipment-overview.css?v=1370'))throw new Error(file+': RC1259 Container-CSS fehlt');
  if(!html.includes('assets/rc1014-shipment-overview.js?v=1370'))throw new Error(file+': RC1259 Container-Runtime fehlt');
  if(!html.includes('x&&x.sealNumber')||!html.includes('sh&&sh.sealNumber'))throw new Error(file+': RC1259 Siegelnummer ist nicht in beiden Sendungssuchen');
  if(html.includes(LEGACY_TESTSERVICE_HOST))throw new Error(file+': alter TESTSERVICE-Endpunkt ist noch aktiv');
  if(!html.includes(CURRENT_TESTSERVICE_HOST))throw new Error(file+': aktueller TESTSERVICE-Endpunkt fehlt');
  if(!html.includes(`version:'${VERSION}'`))throw new Error(file+': BUILD '+VERSION+' fehlt');
  if(!html.includes(`ExportHUB ${VERSION} environment=`))throw new Error(file+': Environment '+VERSION+' fehlt');
  if(file!=='demo.html'&&!html.includes('assets/rc1289-auth-transport-fallback.js?v=1289'))throw new Error(file+': RC1289 Desktop-Auth-Fallback fehlt');
  if(!html.includes('assets/rc1074-login-clean.js?v=1630'))throw new Error(file+': RC1349 Login-/Browser-Branding-Cache-Key fehlt');
  if(!html.includes('assets/rc1014-task-runtime.js?v=1359'))throw new Error(file+': RC1359 Aufgaben-Runtime Cache-Key fehlt');
  if(!html.includes('assets/taskplanner-v2.css?v=2000'))throw new Error(file+': TaskPlanner V2 Styles fehlen');
  if(!html.includes('assets/taskplanner-v2-projections.css?v=2000'))throw new Error(file+': TaskPlanner V2 Projection Styles fehlen');
  if(!html.includes('assets/taskplanner-v2-core.js?v=2000'))throw new Error(file+': TaskPlanner V2 Core fehlt');
  if(!html.includes('assets/taskplanner-v2-recurrence.js?v=2000'))throw new Error(file+': TaskPlanner V2 Recurrence fehlt');
  if(!html.includes('assets/taskplanner-v2-planner.js?v=2000'))throw new Error(file+': TaskPlanner V2 Planner fehlt');
  if(!html.includes('assets/taskplanner-v2-projections.js?v=2000'))throw new Error(file+': TaskPlanner V2 Projections fehlen');
  if(!html.includes('assets/taskplanner-v2-runtime-bridge.js?v=2000'))throw new Error(file+': TaskPlanner V2 Runtime Bridge fehlt');
  if(!html.includes('assets/taskplanner-v2-workflow.js?v=2000'))throw new Error(file+': TaskPlanner V2 Workflow fehlt');
  if(!html.includes('assets/taskplanner-v2-ui.js?v=2000'))throw new Error(file+': TaskPlanner V2 UI fehlt');
  if(!html.includes('assets/taskplanner-v2-projection-ui.js?v=2000'))throw new Error(file+': TaskPlanner V2 Projection UI fehlt');
  if(!html.includes('assets/taskplanner-v2-planner-ui.js?v=2000'))throw new Error(file+': TaskPlanner V2 Planner UI fehlt');
  if(!html.includes('assets/rc1537-taskplanner-canonical-source.js?v=1537'))throw new Error(file+': RC1537 Canonical Source fehlt');
  if(!html.includes('assets/rc1014-task-ui.css?v=1312'))throw new Error(file+': RC1312 Aufgaben-CSS Cache-Key fehlt');
  if(!html.includes('assets/rc1013-diagnostics.js?v=1364'))throw new Error(file+': RC1364 Diagnose Cache-Key fehlt');
  if(!html.includes('assets/exporthub-environment-hub.js?v=1174'))throw new Error(file+': RC1174 Android-Diagnose-Hub Cache-Key fehlt');
  if(!html.includes('assets/rc1081-audit-history.js?v=1177'))throw new Error(file+': RC1177 Historie Cache-Key fehlt');
  if(!html.includes('assets/rc1071-shipment-history.js?v=1468'))throw new Error(file+': RC1468 Dokument-History Cache-Key fehlt');
  if(file!=='demo.html'&&!html.includes('assets/rc1063-abd-blob-viewer-compat.js?v=1683'))throw new Error(file+': RC1683 Dokumentaktionen Cache-Key fehlt');
  if(!html.includes('assets/rc1071-shipment-history.js?v=1095'))throw new Error(file+': RC1148 History-Kompatibilitätsmarker fehlt');
  if(!html.includes('assets/rc1126-customer-delete.js?v=1387'))throw new Error(file+': RC1126 Kundenlöschung fehlt');
  if(!html.includes('assets/rc1113-stowplan-persist.js?v=1113'))throw new Error(file+': RC1113 Stauplan-Erweiterung fehlt');
  if(!html.includes('assets/rc1114-shipping-neutral.js?v=1386'))throw new Error(file+': RC1114 neutrale Versandkostenoberfläche fehlt');
  if(!html.includes('assets/rc1133-avis-upload-notifications.js?v=1133'))throw new Error(file+': RC1133 AVIS-Upload-Benachrichtigungen fehlen');
  if(!html.includes('assets/rc1160-customer-portal-credentials.js?v=1412'))throw new Error(file+': RC1160 Kundenportal-Runtime fehlt');
  if(!html.includes('assets/rc1165-pod-backup-status.js?v=1165'))throw new Error(file+': RC1165 POD-Sicherungsstatus-Runtime fehlt');
  if(!html.includes('assets/rc1166-avis-reminder-overview.js?v=20261005-outlook'))throw new Error(file+': RC1207 Avis-Erinnerung-Runtime fehlt');
  if(!html.includes('assets/rc1176-shipment-location.js?v=1202'))throw new Error(file+': RC1191 Standort-Capture-Runtime fehlt');
  if(!html.includes('assets/rc1203-deckblatt-print.js?v=1373'))throw new Error(file+': RC1205 Deckblatt-Runtime fehlt');
  if(!html.includes('assets/rc1283-loading-list-search.js?v=1305'))throw new Error(file+': RC1283 Ladelisten-Suchruntime fehlt');
  if(!html.includes('assets/rc1315-loading-list-quick-print.js?v=1322'))throw new Error(file+': RC1315 QR-/REF-Schnelldruck-Runtime fehlt');
  if(!html.includes('assets/rc1305-loading-list-print.js?v=1379'))throw new Error(file+': RC1360 Ladelisten-Druckruntime fehlt im HTML');
  if(!html.includes('__EXPORTHUB_RC1283_OPEN_LOAD1__'))throw new Error(file+': RC1283 Ladelisten-Öffnen/Drucken-Bridge fehlt');
  if(!html.includes('assets/rc1207-pallet-account-fix.js?v=1418'))throw new Error(file+': RC1207 Palettenkonto-Runtime fehlt');
  if(!html.includes('assets/rc1294-abd-self-service.js?v=1407'))throw new Error(file+': RC1294 ABD-Self-Service-Runtime fehlt');
  if(!html.includes('assets/rc1193-visible-release.js?v='+VISIBLE_NUMBER+'-1410'))throw new Error(file+': '+VISIBLE_VERSION+' sichtbare Release-Version fehlt');
  if(!html.includes('assets/rc1177-release-notes.js?v='+VISIBLE_NUMBER))throw new Error(file+': '+VISIBLE_VERSION+' Änderungshinweise Cache-Key fehlt');
  if(!/\.rc352-cover\{[^}]*border:10mm solid #08245d!important;[^}]*border-top-width:18mm!important;/.test(html))throw new Error(file+': RC1133 Deckblatt-Rahmen fehlt');
  if(!/\.rc352-cover-ref\{(?=[^}]*background:#facc15)(?=[^}]*border:3mm solid #111827)[^}]*\}/.test(html))throw new Error(file+': RC1159 Deckblatt-Referenzfeld ist nicht ausreichend hervorgehoben');
  if(/\\\\n\.rc352-qr-slot\.empty/.test(html))throw new Error(file+': RC1133 Deckblatt-CSS enthält literalen \\n-Text');
  if(file==='demo.html'){
    if(!html.includes("namedTest=/-testservice\\./i.test(h)&&window.__EXPORTHUB_DEMO_MODE__!==true;"))throw new Error(file+': RC1131 Demo/Testservice-Origin nicht getrennt');
    if(!html.includes('if(window.__EXPORTHUB_DEMO_MODE__===true)return;'))throw new Error(file+': RC1131 Testportal-Runtime ist in Demo noch aktiv');
    if(!html.includes('window.__EXPORTHUB_DEMO_MODE__===true||window.__EXPORTHUB_PICKUP_MODE__'))throw new Error(file+': RC1131 Demo-Routenanker fehlt');
  }
  html=patchTaskPlannerV2UiCutover(html,file);
  // Insert only after *all* other head injections. In particular RC1289 prepends
  // a synchronous auth script. The pickup redirect must run before that script.
  if(file==='index.html'||file==='TESTVERSION.html'){
    const redirect=fs.readFileSync(path.join(ROOT,'assets/rc1666-public-pickup-query-redirect.js'),'utf8');
    if(redirect.includes('</script'))throw new Error('RC1666 pickup redirect contains unsafe script-close markup');
    html=injectImmediateRuntimeAfterHead(html,'<script id="exporthub-rc1666-public-pickup-redirect">'+redirect+'</script>','exporthub-rc1666-public-pickup-redirect');
    const headOpen=/<head[^>]*>/i.exec(html);
    if(!headOpen||!html.slice(headOpen.index+headOpen[0].length).trimStart().startsWith('<script id="exporthub-rc1666-public-pickup-redirect">'))throw new Error(file+': RC1666 redirect not first executable head script');
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
  'assets/taskplanner-v2-core.js',
  'assets/taskplanner-v2-recurrence.js',
  'assets/taskplanner-v2-planner.js',
  'assets/taskplanner-v2-projections.js',
  'assets/taskplanner-v2-runtime-bridge.js',
  'assets/taskplanner-v2-workflow.js',
  'assets/taskplanner-v2-ui.js',
  'assets/taskplanner-v2-projection-ui.js',
  'assets/taskplanner-v2-planner-ui.js',
  'assets/rc1537-taskplanner-canonical-source.js',
  'assets/task-public-read.js',
  'assets/taskplanner-v2-projections.css',
  'assets/taskplanner-v2.css',
  'assets/rc1014-task-ui.css',
  'assets/rc1126-customer-delete.js',
  'assets/rc1133-avis-upload-notifications.js',
  'assets/rc1081-audit-history.js',
  'assets/rc1160-customer-portal-credentials.js',
  'assets/rc1165-pod-backup-status.js',
  'assets/rc1166-avis-reminder-overview.js',
  'assets/rc1176-shipment-location.js',
  'assets/rc1059-document-blob.js', // RC1672: viewer is required by main UI and Playwright build
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
  'assets/rc1630-login-experience.css',
  'assets/rc1630-login-experience.js',
  'assets/rc1630-login-route.svg',
  'assets/rc1306-layout-engine.css',
  'assets/rc1306-layout-engine.js',
  'assets/rc1371-dashboard-personalization.css',
  'assets/rc1371-dashboard-personalization.js',
  'assets/rc1560-full-width.css',
  'assets/rc1577-shipment-overview-compact.css',
  'assets/rc1579-menu-redesign.css',
  'assets/rc1579-menu-redesign.js',
  'assets/i18n/rc1579-menu-redesign.js',
  'assets/customer-folder-redesign.css',
  'assets/customer-folder-redesign.js',
  'assets/rc1558-dashboard-overview.css',
  'assets/rc1558-dashboard-overview.js',
  // RC1592: print/browser QA must load the same pickup runtime as final release.
  'assets/rc1546-pickup-control.js',
  'assets/rc1570-tasks-focus.css',
  'assets/rc1570-tasks-focus.js',
  'assets/i18n/rc1570-tasks-focus.js',
  'assets/rc1650-shipment-task-link.js',
  'assets/rc1577-pod-quality-audit.js',
  'assets/rc1596-pod-folder-reconnect.js',
  'assets/rc1602-official-pod-server-download.js',
  'assets/i18n/rc1577-pod-quality-audit.js',
  'assets/rc1630-self-correct.js',
  'assets/i18n/rc1630-self-correct.js',
  'assets/rc1660-shipment-sop-popup.css',
  'assets/rc1660-shipment-sop-popup.js',
  'assets/i18n/rc1660-shipment-sop-popup.js',
  'assets/rc1650-diagnostics-plain.js',
  'assets/i18n/rc1650-diagnostics-plain.js',
  'assets/rc1460-shipment-view-files-avis-preview.js',
  'assets/i18n/av-upload.js',
  'assets/av-upload.js',
  'assets/i18n/web-push.js',
  'assets/web-push/client.js',
  'assets/web-push/sw.js',
  'assets/web-push/inbox.html',
  'assets/web-push/inbox.js',
  'assets/web-push/manifest.json',
  'assets/web-push/icon-192.png',
  'assets/web-push/icon-512.png',
  'assets/web-push/icon-maskable-512.png',
  'assets/web-push/badge-96.png'
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
const taskPublicPageSource=path.join(ROOT,'task.html');
if(!fs.existsSync(taskPublicPageSource))throw new Error('TaskPlanner V2 task.html fehlt');
fs.copyFileSync(taskPublicPageSource,path.join(OUT,'task.html'));
if(!fs.existsSync(path.join(OUT,'task.html')))throw new Error('TaskPlanner V2 task.html wurde nicht gebaut');
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
// RC1684 Versandkosten-Synchronisierung: alte Build-Snapshots dürfen die aktuelle
// Standortpriorität und die idempotente Colli-Übernahme nicht zurückbringen.
const rc1684Canonical=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const rc1684Boundaries=[
  ['function activeLocation(sh,c){','\nfunction activeShipmentRoute()'],
  ['function activeShipmentRoute(){','\nfunction shipmentRows()'],
  ['function syncCostFromShipment(){','\nfunction calcUps()']
];
for(const file of ['index.html','TESTVERSION.html','demo.html']){
  const target=path.join(OUT,file);
  let html=fs.readFileSync(target,'utf8');
  for(const [startMarker,endMarker] of rc1684Boundaries){
    const sourceStart=rc1684Canonical.indexOf(startMarker);
    const sourceEnd=rc1684Canonical.indexOf(endMarker,sourceStart);
    const targetStart=html.indexOf(startMarker);
    const targetEnd=html.indexOf(endMarker,targetStart);
    if(sourceStart<0||sourceEnd<=sourceStart||targetStart<0||targetEnd<=targetStart||
      html.indexOf(startMarker,targetStart+startMarker.length)>=0){
      throw new Error(file+': RC1684 Versandkosten-Funktionsgrenzen unklar: '+startMarker);
    }
    html=html.slice(0,targetStart)+rc1684Canonical.slice(sourceStart,sourceEnd)+html.slice(targetEnd);
  }
  fs.writeFileSync(target,html);
}
// RC1680: original-PDF batch downloads AND verified SharePoint success are
// canonical in index.html. Older TESTSERVICE/demo snapshots must not retain
// either the local re-rendering flow or optimistic Graph success messages.
const canonicalPodHtml=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const podControllers=[
  {id:'rc455-pod-backup-controller',marker:'async function savedSignedPod(sh)'},
  {id:'exporthub-rc479-sharepoint-pod-backup-controller',marker:'driveSaved=result&&result.driveSaved===true'}
].map(({id,marker})=>{
  const tag=new RegExp('<script id="'+id+'">[\\s\\S]*?<\\/script>');
  const source=canonicalPodHtml.match(tag);
  if(!source||!source[0].includes(marker))throw new Error('RC1680: kanonischer POD-Controller fehlt: '+id);
  return{tag,source:source[0],id};
});
for(const file of ['index.html','TESTVERSION.html','demo.html']){
  const target=path.join(OUT,file);
  let html=fs.readFileSync(target,'utf8');
  for(const controller of podControllers){
    if(!controller.tag.test(html))throw new Error(file+': RC1680 POD-Sicherungscontroller fehlt: '+controller.id);
    html=html.replace(controller.tag,controller.source);
  }
  fs.writeFileSync(target,html);
}
for(const file of ['index.html','TESTVERSION.html','demo.html']){
  const target=path.join(OUT,file);
  const hardened=hardenCustomerSaveHtml(patchRc1662SavedShipmentDeltaHtml(fs.readFileSync(target,'utf8'),file));
  const paginated=patchRc1602PodBrowserHtml(hardenAckMergeSaveHtml(hardened));
  const oldContacts='assets/rc1092-customer-mail-contacts.js?v=1399';
  if(!paginated.includes(oldContacts))throw new Error(file+': RC1600 Kontaktcache-Anker fehlt');
  fs.writeFileSync(target,paginated.replace(oldContacts,'assets/rc1092-customer-mail-contacts.js?v=1600'));
}
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
    avisReminderOverview:'RC1434 Outlook draft + customer/carrier + Sales/CC/Tobias/registration CC + three-business-day reminder gate + opened history + secure customer-specific avis link + recipient exclusion',
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

// RC1522: SOPMaster is an additive layer of the stable RC1112 release build.
integrateTour(ROOT,OUT);
integrateEditor(ROOT,OUT);
integrateTraining(ROOT,OUT);
integrateCoverageAdmin(ROOT,OUT);
// ABD invoice editor is present in Production, TESTSERVICE and Demo builds.
integrateAbdProforma(ROOT,OUT);
// Must stay last: hashes the files exactly as they are shipped.
fingerprintAssets({root:ROOT,out:OUT});

console.log('RC1112 build pipeline ready: sichtbare Produktversion '+VISIBLE_VERSION+' auf geprüfter RC1048-Basis, RC1194 sichere Kundenportal-Key-Diagnose aktiv.');
