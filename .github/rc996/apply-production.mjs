import fs from 'node:fs';
import path from 'node:path';

const VERSION='RC996';
const CACHE='996';
const HUB_SRC='/assets/exporthub-environment-hub.js?v=996';

function setVersion(html){
  return html.replace(/var BUILD=Object\.freeze\(\{version:'RC\d+',cache:'\d+',loginReturn:'([^']*)'\}\);/,(_m,ret)=>{
    const next=String(ret||'').replace(/v=\d+/,'v=996');
    return `var BUILD=Object.freeze({version:'${VERSION}',cache:'${CACHE}',loginReturn:'${next}'});`;
  });
}
function apply(html){
  let out=setVersion(html);
  if(!out.includes('id="exporthub-rc996-env-config"')){
    const tag=`<script id="exporthub-rc996-env-config">window.__EXPORTHUB_FORCED_ENVIRONMENT__='production';<\/script>\n<script id="exporthub-rc996-env-hub" defer src="${HUB_SRC}"><\/script>`;
    const idx=out.search(/<\/head\s*>/i);if(idx<0)throw new Error('Kein </head> in index.html gefunden.');
    out=out.slice(0,idx)+tag+'\n'+out.slice(idx);
  }
  if(!out.includes(`ExportHUB ${VERSION} environment=production`))out=out.replace(/<html([^>]*)>/i,`<html$1>\n<!-- ExportHUB ${VERSION} environment=production -->`);
  return out;
}

const args=process.argv.slice(2);
const inPlace=args.includes('--in-place');
const inputArg=args.find(a=>a.startsWith('--input='));
const outputArg=args.find(a=>a.startsWith('--output='));
const input=path.resolve(inputArg?inputArg.slice(8):'index.html');
const output=path.resolve(outputArg?outputArg.slice(9):(inPlace?'index.html':'dist-rc996/production-index.html'));
const original=fs.readFileSync(input,'utf8');
const next=apply(original);
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,next);
console.log(`RC996 Produktionskandidat erzeugt: ${path.relative(process.cwd(),output)}`);
console.log('Hinweis: Veröffentlichung erfolgt ausschließlich über das ExportHUB Release Center.');
