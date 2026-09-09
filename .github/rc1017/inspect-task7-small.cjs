'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=process.cwd();
const html=fs.readFileSync('index.html','utf8');

function extract(name,nextNames,max=16000){
  const variants=['function '+name+'(','async function '+name+'('];
  let start=-1;
  for(const v of variants){const p=html.indexOf(v);if(p>=0&&(start<0||p<start))start=p;}
  console.log('\n===== '+name+' @'+start+' =====');
  if(start<0)return;
  let end=Math.min(html.length,start+max);
  for(const n of nextNames||[]){
    for(const v of ['function '+n+'(','async function '+n+'(']){
      const p=html.indexOf(v,start+1);if(p>start&&p<end)end=p;
    }
  }
  console.log(html.slice(start,end));
}
function context(needle,before=1200,after=5000){
  const p=html.indexOf(needle);
  console.log('\n===== '+needle+' @'+p+' =====');
  if(p>=0)console.log(html.slice(Math.max(0,p-before),Math.min(html.length,p+after)));
}
function walk(dir,out=[]){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(['.git','node_modules','dist-rc1013','dist-rc1016'].includes(entry.name))continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full,out);
    else if(/\.(?:js|mjs|cjs|html|css|json|yml|yaml)$/i.test(entry.name))out.push(full);
  }
  return out;
}
function repoSearch(needle,limit=30,span=2200){
  console.log('\n######## REPO SEARCH: '+needle+' ########');
  let count=0;
  for(const file of walk(ROOT)){
    let text='';try{text=fs.readFileSync(file,'utf8')}catch(_){continue}
    let at=0;
    while((at=text.indexOf(needle,at))>=0){
      console.log('\n--- '+path.relative(ROOT,file)+' @'+at+' ---');
      console.log(text.slice(Math.max(0,at-span),Math.min(text.length,at+span)));
      count++;at+=needle.length;if(count>=limit){console.log('LIMIT '+limit+' erreicht');return}
    }
  }
  if(!count)console.log('NOT_FOUND');
}

extract('printStow',['normalizeActionButtons','activateQr'],18000);
extract('activateQr',['canonicalMail','canonicalColliCard'],22000);
extract('updateQr',['activateQr','canonicalMail'],12000);
context('rc363PrintAll',2400,9000);
context('Gesamtdruck',2400,9000);
context('Ladeliste',2400,9000);
repoSearch('ExportHUBPickupPOD',20,3000);
repoSearch('/api/pickup-init',20,3000);
repoSearch('rc363PrintAll',20,3000);
repoSearch('Ladeliste',25,3000);
