import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const I18N_SCRIPT_ID='exporthub-rc1488-auto-update-i18n';
const I18N_SCRIPT_SRC='/assets/i18n/rc1488-auto-update.js?v=1488';
const SCRIPT_ID='exporthub-rc1488-auto-update';
const SCRIPT_SRC='/assets/rc1488-auto-update.js?v=1488';
const PROBE_NAME='production-version.js';
const CACHE_CONTROL='no-store, no-cache, must-revalidate';

function q(value){return String(value==null?'':value).trim();}

export function resolveBuildId(root=process.cwd(),env=process.env){
  for(const candidate of [env.EXPORTHUB_BUILD_ID,env.GITHUB_SHA]){
    const value=q(candidate).toLowerCase();
    if(/^[0-9a-f]{7,40}$/.test(value))return value;
  }
  try{
    const value=q(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'})).toLowerCase();
    if(/^[0-9a-f]{7,40}$/.test(value))return value;
  }catch(_){}
  throw new Error('RC1488: keine sichere Build-ID aus EXPORTHUB_BUILD_ID, GITHUB_SHA oder git HEAD verfügbar');
}

export function releaseMarker(root=process.cwd()){
  const file=path.join(root,'release-version.json');
  const marker=JSON.parse(fs.readFileSync(file,'utf8'));
  const visibleRelease=q(marker&&marker.visibleRelease).toUpperCase();
  const technicalBuild=q(marker&&marker.technicalBuild).toUpperCase();
  if(!/^RC\d+$/.test(visibleRelease))throw new Error('RC1488: visibleRelease ist ungültig');
  if(!/^RC\d+$/.test(technicalBuild))throw new Error('RC1488: technicalBuild ist ungültig');
  return {visibleRelease,technicalBuild};
}

function i18nScriptTag(){
  return `<script id="${I18N_SCRIPT_ID}" defer src="${I18N_SCRIPT_SRC}"></script>`;
}
function scriptTag(buildId,visibleRelease){
  return `<script id="${SCRIPT_ID}" defer src="${SCRIPT_SRC}" data-build-id="${buildId}" data-visible-release="${visibleRelease}"></script>`;
}
function removeScriptById(html,id){
  const rx=new RegExp(`\\s*<script\\b[^>]*id=["']${id}["'][^>]*><\\/script>\\s*`,`ig`);
  return String(html||'').replace(rx,'\n');
}

export function injectAutoUpdate(html,{buildId,visibleRelease,file='index.html'}={}){
  let out=removeScriptById(removeScriptById(html,I18N_SCRIPT_ID),SCRIPT_ID);
  const headClose=out.search(/<\/head\s*>/i);
  if(headClose<0)throw new Error(`RC1488 ${file}: </head> fehlt`);
  const tags=i18nScriptTag()+'\n'+scriptTag(buildId,visibleRelease)+'\n';
  out=out.slice(0,headClose)+tags+out.slice(headClose);
  for(const id of [I18N_SCRIPT_ID,SCRIPT_ID]){
    const matches=out.match(new RegExp(`id=["']${id}["']`,'g'))||[];
    if(matches.length!==1)throw new Error(`RC1488 ${file}: ${id} ${matches.length}x statt 1x`);
  }
  if(out.indexOf(`id="${I18N_SCRIPT_ID}"`)>out.indexOf(`id="${SCRIPT_ID}"`))throw new Error(`RC1488 ${file}: Sprachpaket muss vor Auto-Update-Runtime stehen`);
  if(!out.includes(`data-build-id="${buildId}"`))throw new Error(`RC1488 ${file}: Build-ID fehlt`);
  return out;
}

export function ensureManifestNoStore(config){
  const next=JSON.parse(JSON.stringify(config||{}));
  const routes=Array.isArray(next.routes)?next.routes.slice():[];
  const wanted={route:'/production-version.js',allowedRoles:['anonymous'],headers:{'Cache-Control':CACHE_CONTROL,'X-Content-Type-Options':'nosniff'}};
  const index=routes.findIndex(route=>route&&route.route==='/production-version.js');
  if(index>=0)routes[index]=Object.assign({},routes[index],wanted,{headers:Object.assign({},routes[index].headers||{},wanted.headers)});
  else routes.splice(Math.min(2,routes.length),0,wanted);
  next.routes=routes;
  return next;
}

export function finalizeAutoUpdate({root=process.cwd(),out=path.join(process.cwd(),'dist-rc1112'),env=process.env,now=()=>new Date()}={}){
  const buildId=resolveBuildId(root,env);
  const marker=releaseMarker(root);
  if(!fs.existsSync(out))throw new Error('RC1488: Build-Ausgabe fehlt: '+out);

  const assets=[
    {source:path.join(root,'assets','i18n','rc1488-auto-update.js'),target:path.join(out,'assets','i18n','rc1488-auto-update.js'),label:'Auto-Update-Sprachpaket'},
    {source:path.join(root,'assets','rc1488-auto-update.js'),target:path.join(out,'assets','rc1488-auto-update.js'),label:'Auto-Update-Runtime'}
  ];
  for(const asset of assets){
    if(!fs.existsSync(asset.source))throw new Error('RC1488: '+asset.label+' fehlt: '+asset.source);
    fs.mkdirSync(path.dirname(asset.target),{recursive:true});
    fs.copyFileSync(asset.source,asset.target);
  }

  for(const file of ['index.html','TESTVERSION.html']){
    const target=path.join(out,file);
    if(!fs.existsSync(target))throw new Error('RC1488: '+file+' fehlt im Build');
    const html=fs.readFileSync(target,'utf8');
    fs.writeFileSync(target,injectAutoUpdate(html,{buildId,visibleRelease:marker.visibleRelease,file}));
  }

  const manifest={
    schema:'exporthub-update-v1',
    buildId,
    visibleRelease:marker.visibleRelease,
    technicalBuild:marker.technicalBuild,
    builtAt:now().toISOString()
  };
  const probeFile=path.join(out,PROBE_NAME);
  if(!fs.existsSync(probeFile))throw new Error('RC1488: '+PROBE_NAME+' fehlt im Build');
  let probe=fs.readFileSync(probeFile,'utf8');
  probe=probe.replace(/\n?window\.__EXPORTHUB_UPDATE_BUILD__\s*=\s*['"][^'"]*['"];?/g,'');
  probe=probe.replace(/\n?window\.__EXPORTHUB_UPDATE_RELEASE__\s*=\s*['"][^'"]*['"];?/g,'');
  probe=probe.replace(/\n?window\.__EXPORTHUB_UPDATE_BUILT_AT__\s*=\s*['"][^'"]*['"];?/g,'');
  probe=probe.trimEnd()+`\nwindow.__EXPORTHUB_UPDATE_BUILD__='${manifest.buildId}';\nwindow.__EXPORTHUB_UPDATE_RELEASE__='${manifest.visibleRelease}';\nwindow.__EXPORTHUB_UPDATE_BUILT_AT__='${manifest.builtAt}';\n`;
  fs.writeFileSync(probeFile,probe);

  for(const name of ['staticwebapp.config.json','staticwebapp.testservice.config.json']){
    const target=path.join(out,name);
    if(!fs.existsSync(target))continue;
    const config=JSON.parse(fs.readFileSync(target,'utf8'));
    fs.writeFileSync(target,JSON.stringify(ensureManifestNoStore(config),null,2)+'\n');
  }

  return manifest;
}

const invoked=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(invoked){
  const out=process.argv[2]?path.resolve(process.argv[2]):path.join(process.cwd(),'dist-rc1112');
  const manifest=finalizeAutoUpdate({out});
  console.log(`RC1488 auto-update ready: ${manifest.visibleRelease} · ${manifest.buildId}`);
}
