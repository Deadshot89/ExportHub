import fs from 'node:fs';

function contexts(src,start,end,needle,limit=20,before=500,after=1400){
  const out=[];let pos=start;
  while(out.length<limit){
    const at=src.indexOf(needle,pos);if(at<0||at>end)break;
    out.push(src.slice(Math.max(start,at-before),Math.min(end,at+after)).replace(/\s+/g,' '));
    pos=at+needle.length;
  }
  return out;
}

for(const file of ['dist-rc1016/index.html','dist-rc1016/TESTVERSION.html','dist-rc1016/demo.html']){
  const src=fs.readFileSync(file,'utf8');
  const end=src.indexOf('window.ExportHUBRC544Auth={');
  const start=Math.max(0,end-80000);
  console.log(`\n=== ${file} RC544 range ${start}..${end} ===`);
  if(end<0){console.log('ExportHUBRC544Auth fehlt');continue;}
  for(const needle of ['rightsModules','rightsLabels','initDraft','draft.rights','rights:',"admin-",'rc544Save','data-right','module','level','function render(','function initDraft','function call(']){
    const hits=contexts(src,start,end,needle);
    console.log(`\n--- ${needle}: ${hits.length} ---`);
    hits.forEach((hit,i)=>console.log(`[${i+1}] ${hit}`));
  }
}