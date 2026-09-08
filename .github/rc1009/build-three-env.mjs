import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const OUT=path.join(ROOT,'dist-rc1009');
const VERSION='RC1009';
const CACHE='1009';
const HUB_SRC='/assets/exporthub-environment-hub.js?v=1009';
const DEMO_SRC='/assets/exporthub-demo-bootstrap.js?v=1009';
const RELEASE_ENVIRONMENTS=['environment=production-candidate','environment=testservice','environment=demo'];
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
function write(rel,content){const file=path.join(OUT,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);}
function copy(rel){const src=path.join(ROOT,rel),dst=path.join(OUT,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);}
const sha=content=>crypto.createHash('sha256').update(content).digest('hex');
function setVersion(html){
  let out=html.replace(/var BUILD=Object\.freeze\(\{version:'RC\d+',cache:'\d+',loginReturn:'([^']*)'\}\);/,(_m,ret)=>{const next=String(ret||'').replace(/v=\d+/,'v=1009');return `var BUILD=Object.freeze({version:'${VERSION}',cache:'${CACHE}',loginReturn:'${next}'});`;});
  out=out.replace(/(window\.__EXPORTHUB_BUILD__\s*=\s*['"])RC\d+(['"])/g,`$1${VERSION}$2`);
  return out;
}
function injectBeforeHeadClose(html,tag,id){if(html.includes(`id="${id}"`)||html.includes(`id='${id}'`))return html;const idx=html.search(/<\/head\s*>/i);if(idx<0)throw new Error('Kein </head> gefunden.');return html.slice(0,idx)+tag+'\n'+html.slice(idx);}
function injectAfterHeadOpen(html,tag,id){if(html.includes(`id="${id}"`)||html.includes(`id='${id}'`))return html;const m=html.match(/<head(?:\s[^>]*)?>/i);if(!m||m.index==null)throw new Error('Kein <head> gefunden.');const idx=m.index+m[0].length;return html.slice(0,idx)+'\n'+tag+'\n'+html.slice(idx);}
function envTag(env){return `<script id="exporthub-rc1009-env-config">window.__EXPORTHUB_FORCED_ENVIRONMENT__=${JSON.stringify(env)};<\/script>\n<script id="exporthub-rc1009-env-hub" defer src="${HUB_SRC}"><\/script>`;}
function demoTag(){return `<script id="exporthub-rc1009-demo-bootstrap" src="${DEMO_SRC}"><\/script>`;}
function marker(html,env){const m=`<!-- ExportHUB ${VERSION} environment=${env} -->`;return html.includes(m)?html:html.replace(/<html([^>]*)>/i,`<html$1>\n${m}`);}
function demoAsset(){return read('assets/exporthub-demo-bootstrap.js').replace(/revision:\d+/g,'revision:1009').replace(/clientVersion:'RC\d+-demo'/g,"clientVersion:'RC1009-demo'").replace(/version:'RC\d+'/g,"version:'RC1009'").replace(/eh\d+-demo-banner/g,'eh1009-demo-banner');}
const production=marker(injectBeforeHeadClose(setVersion(read('index.html')),envTag('production'),'exporthub-rc1009-env-config'),'production-candidate');
const testservice=marker(injectBeforeHeadClose(setVersion(read('TESTVERSION.html')),envTag('testservice'),'exporthub-rc1009-env-config'),'testservice');
const demo=marker(injectBeforeHeadClose(injectAfterHeadOpen(setVersion(read('TESTVERSION.html')),demoTag(),'exporthub-rc1009-demo-bootstrap'),envTag('demo'),'exporthub-rc1009-env-config'),'demo');
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
write('index.html',production);write('TESTVERSION.html',testservice);write('demo.html',demo);
copy('assets/exporthub-environment-hub.js');write('assets/exporthub-demo-bootstrap.js',demoAsset());
write('rc1009-manifest.json',JSON.stringify({schema:'exporthub-rc1009-three-env-v1',version:VERSION,generatedAt:new Date().toISOString(),releaseEnvironments:RELEASE_ENVIRONMENTS,environments:{production:{file:'index.html',sha256:sha(production)},testservice:{file:'TESTVERSION.html',sha256:sha(testservice)},demo:{file:'demo.html',sha256:sha(demo)}}},null,2)+'\n');
console.log('RC1009 build ready: Produktion, TESTSERVICE und Demo');
