import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const rel='assets/rc1460-shipment-view-files-avis-preview.js';
const file=path.join(ROOT,rel);
let source=fs.readFileSync(file,'utf8');

const before="a.textContent='AVIS öffnen';";
const after="a.textContent='AVIS · '+tr('common.open','Öffnen');";
const helper="function tr(key,fallback){try{var i18n=w.ExportHUBI18n;if(i18n&&typeof i18n.t==='function'){var value=q(i18n.t(key));if(value&&value!==key)return value}}catch(_){}return fallback}\n";

if(!source.includes(after)){
  const count=source.split(before).length-1;
  if(count!==1)throw new Error('RC1461 AVIS-open anchor expected once, found '+count);
  if(!source.includes('function tr(key,fallback)')){
    const anchor="function q(v){return String(v==null?'':v).trim()}\n";
    if(!source.includes(anchor))throw new Error('RC1461 i18n helper anchor missing');
    source=source.replace(anchor,anchor+helper);
  }
  source=source.replace(before,after);
  fs.writeFileSync(file,source,'utf8');
}

const verify=fs.readFileSync(file,'utf8');
if(!verify.includes("tr('common.open','Öffnen')")||verify.includes("a.textContent='AVIS öffnen'")){
  throw new Error('RC1461 AVIS open label is not routed through central i18n');
}
console.log('RC1461 shipment AVIS open label i18n fix applied');
