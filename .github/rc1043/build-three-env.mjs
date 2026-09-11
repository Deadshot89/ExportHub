import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const SRC=path.join(ROOT,'dist-rc1018');
const OUT=path.join(ROOT,'dist-rc1043');
const VERSION='RC1043';
const NUMBER='1043';

function replaceOne(source,before,after,label){
  const count=source.split(before).length-1;
  if(count!==1)throw new Error(`RC1043 POD-Hotfix ${label}: Anker ${count}x gefunden`);
  return source.replace(before,after);
}

function patchPodUploadPersistence(html,file){
  const oldFlush="async function flushDocumentUpload(reason){var clean=window.ExportHUBClean;if(!clean||typeof clean.queueSave!=='function')return false;await Promise.resolve(clean.queueSave(reason));var target=clean.runtime?Number(clean.runtime.changeGeneration||0):0,deadline=Date.now()+35000,ok=false;while(Date.now()<deadline&&!ok){while(clean.runtime&&clean.runtime.saving&&Date.now()<deadline)await new Promise(function(resolve){(clean.native&&clean.native.setTimeout||window.setTimeout)(resolve,100)});if(clean.runtime&&target>0&&Number(clean.runtime.lastSavedGeneration||0)>=target){ok=true;break}if(typeof clean.flushSave==='function')ok=await Promise.resolve(clean.flushSave(reason,{force:true}));if(!ok)await new Promise(function(resolve){(clean.native&&clean.native.setTimeout||window.setTimeout)(resolve,250)})}if(!ok&&clean.runtime&&target>0&&Number(clean.runtime.lastSavedGeneration||0)>=target)ok=true;return ok}";
  const newFlush="async function flushDocumentUpload(reason){var clean=window.ExportHUBClean;if(!clean||typeof clean.queueSave!=='function')return false;await Promise.resolve(clean.queueSave(reason));var target=clean.runtime?Number(clean.runtime.changeGeneration||0):0,deadline=Date.now()+80000,ok=false;while(Date.now()<deadline&&!ok){while(clean.runtime&&clean.runtime.saving&&Date.now()<deadline)await new Promise(function(resolve){(clean.native&&clean.native.setTimeout||window.setTimeout)(resolve,100)});if(clean.runtime&&target>0&&Number(clean.runtime.lastSavedGeneration||0)>=target){ok=true;break}if(typeof clean.flushSave==='function')ok=await Promise.resolve(clean.flushSave(reason,{force:true,userInitiated:true}));if(!ok)await new Promise(function(resolve){(clean.native&&clean.native.setTimeout||window.setTimeout)(resolve,250)})}if(!ok&&clean.runtime&&target>0&&Number(clean.runtime.lastSavedGeneration||0)>=target)ok=true;return ok}";
  let out=replaceOne(html,oldFlush,newFlush,file+' Speicherbestätigung');

  const oldReason="var reason=(kind==='pod'?'POD':'ABD')+' als PDF dauerhaft gespeichert',ok=await flushDocumentUpload(reason);";
  const newReason="var reason=kind==='pod'?'POD-Sicherung nach manuellem Upload synchronisiert':'ABD als PDF dauerhaft gespeichert',ok=await flushDocumentUpload(reason);";
  out=replaceOne(out,oldReason,newReason,file+' POD-Sperrausnahme');

  if(!out.includes("deadline=Date.now()+80000"))throw new Error(file+': verlängerte POD-Azure-Bestätigung fehlt');
  if(!out.includes("flushSave(reason,{force:true,userInitiated:true})"))throw new Error(file+': benutzerinitiierte POD-Speicherung fehlt');
  if(!out.includes("POD-Sicherung nach manuellem Upload synchronisiert"))throw new Error(file+': POD-Sperrausnahme fehlt');
  return out;
}

function patchHtml(file){
  const target=path.join(OUT,file);
  let html=fs.readFileSync(target,'utf8');
  html=patchPodUploadPersistence(html,file);
  html=html.replace(/ExportHUB RC1018 environment=/g,`ExportHUB ${VERSION} environment=`);
  html=html.replace(
    /var BUILD=Object\.freeze\(\{version:'RC1018',cache:'1018',loginReturn:'([^']*)'\}\);/,
    (_m,ret)=>{
      const next=String(ret||'').replace(/([?&]v=)\d+/,'$1'+NUMBER);
      return `var BUILD=Object.freeze({version:'${VERSION}',cache:'${NUMBER}',loginReturn:'${next}'});`;
    }
  );
  html=html.replace(/(window\.__EXPORTHUB_BUILD__\s*=\s*['"])RC1018(['"])/g,`$1${VERSION}$2`);
  if(!html.includes(`version:'${VERSION}'`))throw new Error(`${file}: BUILD ${VERSION} fehlt`);
  if(!html.includes(`ExportHUB ${VERSION} environment=`))throw new Error(`${file}: Environment ${VERSION} fehlt`);
  fs.writeFileSync(target,html);
}

execFileSync(process.execPath,['.github/rc1018/build-three-env.mjs'],{cwd:ROOT,stdio:'inherit'});
fs.rmSync(OUT,{recursive:true,force:true});
fs.cpSync(SRC,OUT,{recursive:true});
for(const file of ['index.html','TESTVERSION.html','demo.html'])patchHtml(file);

const probeFile=path.join(OUT,'production-version.js');
let probe=fs.readFileSync(probeFile,'utf8');
probe=probe.replace(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC\d+'/g,`__EXPORTHUB_PRODUCTION_VERSION_PROBE__='${VERSION}'`);
if(!probe.includes(`__EXPORTHUB_PRODUCTION_VERSION_PROBE__='${VERSION}'`))throw new Error('RC1043 Produktionsmarker fehlt');
fs.writeFileSync(probeFile,probe);

const baseManifest=JSON.parse(fs.readFileSync(path.join(SRC,'rc1018-manifest.json'),'utf8'));
fs.writeFileSync(path.join(OUT,'rc1043-manifest.json'),JSON.stringify({
  schema:'exporthub-rc1043-three-env-v1',
  version:VERSION,
  sourceRelease:'RC1018',
  sourceManifest:baseManifest,
  environments:{production:'index.html',testservice:'TESTVERSION.html',demo:'demo.html'}
},null,2)+'\n');

console.log('RC1043 build ready: POD-Azure-Bestätigung nach Abholung gehärtet, Produktion/TESTSERVICE/Demo synchronisiert.');
