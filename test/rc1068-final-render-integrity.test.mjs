import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const files=['index.html','TESTVERSION.html','demo.html'];
before(()=>execFileSync(process.execPath,['.github/rc1048/build-three-env.mjs'],{stdio:'pipe'}));

function classicScripts(source){
  const out=[],rx=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;let m;
  while((m=rx.exec(source))){
    const attrs=m[1]||'';if(/\bsrc\s*=/.test(attrs))continue;
    const tm=attrs.match(/\btype\s*=\s*['"]([^'"]+)['"]/i),type=tm?tm[1].trim().toLowerCase():'';
    if(type&&!['text/javascript','application/javascript','text/ecmascript','application/ecmascript'].includes(type))continue;
    out.push({code:m[2],index:m.index});
  }
  return out;
}
function outside(source){
  return source
   .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,m=>' '.repeat(Math.min(m.length,40)))
   .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,m=>' '.repeat(Math.min(m.length,40)))
   .replace(/<!--[\s\S]*?-->/g,' ');
}
const forbidden=[
 /function\s+normalizeActionButtons\s*\(/,
 /function\s+activateQr\s*\(/,
 /function\s+canonicalMail\s*\(/,
 /function\s+canonicalColliCard\s*\(/,
 /var\s+w\s*=\s*window\.open\s*\(\s*['"]about:blank['"]/,
 /style\.textContent\s*=\s*['"]\.rc894-full-stack/
];

for(const file of files){
 test('RC1068 final render: '+file+' enthält kein JavaScript/CSS als sichtbaren Seitentext',()=>{
   const html=fs.readFileSync('dist-rc1048/'+file,'utf8'),text=outside(html);
   for(const rx of forbidden){
     const m=rx.exec(text);
     if(m){
       const i=m.index,start=Math.max(0,i-900),end=Math.min(text.length,i+3500);
       assert.fail(file+' Leak '+rx+' @'+i+'\n---AUSSCHNITT---\n'+text.slice(start,end)+'\n---ENDE---');
     }
   }
 });
 test('RC1068 final render: '+file+' alle klassischen Inline-Scripts sind syntaktisch gültig',()=>{
   const html=fs.readFileSync('dist-rc1048/'+file,'utf8'),fail=[];
   classicScripts(html).forEach((s,i)=>{try{new vm.Script(s.code,{filename:file+'.inline-'+(i+1)})}catch(e){const p=s.code.indexOf('rc1059-document-blob.js?v=RC1059');const raw=p>=0?JSON.stringify(s.code.slice(Math.max(0,p-120),Math.min(s.code.length,p+700))):'';fail.push('#'+(i+1)+' @'+s.index+' '+String(e&&e.stack||e&&e.message||e).split('\n').slice(0,8).join('\n')+(raw?'\nRAW='+raw:''))}});
   assert.deepEqual(fail,[],fail.join('\n---\n'));
 });
}
