import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const OUT=path.join(ROOT,'dist-rc996');
const VERSION='RC996';
const CACHE='996';
const HUB_SRC='/assets/exporthub-environment-hub.js?v=996';
const DEMO_SRC='/assets/exporthub-demo-bootstrap.js?v=996';

function read(rel){return fs.readFileSync(path.join(ROOT,rel),'utf8');}
function write(rel,content){const file=path.join(OUT,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);}
function copy(rel){const src=path.join(ROOT,rel),dst=path.join(OUT,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);}
function sha(content){return crypto.createHash('sha256').update(content).digest('hex');}

function setVersion(html){
  let out=html;
  out=out.replace(/var BUILD=Object\.freeze\(\{version:'RC\d+',cache:'\d+',loginReturn:'([^']*)'\}\);/,(_m,ret)=>{
    const next=String(ret||'').replace(/v=\d+/,'v=996');
    return `var BUILD=Object.freeze({version:'${VERSION}',cache:'${CACHE}',loginReturn:'${next}'});`;
  });
  out=out.replace(/(window\.__EXPORTHUB_BUILD__\s*=\s*['"])RC\d+(['"])/g,`$1${VERSION}$2`);
  return out;
}
function injectBeforeHeadClose(html,tag,id){
  if(html.includes(`id="${id}"`)||html.includes(`id='${id}'`))return html;
  const idx=html.search(/<\/head\s*>/i);
  if(idx<0)throw new Error('Kein </head> für RC996-Injektion gefunden.');
  return html.slice(0,idx)+tag+'\n'+html.slice(idx);
}
function injectAfterHeadOpen(html,tag,id){
  if(html.includes(`id="${id}"`)||html.includes(`id='${id}'`))return html;
  const m=html.match(/<head(?:\s[^>]*)?>/i);
  if(!m||m.index==null)throw new Error('Kein <head> für RC996-Demo-Injektion gefunden.');
  const idx=m.index+m[0].length;
  return html.slice(0,idx)+'\n'+tag+'\n'+html.slice(idx);
}
function envTag(env){return `<script id="exporthub-rc996-env-config">window.__EXPORTHUB_FORCED_ENVIRONMENT__=${JSON.stringify(env)};<\/script>\n<script id="exporthub-rc996-env-hub" defer src="${HUB_SRC}"><\/script>`;}
function demoTag(){return `<script id="exporthub-rc996-demo-bootstrap" src="${DEMO_SRC}"><\/script>`;}
function ensureMarker(html,env){
  const marker=`<!-- ExportHUB ${VERSION} environment=${env} -->`;
  return html.includes(marker)?html:html.replace(/<html([^>]*)>/i,`<html$1>\n${marker}`);
}

function buildTest(){
  let html=setVersion(read('TESTVERSION.html'));
  html=injectBeforeHeadClose(html,envTag('testservice'),'exporthub-rc996-env-config');
  html=ensureMarker(html,'testservice');
  return html;
}
function buildProductionCandidate(){
  let html=setVersion(read('index.html'));
  html=injectBeforeHeadClose(html,envTag('production'),'exporthub-rc996-env-config');
  html=ensureMarker(html,'production-candidate');
  return html;
}
function buildDemo(){
  let html=setVersion(read('TESTVERSION.html'));
  html=injectAfterHeadOpen(html,demoTag(),'exporthub-rc996-demo-bootstrap');
  html=injectBeforeHeadClose(html,envTag('demo'),'exporthub-rc996-env-config');
  html=ensureMarker(html,'demo');
  return html;
}

for(const rel of ['assets/exporthub-environment-hub.js','assets/exporthub-demo-bootstrap.js']){
  if(!fs.existsSync(path.join(ROOT,rel)))throw new Error('RC996 Pflichtdatei fehlt: '+rel);
}
fs.rmSync(OUT,{recursive:true,force:true});
fs.mkdirSync(OUT,{recursive:true});

const production=buildProductionCandidate();
const test=buildTest();
const demo=buildDemo();
write('index.html',production);
write('TESTVERSION.html',test);
write('demo.html',demo);
copy('assets/exporthub-environment-hub.js');
copy('assets/exporthub-demo-bootstrap.js');

const manifest={
  schema:'exporthub-rc996-three-env-v1',version:VERSION,generatedAt:new Date().toISOString(),
  environments:{
    production:{file:'index.html',mode:'release-candidate',sha256:sha(production)},
    testservice:{file:'TESTVERSION.html',mode:'testservice',sha256:sha(test)},
    demo:{file:'demo.html',mode:'isolated-fake-data',sha256:sha(demo)}
  },
  assets:['assets/exporthub-environment-hub.js','assets/exporthub-demo-bootstrap.js']
};
write('rc996-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(`RC996 build ready: production candidate, TESTSERVICE and Demo -> ${path.relative(ROOT,OUT)}`);
