import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const SRC=path.join(ROOT,'dist-rc1013');
const OUT=path.join(ROOT,'dist-rc1014');

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
  const idx=html.search(/<\/head\s*>/i);
  if(idx<0)throw new Error(`${id}: Kein </head> gefunden.`);
  return html.slice(0,idx)+tag+'\n'+html.slice(idx);
}
function setRc1014Version(html){
  let out=html.replace(/ExportHUB RC1013 environment=/g,'ExportHUB RC1014 environment=');
  out=out.replace(/var BUILD=Object\.freeze\(\{version:'RC1013',cache:'1013',loginReturn:'([^']*)'\}\);/,(_m,ret)=>{
    const next=String(ret||'').replace(/v=\d+/,'v=1014');
    return `var BUILD=Object.freeze({version:'RC1014',cache:'1014',loginReturn:'${next}'});`;
  });
  out=out.replace(/(window\.__EXPORTHUB_BUILD__\s*=\s*['"])RC1013(['"])/g,'$1RC1014$2');
  return out;
}
function rc1014Assets(html){
  const tags=[
    '<link id="exporthub-rc1014-task-css" rel="stylesheet" href="/assets/rc1014-task-ui.css?v=1014">',
    '<link id="exporthub-rc1014-shipment-overview-css" rel="stylesheet" href="/assets/rc1014-shipment-overview.css?v=1014">',
    '<script id="exporthub-rc1014-task-lifecycle" defer src="/assets/rc1014-task-lifecycle.js?v=1014"></script>',
    '<script id="exporthub-rc1014-task-runtime" defer src="/assets/rc1014-task-runtime.js?v=1014"></script>',
    '<script id="exporthub-rc1014-shipment-overview" defer src="/assets/rc1014-shipment-overview.js?v=1014"></script>'
  ].join('\n');
  return injectBeforeHeadClose(html,tags,'exporthub-rc1014-task-css');
}
function patchTaskSource(html){
  const search='const rawOpen=(state.tasks||[])';
  const replacement="const rawOpen=window.ExportHUBRC1014TaskRuntime.prepareTasks((state.tasks||[]),{companyId:(state.companyId||state.currentCompanyId||window.__EXPORTHUB_COMPANY_ID__||''),environment:(window.__EXPORTHUB_FORCED_ENVIRONMENT__||''),currentUser:(typeof window.__EXPORTHUB_GET_CURRENT_USER__==='function'?window.__EXPORTHUB_GET_CURRENT_USER__():null),state:state,persist:function(nextTasks){state.tasks=nextTasks;if(typeof save==='function')save('RC1014 Aufgabenstatus aktualisiert');else if(window.ExportHUBClean&&typeof window.ExportHUBClean.queueSave==='function')window.ExportHUBClean.queueSave('RC1014 Aufgabenstatus aktualisiert')}})";
  return replaceExactlyOnce(html,search,replacement,'RC1014 Aufgabenquelle');
}
function patchShipmentOverviewSource(html){
  return replaceRegexExactlyOnce(
    html,
    /function\s+overviewFiltered\s*\(([^)]*)\)\s*\{/,
    (_m,args)=>`function overviewFiltered(${args}){window.ExportHUBRC1014ShipmentOverview.remember(state.shipments||[]);`,
    'RC1014 Sendungsübersicht-Datenquelle'
  );
}

execFileSync(process.execPath,['.github/rc1013/build-three-env.mjs'],{cwd:ROOT,stdio:'inherit'});
fs.rmSync(OUT,{recursive:true,force:true});
fs.cpSync(SRC,OUT,{recursive:true});

for(const file of ['index.html','TESTVERSION.html','demo.html']){
  let html=fs.readFileSync(path.join(OUT,file),'utf8');
  html=setRc1014Version(html);
  html=rc1014Assets(html);
  html=patchTaskSource(html);
  html=patchShipmentOverviewSource(html);
  writeOut(file,html);
}

for(const asset of [
  'assets/rc1014-task-lifecycle.js',
  'assets/rc1014-task-runtime.js',
  'assets/rc1014-task-ui.css',
  'assets/rc1014-shipment-overview.js',
  'assets/rc1014-shipment-overview.css'
]){
  writeOut(asset,read(asset));
}

const manifest={
  schema:'exporthub-rc1014-three-env-v1',
  version:'RC1014',
  sourceRelease:'RC1013',
  tasks:{lifecycle:'assets/rc1014-task-lifecycle.js',runtime:'assets/rc1014-task-runtime.js',style:'assets/rc1014-task-ui.css'},
  shipmentOverview:{runtime:'assets/rc1014-shipment-overview.js',style:'assets/rc1014-shipment-overview.css',fields:['createdAt','totalColli','colliCount']},
  environments:{production:'index.html',testservice:'TESTVERSION.html',demo:'demo.html'}
};
writeOut('rc1014-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('RC1014 build ready: Aufgaben-Lifecycle, Runtime, Design sowie Erfassungsdatum und Colli in der Sendungsübersicht');
