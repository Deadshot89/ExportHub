import fs from 'node:fs';
import path from 'node:path';

const file=path.join(process.cwd(),'customer-avis.html');
const tag='<script id="exporthub-rc1454-avis-download-all-ui" defer src="/assets/rc1454-avis-download-all-ui.js?v=1454"></script>';
let html=fs.readFileSync(file,'utf8');
const rx=/<script\b[^>]*id=["']exporthub-rc1454-avis-download-all-ui["'][^>]*><\/script>/i;
if(rx.test(html))html=html.replace(rx,tag);
else{
  const index=html.search(/<\/head\s*>/i);
  if(index<0)throw new Error('customer-avis.html: </head> fehlt');
  html=html.slice(0,index)+tag+'\n'+html.slice(index);
}
fs.writeFileSync(file,html);
console.log('RC1454 AVIS-Sammeldownload-UI eingebunden.');
