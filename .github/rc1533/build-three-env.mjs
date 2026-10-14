import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');
const OUT=path.join(ROOT,'dist-rc1112');

export const RC1533_ASSET='assets/rc1533-shipment-rework.js';
export const RC1533_SCRIPT_ID='exporthub-rc1533-shipment-rework';
export const RC1533_SCRIPT_TAG='<script id="'+RC1533_SCRIPT_ID+'" defer src="/assets/rc1533-shipment-rework.js?v=1533"></script>';

function countId(html,id){return String(html||'').split('id="'+id+'"').length-1;}

export function injectShipmentRework(html,file='index.html'){
  let out=String(html||'');
  if(!/<\/head>/i.test(out))throw new Error(file+': RC1533 </head>-Anker fehlt');
  if(!out.includes('id="'+RC1533_SCRIPT_ID+'"'))out=out.replace(/<\/head>/i,RC1533_SCRIPT_TAG+'\n</head>');
  const count=countId(out,RC1533_SCRIPT_ID);
  if(count!==1)throw new Error(file+': RC1533 Runtime-Tag '+count+'x gefunden');
  if(!out.includes('/assets/rc1533-shipment-rework.js?v=1533'))throw new Error(file+': RC1533 Runtime-Cache-Key fehlt');
  return out;
}

export function integrateShipmentRework(root=ROOT,out=OUT){
  const source=path.join(root,RC1533_ASSET),target=path.join(out,RC1533_ASSET);
  if(!fs.existsSync(source))throw new Error('RC1533 Pflicht-Runtime fehlt: '+RC1533_ASSET);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.copyFileSync(source,target);
  if(!fs.existsSync(target)||fs.statSync(target).size===0)throw new Error('RC1533 Runtime wurde nicht in den Build übernommen');
  const entries=['index.html','TESTVERSION.html','demo.html'];
  for(const file of entries){
    const entry=path.join(out,file);
    if(!fs.existsSync(entry))throw new Error('RC1533 Build-Datei fehlt: '+file);
    fs.writeFileSync(entry,injectShipmentRework(fs.readFileSync(entry,'utf8'),file));
  }
  const manifest={version:'RC1533',asset:RC1533_ASSET,entries,mode:'admin-shipment-rework',pickupProofPolicy:'immutable'};
  fs.writeFileSync(path.join(out,'rc1533-shipment-rework-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))integrateShipmentRework(ROOT,OUT);
