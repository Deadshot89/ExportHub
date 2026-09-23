import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const pages=['customer-avis.html','pickup.html','location.html'];

for(const rel of pages){
  const file=path.join(ROOT,rel),version=rel==='customer-avis.html'?'1231':'1018';
  const tag='<script id="exporthub-rc1018-public-language" defer src="/assets/rc1018-public-language.js?v='+version+'"></script>';
  let html=fs.readFileSync(file,'utf8');
  const rx=/<script\b[^>]*id=["']exporthub-rc1018-public-language["'][^>]*><\/script>/i;
  if(rx.test(html))html=html.replace(rx,tag);
  else{
    const idx=html.search(/<\/head\s*>/i);
    if(idx<0)throw new Error(`${rel}: </head> fehlt`);
    html=html.slice(0,idx)+tag+'\n'+html.slice(idx);
  }
  fs.writeFileSync(file,html);
}
console.log('RC1018 öffentliche DE/EN-Sprachruntime eingebunden.');
