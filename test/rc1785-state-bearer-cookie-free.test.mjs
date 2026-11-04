import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {patchRc1785StateBearerCookies,assertRc1785ShippedStateFetch} from '../scripts/rc1785-state-bearer-cookie-free.mjs';

const input=fs.readFileSync('dist-rc1048/TESTVERSION.html','utf8');
const START='async function jsonFetch(url,options){';
const END='async function parseLargeJson(textValue){';

function boot(html,token='VALID-TAB-SESSION'){
 const start=html.indexOf(START),end=html.indexOf(END,start+START.length);
 assert.ok(start>=0&&end>start,'exact team-state reader is required');
 const calls=[];
 const scope={
  runtime:{authToken:token},
  text:value=>String(value==null?'':value).trim(),
  resilientFetch:async(url,opts)=>{
   calls.push({url,opts});
   // Reproduce the platform-cookie routing failure WITHOUT contacting Azure.
   if(/^\/api\/exporthub-state(?:[?#]|$)/i.test(String(url))&&opts.credentials==='same-origin')
    throw Object.assign(new Error('Azure Microsoft redirect'),{code:'AZURE_ROUTE_BLOCKED'});
   return{status:200,ok:true,text:async()=>JSON.stringify({ok:true})};
  }
 };
 const jsonFetch=vm.runInNewContext(html.slice(start,end)+'\njsonFetch',scope);
 return{jsonFetch,calls};
}

test('RC1785: current unpatched team-state client reproduces Azure cookie redirect',async()=>{
 const original=boot(input);
 await assert.rejects(original.jsonFetch('/api/exporthub-state?mode=read',{method:'POST'}),
  e=>e.code==='AZURE_ROUTE_BLOCKED');
 assert.equal(original.calls[0].opts.credentials,'same-origin');
});

test('RC1785: token-authenticated state read and save omit platform cookies but retain bearer',async()=>{
 const html=patchRc1785StateBearerCookies(input,'TESTVERSION.html');
 assertRc1785ShippedStateFetch(html,'TESTVERSION.html');
 const {jsonFetch,calls}=boot(html);
 for(const mode of ['read','save']){
  assert.equal((await jsonFetch('/api/exporthub-state?mode='+mode,{method:'POST'})).ok,true);
 }
 assert.equal(calls.length,2);
 for(const call of calls){
  assert.equal(call.opts.credentials,'omit');
  assert.equal(call.opts.headers.Authorization,'Bearer VALID-TAB-SESSION');
  assert.equal(call.opts.headers['X-ExportHUB-Token'],'VALID-TAB-SESSION');
 }
});

test('RC1785: other endpoints and explicit cookie policy are unchanged',async()=>{
 const {jsonFetch,calls}=boot(patchRc1785StateBearerCookies(input,'TESTVERSION.html'));
 await jsonFetch('/api/exporthub-auth',{method:'POST'});
 await jsonFetch('/api/pack-notification',{method:'POST'});
 await jsonFetch('/api/exporthub-state?mode=read',{method:'POST',credentials:'include'});
 assert.deepEqual(calls.map(c=>c.opts.credentials),['same-origin','same-origin','include']);
});

test('RC1785: without an ExportHUB bearer session no unauthenticated state request changes cookie policy',async()=>{
 const {jsonFetch,calls}=boot(patchRc1785StateBearerCookies(input,'TESTVERSION.html'),'');
 await assert.rejects(jsonFetch('/api/exporthub-state?mode=read',{method:'POST'}),
  e=>e.code==='AZURE_ROUTE_BLOCKED');
 assert.equal(calls[0].opts.credentials,'same-origin');
 assert.equal(calls[0].opts.headers.Authorization,undefined);
});

test('RC1785: build patch is idempotent and fails closed for missing/modified transport',()=>{
 const html=patchRc1785StateBearerCookies(input,'TESTVERSION.html');
 assert.equal(patchRc1785StateBearerCookies(html,'TESTVERSION.html'),html);
 assert.throws(()=>patchRc1785StateBearerCookies('<html></html>','TESTVERSION.html'),/transport missing/);
 const broken=html.replace("opts.credentials='omit';","opts.credentials='same-origin';");
 assert.throws(()=>assertRc1785ShippedStateFetch(broken,'TESTVERSION.html'),/guard missing/);
});

test('RC1785: three-environment builder patches deployed HTML and verifies final artifacts after fingerprinting',()=>{
 const source=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 assert.match(source,/import \{patchRc1785StateBearerCookies,assertRc1785ShippedStateFetch\}/);
 assert.match(source,/html=patchRc1785StateBearerCookies\(html,file\)/);
 const fingerprint=source.indexOf('fingerprintAssets({root:ROOT,out:OUT});');
 const finalSource=source.indexOf("const shipped=fs.readFileSync(path.join(OUT,file),'utf8');",fingerprint);
 const assertFinal=source.indexOf('assertRc1785ShippedStateFetch(shipped,file)',finalSource);
 assert.ok(fingerprint>=0&&finalSource>fingerprint&&assertFinal>finalSource);
 for(const env of ['index.html','TESTVERSION.html','demo.html']){
  const html=fs.readFileSync('dist-rc1048/'+env,'utf8');
  assertRc1785ShippedStateFetch(patchRc1785StateBearerCookies(html,env),env);
 }
});
