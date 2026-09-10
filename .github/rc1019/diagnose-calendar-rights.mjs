import fs from 'node:fs';

const files=['index.html','TESTVERSION.html'];
const needles=['function renderRights','renderRights=function','rights-table','rights-module','function rightFor','rightFor=function','data-right','data-module','MODULES','RIGHT_MODULES','moduleLabels','window.rc','Benutzer & Rechte'];
function contexts(source,needle,limit=20,before=1200,after=4200){
  const out=[];let pos=0;
  while(out.length<limit){
    const idx=source.indexOf(needle,pos);if(idx<0)break;
    out.push(source.slice(Math.max(0,idx-before),Math.min(source.length,idx+after)).replace(/\s+/g,' '));
    pos=idx+needle.length;
  }
  return out;
}
for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  console.log(`\n===== ${file} (${source.length} Zeichen) =====`);
  for(const needle of needles){
    const hits=contexts(source,needle);
    console.log(`\n--- ${needle}: ${hits.length} Treffer (max 20) ---`);
    hits.forEach((hit,i)=>console.log(`[${i+1}] ${hit}`));
  }
}
