'use strict';
const fs=require('fs');
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
extract('printStow',['normalizeActionButtons','activateQr'],18000);
extract('activateQr',['canonicalMail','canonicalColliCard'],22000);
extract('updateQr',['activateQr','canonicalMail'],12000);
context('id="loadListDoc"',1600,8000);
context("getElementById('loadListDoc')",1800,9000);
context("querySelector('#loadListDoc')",1800,9000);
context('/api/pickup-init',2600,8500);
