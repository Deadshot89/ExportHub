import fs from 'node:fs';

const files=['index.html','TESTVERSION.html'];
const needles=['pickupcalendar','Abholkalender','function canRead','function canEdit','canRead=','canEdit=','rights','Berechtigung','Benutzer'];
function contexts(source,needle,limit=12){
  const out=[];let pos=0;
  while(out.length<limit){
    const idx=source.indexOf(needle,pos);if(idx<0)break;
    out.push(source.slice(Math.max(0,idx-700),Math.min(source.length,idx+1200)).replace(/\s+/g,' '));
    pos=idx+needle.length;
  }
  return out;
}
for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  console.log(`\n===== ${file} (${source.length} Zeichen) =====`);
  for(const needle of needles){
    const hits=contexts(source,needle);
    console.log(`\n--- ${needle}: ${hits.length} Treffer (max 12) ---`);
    hits.forEach((hit,i)=>console.log(`[${i+1}] ${hit}`));
  }
}
