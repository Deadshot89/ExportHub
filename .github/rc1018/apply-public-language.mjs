import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const TAG='<script id="exporthub-rc1018-public-language" defer src="/assets/rc1018-public-language.js?v=1018"></script>';
const pages=['customer-avis.html','pickup.html','location.html'];

for(const rel of pages){
  const file=path.join(ROOT,rel);
  let html=fs.readFileSync(file,'utf8');
  if(!html.includes('rc1018-public-language.js?v=1018')){
    const idx=html.search(/<\/head\s*>/i);
    if(idx<0)throw new Error(`${rel}: </head> fehlt`);
    html=html.slice(0,idx)+TAG+'\n'+html.slice(idx);
    fs.writeFileSync(file,html);
  }
}
console.log('RC1018 öffentliche DE/EN-Sprachruntime eingebunden.');
