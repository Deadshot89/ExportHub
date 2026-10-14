import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');
const OUT=path.join(ROOT,'dist-rc1112');

export const RC1532_ASSETS=Object.freeze([
  'assets/rc1532-customs-ai.js',
  'assets/rc1532-customs-ai.css'
]);
const STYLE_TAG='<link id="exporthub-rc1532-customs-ai-style" rel="stylesheet" href="/assets/rc1532-customs-ai.css?v=1532">';
const SCRIPT_TAG='<script id="exporthub-rc1532-customs-ai" defer src="/assets/rc1532-customs-ai.js?v=1532"></script>';

function count(html,id){return String(html||'').split(`id="${id}"`).length-1}
export function injectCustomsAi(html,file){
 let out=String(html||'');
 if(!/<\/head>/i.test(out))throw new Error(`${file}: </head> fehlt`);
 if(!out.includes('id="exporthub-rc1532-customs-ai-style"'))out=out.replace(/<\/head>/i,`${STYLE_TAG}\n</head>`);
 if(!out.includes('id="exporthub-rc1532-customs-ai"'))out=out.replace(/<\/head>/i,`${SCRIPT_TAG}\n</head>`);
 if(count(out,'exporthub-rc1532-customs-ai-style')!==1)throw new Error(`${file}: RC1532 Style nicht genau einmal vorhanden`);
 if(count(out,'exporthub-rc1532-customs-ai')!==1)throw new Error(`${file}: RC1532 Runtime nicht genau einmal vorhanden`);
 return out
}
export function integrateCustomsAi(root=ROOT,out=OUT){
 for(const rel of RC1532_ASSETS){
  const source=path.join(root,rel),target=path.join(out,rel);
  if(!fs.existsSync(source))throw new Error(`RC1532 Pflicht-Asset fehlt: ${rel}`);
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target)
 }
 const entries=['index.html','TESTVERSION.html','demo.html'];
 for(const file of entries){
  const target=path.join(out,file);if(!fs.existsSync(target))throw new Error(`RC1532 Build-Datei fehlt: ${file}`);
  fs.writeFileSync(target,injectCustomsAi(fs.readFileSync(target,'utf8'),file))
 }
 const manifest={version:'RC1532',assets:RC1532_ASSETS.slice(),entries,mode:'read-only-customs-ai',productionDeploy:false};
 fs.writeFileSync(path.join(out,'rc1532-customs-ai-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))integrateCustomsAi(ROOT,OUT);
