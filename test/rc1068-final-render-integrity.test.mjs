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
    const attrs=m[1]||'';
    if(/\bsrc\s*=/.test(attrs))continue;
    const tm=attrs.match(/\btype\s*=\s*['"]([^'"]+)['"]/i),type=tm?tm[1].trim().toLowerCase():'';
    if(type&&!['text/javascript','application/javascript','text/ecmascript','application/ecmascript'].includes(type))continue;
    out.push({code:m[2],index:m.index,openTag:m[0].slice(0,m[0].indexOf('>')+1)});
  }
  return out;
}
function outside(source){
  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ')
    .replace(/<!--[\s\S]*?-->/g,' ');
}
function controller(html,file){
  const open='<script id="exporthub-rc373-shipment-controller">';
  const boundary='<style id="exporthub-rc373-customer-areas-style">';
  const a=html.indexOf(open),b=a>=0?html.indexOf(boundary,a+open.length):-1;
  assert.ok(a>=0,file+': RC373 Shipment-Controller fehlt');
  assert.ok(b>a,file+': RC373 Folgeanker fehlt');
  return html.slice(a,b);
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
    const html=read('dist-rc1048/'+file),text=outside(html);
    for(const rx of forbidden)assert.doesNotMatch(text,rx,file+' enthält sichtbaren Code-Leak '+rx);
  });

  test('RC1068 final render: '+file+' alle klassischen Inline-Scripts sind syntaktisch gültig',()=>{
    const html=read('dist-rc1048/'+file),fail=[];
    classicScripts(html).forEach((s,i)=>{
      try{new vm.Script(s.code,{filename:file+'.inline-'+(i+1)})}
      catch(e){fail.push('#'+(i+1)+' @'+s.index+' '+s.openTag+' :: '+String(e&&e.message||e))}
    });
    assert.deepEqual(fail,[],fail.join('\n'));
  });

  test('RC1068 final render: '+file+' Stauplan enthält kein echtes eingebettetes Script-Ende',()=>{
    const block=controller(read('dist-rc1048/'+file),file);
    assert.match(block,/function printStow\(\)/);
    const realClosers=(block.match(/<\/script\s*>/gi)||[]).length;
    assert.equal(realClosers,1,file+': im RC373-Controller darf nur das echte Controller-Ende </script> stehen');
    if(block.includes('rc1059-document-blob.js'))assert.match(block,/<\\\/script>/);
  });
}

test('RC1068: RC373 Shipment-Controller ist in Produktion TESTSERVICE und Demo identisch',()=>{
  const prod=controller(read('dist-rc1048/index.html'),'index.html');
  assert.equal(controller(read('dist-rc1048/TESTVERSION.html'),'TESTVERSION.html'),prod);
  assert.equal(controller(read('dist-rc1048/demo.html'),'demo.html'),prod);
});
