import fs from 'node:fs';
import path from 'node:path';

export const RC1555_PACKAGING_ASSETS=Object.freeze([
  'assets/rc1555-packaging-store.js',
  'assets/rc1555-packaging-shipment.js',
  'assets/rc1555-packaging-management.js',
  'assets/rc1555-packaging-management.css'
]);

const LOCALE_DIR='assets/i18n/rc1555-packaging-masterdata';
const STYLE_TAG='<link id="exporthub-rc1555-packaging-management-style" rel="stylesheet" href="/assets/rc1555-packaging-management.css?v=1555">';
const STORE_TAG='<script id="exporthub-rc1555-packaging-store" defer src="/assets/rc1555-packaging-store.js?v=1555"></script>';
const SHIPMENT_TAG='<script id="exporthub-rc1555-packaging-shipment" defer src="/assets/rc1555-packaging-shipment.js?v=1555"></script>';
const MANAGEMENT_TAG='<script id="exporthub-rc1555-packaging-management" defer src="/assets/rc1555-packaging-management.js?v=1555"></script>';

function countId(html,id){return String(html||'').split(`id="${id}"`).length-1;}
function injectBeforeHeadEnd(html,tag,id,file){
  const out=String(html||'');
  if(countId(out,id)>0)return out;
  if(!/<\/head>/i.test(out))throw new Error(`${file}: RC1555 </head> fehlt`);
  return out.replace(/<\/head>/i,`${tag}\n</head>`);
}

export function injectPackagingMasterdata(html,file='index.html'){
  let out=String(html||'');
  if(!out.includes('id="exporthub-rc1267-i18n"'))throw new Error(`${file}: RC1555 zentrale i18n-Runtime fehlt`);
  out=injectBeforeHeadEnd(out,STYLE_TAG,'exporthub-rc1555-packaging-management-style',file);
  out=injectBeforeHeadEnd(out,STORE_TAG,'exporthub-rc1555-packaging-store',file);
  out=injectBeforeHeadEnd(out,SHIPMENT_TAG,'exporthub-rc1555-packaging-shipment',file);
  out=injectBeforeHeadEnd(out,MANAGEMENT_TAG,'exporthub-rc1555-packaging-management',file);
  for(const id of ['exporthub-rc1555-packaging-management-style','exporthub-rc1555-packaging-store','exporthub-rc1555-packaging-shipment','exporthub-rc1555-packaging-management']){
    const count=countId(out,id);if(count!==1)throw new Error(`${file}: RC1555 Tag ${id} ${count}x gefunden`);
  }
  const i18n=out.indexOf('id="exporthub-rc1267-i18n"');
  const store=out.indexOf('id="exporthub-rc1555-packaging-store"');
  const shipment=out.indexOf('id="exporthub-rc1555-packaging-shipment"');
  const management=out.indexOf('id="exporthub-rc1555-packaging-management"');
  if(i18n<0||store<=i18n)throw new Error(`${file}: RC1555 Store muss nach zentraler i18n-Runtime geladen werden`);
  if(shipment<=store)throw new Error(`${file}: RC1555 Shipment-Verpackungssuche muss nach Packaging Store geladen werden`);
  if(management<=shipment)throw new Error(`${file}: RC1555 Management muss nach Shipment-Verpackungssuche geladen werden`);
  return out;
}

export function integratePackagingMasterdata(root,out){
  for(const rel of RC1555_PACKAGING_ASSETS){
    const source=path.join(root,rel),target=path.join(out,rel);
    if(!fs.existsSync(source))throw new Error(`RC1555 Pflicht-Asset fehlt: ${rel}`);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(source,target);
    if(!fs.existsSync(target)||fs.statSync(target).size===0)throw new Error(`RC1555 Asset wurde nicht gebaut: ${rel}`);
  }
  const localeSource=path.join(root,LOCALE_DIR),localeTarget=path.join(out,LOCALE_DIR);
  if(!fs.existsSync(localeSource))throw new Error('RC1555 Sprachpakete fehlen');
  fs.mkdirSync(path.dirname(localeTarget),{recursive:true});
  fs.cpSync(localeSource,localeTarget,{recursive:true,force:true});
  for(const lang of ['de','en','pl','es','fr','it']){
    const target=path.join(localeTarget,`${lang}.json`);
    if(!fs.existsSync(target)||fs.statSync(target).size===0)throw new Error(`RC1555 Sprachpaket fehlt: ${lang}`);
  }
  const entries=['index.html','TESTVERSION.html','demo.html'];
  for(const file of entries){
    const target=path.join(out,file);
    if(!fs.existsSync(target))throw new Error(`RC1555 Build-Datei fehlt: ${file}`);
    fs.writeFileSync(target,injectPackagingMasterdata(fs.readFileSync(target,'utf8'),file));
  }
  const manifest={version:'RC1555',assets:RC1555_PACKAGING_ASSETS.slice(),locales:['de','en','pl','es','fr','it'],entries};
  fs.writeFileSync(path.join(out,'rc1555-packaging-masterdata-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
