import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const files=['index.html','TESTVERSION.html','demo.html'];
const read=p=>fs.readFileSync(p,'utf8');
before(()=>execFileSync(process.execPath,['.github/rc1048/build-three-env.mjs'],{stdio:'pipe'}));

function classicScripts(source){
  const out=[],rx=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;let m;
  while((m=rx.exec(source))){
    const attrs=m[1]||'';if(/\bsrc\s*=/.test(attrs))continue;
    const tm=attrs.match(/\btype\s*=\s*['"]([^'"]+)['"]/i),type=tm?tm[1].trim().toLowerCase():'';
    if(type&&!['text/javascript','application/javascript','text/ecmascript','application/ecmascript'].includes(type))continue;
    out.push({code:m[2],index:m.index,attrs:attrs,openTag:m[0].slice(0,m[0].indexOf('>')+1)});
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
   classicScripts(html).forEach((s,i)=>{try{new vm.Script(s.code,{filename:file+'.inline-'+(i+1)})}catch(e){const p=s.code.indexOf('rc1059-document-blob.js?v=RC1059');const hp=html.indexOf('rc1059-document-blob.js?v=RC1059',s.index);const raw=p>=0?JSON.stringify(s.code.slice(Math.max(0,p-120),Math.min(s.code.length,p+700))):'';const rawHtml=hp>=0?JSON.stringify(html.slice(Math.max(0,hp-160),Math.min(html.length,hp+1200))):'';const card=hp>=0?html.lastIndexOf("'+card.innerHTML+'",hp):-1;const win=hp>=0?html.indexOf('var w=window.open',hp):-1;const close=win>=0?html.lastIndexOf("</body></html>'",win):-1;const tail=win>=0?JSON.stringify(html.slice(Math.max(0,close-800),Math.min(html.length,win+800))):'';fail.push('#'+(i+1)+' @'+s.index+' OPEN='+JSON.stringify(s.openTag)+' '+String(e&&e.stack||e&&e.message||e).split('\n').slice(0,8).join('\n')+(raw?'\nRAW='+raw:'')+(rawHtml?'\nRAWHTML='+rawHtml:'')+'\nPOS card='+card+' hp='+hp+' close='+close+' win='+win+(tail?'\nTAIL='+tail:''))}});
   assert.deepEqual(fail,[],fail.join('\n---\n'));
 });
}


test('RC1068 Diagnose: printStow-Blöcke sind im finalen Build zwischen allen Umgebungen identisch',()=>{
  function blocks(html){
    const out=[];let cursor=0;
    while(true){
      const a=html.indexOf('function printStow(){',cursor);if(a<0)break;
      const b=html.indexOf('function normalizeActionButtons',a);if(b<0){out.push({start:a,end:-1,content:html.slice(a,a+12000)});break}
      out.push({start:a,end:b,content:html.slice(a,b)});cursor=b+30;
    }
    return out;
  }
  const prod=blocks(read('dist-rc1048/index.html'));
  assert.ok(prod.length>0,'Produktion enthält keinen printStow-Block');
  for(const file of ['TESTVERSION.html','demo.html']){
    const other=blocks(read('dist-rc1048/'+file));
    assert.equal(other.length,prod.length,file+': printStow-Anzahl abweichend');
    other.forEach((row,i)=>{
      if(row.content!==prod[i].content){
        let p=0,min=Math.min(row.content.length,prod[i].content.length);
        while(p<min&&row.content[p]===prod[i].content[p])p++;
        assert.fail(file+' printStow #'+(i+1)+' weicht ab Position '+p+'; prodLen='+prod[i].content.length+' otherLen='+row.content.length+'\nPROD='+JSON.stringify(prod[i].content.slice(Math.max(0,p-200),p+900))+'\nOTHER='+JSON.stringify(row.content.slice(Math.max(0,p-200),p+1400)));
      }
    });
  }
});


test('RC1068 final render: RC373 Shipment-Controller ist in allen Umgebungen eindeutig vorhanden',()=>{
  for(const file of files){
    const html=read('dist-rc1048/'+file),scripts=classicScripts(html);
    const hits=scripts.filter(x=>x.openTag==='<script id="exporthub-rc373-shipment-controller">');
    assert.equal(hits.length,1,file+': RC373 Shipment-Controller muss genau einmal als klassischer Scriptblock vorliegen');
    assert.match(hits[0].code,/function\s+printStow\s*\(/,file+': printStow fehlt im RC373 Shipment-Controller');
    assert.match(hits[0].code,/function\s+normalizeActionButtons\s*\(/,file+': normalizeActionButtons fehlt im RC373 Shipment-Controller');
  }
});
