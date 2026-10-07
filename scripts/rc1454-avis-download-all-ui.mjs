import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const file=path.join(root,'customer-avis.html');
const runtimeFile=path.join(root,'assets/rc1454-avis-download-all-ui.js');
const runtime=fs.readFileSync(runtimeFile,'utf8').replace(/<\/script/gi,'<\\/script');
const tag='<script id="exporthub-rc1454-avis-download-all-ui">\n'+runtime+'\n</script>';
let html=fs.readFileSync(file,'utf8');
const rx=/<script\b[^>]*id=["']exporthub-rc1454-avis-download-all-ui["'][^>]*>[\s\S]*?<\/script>/i;
if(rx.test(html))html=html.replace(rx,tag);
else{
  const index=html.search(/<\/head\s*>/i);
  if(index<0)throw new Error('customer-avis.html: </head> fehlt');
  html=html.slice(0,index)+tag+'\n'+html.slice(index);
}
fs.writeFileSync(file,html);
console.log('RC1454 AVIS-Sammeldownload-UI inline eingebunden.');
