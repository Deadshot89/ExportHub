import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src=readFileSync(new URL('../assets/rc1014-shipment-overview.js',import.meta.url),'utf8');
const start=src.indexOf('  async function fetchContainerBlob(');
const end=src.indexOf('  function hydrateContainerImages(',start);
assert.ok(start>0&&end>start,'Container image downloader must be available');
const body=src.slice(start,end);
async function fetchImage(response) {
 const context={
  fetch:async()=>response,
  Blob,
  console
 };
 const code="const root=globalThis;\nconst q=v=>String(v==null?'':v).trim();\n"+
 "function photoUrl(){return '/api/container-document?reference=ABC123&file=container-loaded'};\n"+
 "function apiHeaders(){return {'X-ExportHUB-Token':'test-session'}};\n"+
 body+"\nfetchContainerBlob({reference:'ABC123'},{id:'container-loaded'})";
 return vm.runInNewContext(code,context);
}
function response(type,body,options={}){
 const blob=new Blob([body],{type});
 return {ok:true,redirected:false,url:'https://exporthub360.com/api/container-document',
  headers:{get:key=>key.toLowerCase()==='content-type'?type:null},
  blob:async()=>blob,...options};
}
test('P2: real JPEG is accepted for shipment photo preview',async()=>{
 const blob=await fetchImage(response('image/jpeg',new Uint8Array([255,216,255,217])));
 assert.equal(blob.type,'image/jpeg');
 assert.equal(blob.size,4);
});
test('P2: Microsoft-login HTML with HTTP 200 must not appear as photo',async()=>{
 await assert.rejects(fetchImage(response('text/html','<html>Login</html>')),/umgeleitet|HTML/);
});
test('P2: intercepted authentication redirects must be rejected',async()=>{
 await assert.rejects(fetchImage(response('image/jpeg','irrelevant',{type:'opaqueredirect'})),/umgeleitet|HTML/);
});
test('P2: invalid or empty files cannot be presented as successful photos',async()=>{
 await assert.rejects(fetchImage(response('application/json','{}')),/Bilddatei/);
 await assert.rejects(fetchImage(response('image/jpeg','')),/Bilddatei/);
});
