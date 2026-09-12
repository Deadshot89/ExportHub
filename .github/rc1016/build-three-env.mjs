import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const SRC=path.join(ROOT,'dist-rc1013');
const OUT=path.join(ROOT,'dist-rc1016');
const VERSION='RC1016';
const CACHE='1016';

function read(rel){return fs.readFileSync(path.join(ROOT,rel),'utf8');}
function writeOut(rel,content){const file=path.join(OUT,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);}
function replaceExactlyOnce(html,search,replacement,label){
  const count=html.split(search).length-1;
  if(count!==1)throw new Error(`${label}: erwartet 1 Treffer, gefunden ${count}`);
  return html.replace(search,replacement);
}
function replaceRegexExactlyOnce(html,regex,replacer,label){
  const flags=regex.flags.includes('g')?regex.flags:regex.flags+'g';
  const scan=new RegExp(regex.source,flags);
  const matches=[...html.matchAll(scan)];
  if(matches.length!==1)throw new Error(`${label}: erwartet 1 Treffer, gefunden ${matches.length}`);
  return html.replace(regex,replacer);
}
function injectBeforeHeadClose(html,tag,id){
  if(html.includes(`id="${id}"`)||html.includes(`id='${id}'`))return html;
  const body=html.search(/<body\b/i),idx=(body>=0?html.slice(0,body):html).search(/<\/head\s*>/i);
  if(idx<0)throw new Error(`${id}: Kein </head> gefunden.`);
  return html.slice(0,idx)+tag+'\n'+html.slice(idx);
}
function injectDemoBridge(html){
  if(html.includes('id="exporthub-rc1016-demo-bridge"'))return html;
  const rx=/(<script\s+id=["']exporthub-rc1013-demo-bootstrap["'][^>]*><\/script>)/i;
  if(!rx.test(html))throw new Error('RC1016 Demo-Bridge: RC1013 Demo-Bootstrap nicht gefunden.');
  return html.replace(rx,`$1\n<script id="exporthub-rc1016-demo-bridge" src="/assets/rc1014-demo-bridge.js?v=1016"></script>\n<script id="exporthub-rc1016-demo-task-seed" src="/assets/rc1016-demo-task-seed.js?v=1016"></script>`);
}
function injectSopConsolidation(html){
  if(html.includes('id="exporthub-rc1016-sop-consolidation"'))return html;
  const rx=/(<script[^>]+src=["'][^"']*\/assets\/sop\/rc1010-sop-release\.js\?v=1010["'][^>]*><\/script>)/i;
  if(!rx.test(html))throw new Error('RC1016 SOP: RC1010 Freigabebasis nicht gefunden.');
  return html.replace(rx,`$1\n<script id="exporthub-rc1016-sop-consolidation" defer src="/assets/sop/rc1016-sop-consolidation.js?v=1016"></script>`);
}
function patchDemoDataEnvironment(html){
  const search="const DATA_ENVIRONMENT=/-testservice\\./i.test(String(location.hostname||''))?'testservice':'production';";
  return replaceExactlyOnce(html,search,"const DATA_ENVIRONMENT='demo';",'RC1016 Demo-Datenumgebung');
}
function setRc1016Version(html){
  let out=html.replace(/ExportHUB RC1013 environment=/g,'ExportHUB RC1016 environment=');
  out=out.replace(/var BUILD=Object\.freeze\(\{version:'RC1013',cache:'1013',loginReturn:'([^']*)'\}\);/,(_m,ret)=>{
    const next=String(ret||'').replace(/v=\d+/,'v=1016');
    return `var BUILD=Object.freeze({version:'${VERSION}',cache:'${CACHE}',loginReturn:'${next}'});`;
  });
  out=out.replace(/(window\.__EXPORTHUB_BUILD__\s*=\s*['"])RC1013(['"])/g,'$1RC1016$2');
  return out;
}
function rc1016Assets(html){
  const tags=[
    '<link id="exporthub-rc1016-mobile-navigation-css" rel="stylesheet" href="/assets/rc1016-mobile-navigation.css?v=1016">',
    '<link id="exporthub-rc1016-task-css" rel="stylesheet" href="/assets/rc1014-task-ui.css?v=1016">',
    '<link id="exporthub-rc1016-shipment-overview-css" rel="stylesheet" href="/assets/rc1014-shipment-overview.css?v=1016">',
    '<script id="exporthub-rc1016-mobile-navigation" defer src="/assets/rc1016-mobile-navigation.js?v=1016"></script>',
    '<script id="exporthub-rc1016-task-lifecycle" defer src="/assets/rc1014-task-lifecycle.js?v=1016"></script>',
    '<script id="exporthub-rc1016-task-runtime" defer src="/assets/rc1014-task-runtime.js?v=1016"></script>',
    '<script id="exporthub-rc1016-shipment-overview" defer src="/assets/rc1014-shipment-overview.js?v=1016"></script>'
  ].join('\n');
  return injectBeforeHeadClose(html,tags,'exporthub-rc1016-mobile-navigation-css');
}
function patchTaskSource(html){
  const search='const rawOpen=(state.tasks||[])';
  const replacement="const rawOpen=window.ExportHUBRC1014TaskRuntime.prepareTasks((state.tasks||[]),{companyId:(state.companyId||state.currentCompanyId||window.__EXPORTHUB_COMPANY_ID__||''),environment:(window.__EXPORTHUB_FORCED_ENVIRONMENT__||''),currentUser:(typeof window.__EXPORTHUB_GET_CURRENT_USER__==='function'?window.__EXPORTHUB_GET_CURRENT_USER__():null),state:state,persist:function(nextTasks){state.tasks=nextTasks;if(typeof save==='function')save('RC1016 Aufgabenstatus aktualisiert');else if(window.ExportHUBClean&&typeof window.ExportHUBClean.queueSave==='function')window.ExportHUBClean.queueSave('RC1016 Aufgabenstatus aktualisiert')}})";
  return replaceExactlyOnce(html,search,replacement,'RC1016 Aufgabenquelle');
}
function patchTaskPlannerSource(html){
  const search="(st().tasks||[]).forEach(function(t){if(!t||done(t)||!q(t.title||t.name)||isTest(t))return;";
  const replacement="window.ExportHUBRC1014TaskRuntime.currentTasks((st().tasks||[]),{companyId:(st().companyId||st().currentCompanyId||window.__EXPORTHUB_COMPANY_ID__||''),environment:(window.__EXPORTHUB_FORCED_ENVIRONMENT__||''),currentUser:(typeof window.__EXPORTHUB_GET_CURRENT_USER__==='function'?window.__EXPORTHUB_GET_CURRENT_USER__():null),state:st()}).forEach(function(t){if(!t||done(t)||!q(t.title||t.name)||isTest(t))return;";
  return replaceExactlyOnce(html,search,replacement,'RC1054 Aufgaben-Planner Datenquelle');
}
function patchShipmentOverviewSource(html){
  return replaceRegexExactlyOnce(html,/function\s+overviewFiltered\s*\(([^)]*)\)\s*\{/,(_m,args)=>`function overviewFiltered(${args}){window.ExportHUBRC1014ShipmentOverview.remember(state.shipments||[]);`,'RC1016 Sendungsübersicht-Datenquelle');
}
function patchWarningCenterStateSource(html){
  const search="  function getState(){\n    try{\n      if(typeof window.state==='function'){\n        var s=window.state();\n        if(s&&typeof s==='object') return s\n      }\n    }catch(_){}\n    try{\n      if(window.STATE&&typeof window.STATE==='object') return window.STATE\n    }catch(_){}\n    return {}\n  }";
  const replacement="  function getState(){\n    try{\n      if(typeof window.__EXPORTHUB_GET_STATE__==='function'){\n        var current=window.__EXPORTHUB_GET_STATE__();\n        if(current&&typeof current==='object') return current\n      }\n    }catch(_){}\n    try{\n      if(window.state&&typeof window.state==='object') return window.state;\n      if(typeof window.state==='function'){\n        var s=window.state();\n        if(s&&typeof s==='object') return s\n      }\n    }catch(_){}\n    try{\n      if(window.__EXPORTHUB_STATE__&&typeof window.__EXPORTHUB_STATE__==='object') return window.__EXPORTHUB_STATE__;\n      if(window.STATE&&typeof window.STATE==='object') return window.STATE\n    }catch(_){}\n    return {}\n  }";
  return replaceExactlyOnce(html,search,replacement,'RC1016 Warncenter-Datenquelle');
}

execFileSync(process.execPath,['.github/rc1013/build-three-env.mjs'],{cwd:ROOT,stdio:'inherit'});
fs.rmSync(OUT,{recursive:true,force:true});
fs.cpSync(SRC,OUT,{recursive:true});

for(const file of ['index.html','TESTVERSION.html','demo.html']){
  let html=fs.readFileSync(path.join(OUT,file),'utf8');
  html=setRc1016Version(html);
  html=injectSopConsolidation(html);
  if(file==='demo.html'){
    html=patchDemoDataEnvironment(html);
    html=injectDemoBridge(html);
  }
  html=rc1016Assets(html);
  html=patchTaskSource(html);
  html=patchTaskPlannerSource(html);
  html=patchShipmentOverviewSource(html);
  html=patchWarningCenterStateSource(html);
  writeOut(file,html);
}

for(const asset of [
  'assets/rc1016-mobile-navigation.css','assets/rc1016-mobile-navigation.js',
  'assets/rc1014-task-lifecycle.js','assets/rc1014-task-runtime.js','assets/rc1014-task-ui.css',
  'assets/rc1014-shipment-overview.js','assets/rc1014-shipment-overview.css','assets/rc1014-demo-bridge.js',
  'assets/rc1016-demo-task-seed.js'
])writeOut(asset,read(asset));
const sopSource=path.join(ROOT,'assets/sop');
if(fs.existsSync(sopSource))fs.cpSync(sopSource,path.join(OUT,'assets/sop'),{recursive:true});
writeOut('production-version.js',read('production-version.js'));

const manifest={
  schema:'exporthub-rc1016-three-env-v1',version:VERSION,sourceRelease:'RC1015',baseBuilder:'RC1013 mit integrierten RC1015-Fixes',productionVersionProbe:'production-version.js',
  tasks:{lifecycle:'assets/rc1014-task-lifecycle.js',runtime:'assets/rc1014-task-runtime.js',style:'assets/rc1014-task-ui.css'},
  shipmentOverview:{runtime:'assets/rc1014-shipment-overview.js',style:'assets/rc1014-shipment-overview.css',fields:['createdAt','totalColli','colliCount']},
  mobileNavigation:{runtime:'assets/rc1016-mobile-navigation.js',style:'assets/rc1016-mobile-navigation.css',persistentMenuButtonMaxWidth:640},
  sop:{catalog:'assets/sop/rc1016-sop-consolidation.js',activeWorkflows:24,legacyDocuments:75,screenshotDirectory:'assets/sop/screenshots'},
  retainedFixes:{lieferavis:'assets/rc1015-lieferavis-mail-flow.js',calendar:'assets/abholkalender.js',diagnostics:'assets/rc1013-diagnostics.js',gate41:'assets/rc1013-gate41-ui.js',multiTruck:'assets/rc1017-multi-truck.js'},
  demo:{bridge:'assets/rc1014-demo-bridge.js',taskSeed:'assets/rc1016-demo-task-seed.js',sessionRestore:true,dataEnvironment:'demo',fixedPickups:'fake-local'},
  environments:{production:'index.html',testservice:'TESTVERSION.html',demo:'demo.html'}
};
writeOut('rc1016-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('RC1016 build ready: Aufgaben, Abholkalender, Sendungsmetadaten, mobiles Menü, SOP 2.0 und Versionsmarker RC1016 auf RC1015-Basis in Produktion, TESTSERVICE und Demo');
