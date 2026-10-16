import fs from 'node:fs';
import path from 'node:path';

export const ABD_PROFORMA_ASSETS=['assets/rc1549-abd-proforma.js'];
export const ABD_PROFORMA_MARKERS=['exporthub-rc1549-abd-proforma','assets/rc1549-abd-proforma.js?v=1549'];
const ENTRIES=['index.html','TESTVERSION.html','demo.html'];
const TAG='<script id="exporthub-rc1549-abd-proforma" defer src="/assets/rc1549-abd-proforma.js?v=1549"></script>';

function copyFile(root,out,rel){
 const source=path.join(root,rel),target=path.join(out,rel);
 if(!fs.existsSync(source))throw new Error(`RC1549 Pflicht-Asset fehlt: ${rel}`);
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target)
}
function inject(html,file){
 if(html.includes('id="exporthub-rc1549-abd-proforma"'))return html;
 const index=html.toLowerCase().indexOf('</head>');
 if(index<0)throw new Error(`RC1549 ${file}: </head>-Anker fehlt`);
 return html.slice(0,index)+TAG+'\n'+html.slice(index)
}
export function integrateAbdProforma(root,out){
 for(const rel of ABD_PROFORMA_ASSETS)copyFile(root,out,rel);
 for(const file of ENTRIES){
  const target=path.join(out,file);if(!fs.existsSync(target))throw new Error(`RC1549 Build-Datei fehlt: ${file}`);
  const next=inject(fs.readFileSync(target,'utf8'),file);fs.writeFileSync(target,next);
  for(const marker of ABD_PROFORMA_MARKERS)if(!next.includes(marker))throw new Error(`RC1549 ${file}: Pflichtmarker fehlt: ${marker}`)
 }
 return out
}
