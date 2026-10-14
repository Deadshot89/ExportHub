import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');
const OUT=path.join(ROOT,'dist-rc1112');

export const RC1534_ASSET='assets/rc1534-shipment-repair-access.js';
export const RC1534_SCRIPT_ID='exporthub-rc1534-shipment-repair-access';
export const RC1534_SCRIPT_TAG='<script id="'+RC1534_SCRIPT_ID+'" defer src="/assets/rc1534-shipment-repair-access.js?v=1534"></script>';

function countId(html,id){return String(html||'').split('id="'+id+'"').length-1}

export function injectShipmentRepairAccess(html,file='index.html'){
  let out=String(html||'');
  if(!/<\/head>/i.test(out))throw new Error(file+': RC1534 </head>-Anker fehlt');
  if(!out.includes('id="'+RC1534_SCRIPT_ID+'"'))out=out.replace(/<\/head>/i,RC1534_SCRIPT_TAG+'\n</head>');
  if(countId(out,RC1534_SCRIPT_ID)!==1)throw new Error(file+': RC1534 Runtime-Tag nicht eindeutig');
  if(!out.includes('/assets/rc1534-shipment-repair-access.js?v=1534'))throw new Error(file+': RC1534 Cache-Key fehlt');
  return out
}

export function integrateShipmentRepairAccess(root=ROOT,out=OUT){
  const source=path.join(root,RC1534_ASSET),target=path.join(out,RC1534_ASSET);
  if(!fs.existsSync(source))throw new Error('RC1534 Pflicht-Runtime fehlt: '+RC1534_ASSET);
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);
  if(!fs.existsSync(target)||fs.statSync(target).size===0)throw new Error('RC1534 Runtime wurde nicht in den Build übernommen');
  const entries=['index.html','TESTVERSION.html','demo.html'];
  for(const file of entries){const entry=path.join(out,file);if(!fs.existsSync(entry))throw new Error('RC1534 Build-Datei fehlt: '+file);fs.writeFileSync(entry,injectShipmentRepairAccess(fs.readFileSync(entry,'utf8'),file))}
  const manifest={version:'RC1534',asset:RC1534_ASSET,entries,extends:'RC1533-picked-shipment-repair',policy:'function-admin-or-global-admin',reasonRequired:false};
  fs.writeFileSync(path.join(out,'rc1534-shipment-repair-access-manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))integrateShipmentRepairAccess(ROOT,OUT);
