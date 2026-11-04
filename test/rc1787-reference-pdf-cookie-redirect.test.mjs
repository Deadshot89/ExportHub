import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../.github/rc1112/build-three-env.mjs',import.meta.url),'utf8');
const anchor=source.indexOf("async function fetchDocBlob(d){");
const start=source.indexOf("if(d.source==='referenceFolder'&&d.itemId){var ref=",anchor);
const end=source.indexOf('}var inline=',start);
assert.ok(anchor>=0&&start>anchor&&end>start,'extract actual injected REF document fetch');
const snippet=source.slice(start,end+1);
const helperStart=source.indexOf('function rc1305RefLogin(response)');
const helperEnd=source.indexOf('if(!d)',helperStart);
assert.ok(helperStart>=0&&helperEnd>helperStart,'extract actual response redirect verifier');
const lower=x=>String(x==null?'':x).trim().toLowerCase();
const q=x=>String(x==null?'':x).trim();
const loginCheck=new Function('low','q',source.slice(helperStart,helperEnd)+';return rc1305RefLogin;')(lower,q);
const run=new Function('d','fetch','referenceHeaders','q','refOf','currentShipmentForDocs','rc1305RefLogin','Date','return (async()=>{'+snippet+'})();');

test('RC1787: referenceFolder PDF GET uses ExportHUB token but no Azure/MS cookies',async()=>{
 const calls=[],pdf={original:true};
 const result=await run({source:'referenceFolder',itemId:'SYNTH-ITEM',reference:'ABC123'},
  async(url,options)=>{calls.push({url,options});return{ok:true,type:'basic',redirected:false,url:'https://example.test/api/reference-files',headers:{get:()=> 'application/pdf'},blob:async()=>pdf}},
  ()=>({'X-ExportHUB-Token':'SYNTH-SESSION'}),q,x=>x,()=>({}),loginCheck,Date);
 assert.equal(result,pdf);
 assert.equal(calls.length,1);
 assert.match(calls[0].url,/^\/api\/reference-files\?reference=ABC123/);
 assert.equal(calls[0].options.headers['X-ExportHUB-Token'],'SYNTH-SESSION');
 assert.equal(calls[0].options.credentials,'omit');
 assert.equal(calls[0].options.redirect,'manual');
});

test('RC1787: Azure redirect never becomes a document Blob',async()=>{
 const cases=[
  {ok:false,type:'opaqueredirect',redirected:false,url:''},
  {ok:true,type:'basic',redirected:true,url:'https://login.microsoftonline.com/'},
  {ok:true,type:'basic',redirected:false,url:'https://example.test/.auth/login/aad'},
  {ok:true,type:'basic',redirected:false,url:'https://example.test/api/reference-files',headers:{get:()=> 'text/html'}}
 ];
 for(const response of cases){
  let blobCalled=false;
  const got={...response,headers:response.headers||{get:()=>''},blob:async()=>{blobCalled=true;return 'fake PDF'}};
  await assert.rejects(run({source:'referenceFolder',itemId:'SYNTH',reference:'ABC123'},
    async()=>got,()=>({'X-ExportHUB-Token':'SYNTH'}),q,x=>x,()=>({}),loginCheck,Date),
    e=>e.code==='REFERENCE_FILE_LOGIN_REDIRECT');
  assert.equal(blobCalled,false);
 }
});

test('RC1787: generic URL fallback preserves unrelated API credential semantics',()=>{
 const start=source.indexOf("var url=q(d.url),urlLower=low(url),localApi=",anchor);
 const end=source.indexOf('}return null}',start);
 assert.ok(start>anchor&&end>start,'actual generic fallback exists');
 const snippet=source.slice(start,end+13);
 assert.match(snippet,/credentials:referenceApi\?'omit':'same-origin'/);
 assert.match(snippet,/redirect:referenceApi\?'manual':'follow'/);
 assert.match(snippet,/if\(referenceApi&&rc1305RefLogin\(r\)\)/);
 assert.match(snippet,/referenceApi=url\.indexOf\('\/api\/reference-files\?'\)===0/);
});

test('RC1787: emitted generic REF URL rejects HTML while unrelated API keeps cookies',async()=>{
 const begin=source.indexOf('`async function fetchDocBlob(d){');
 const end=source.indexOf('\n`',begin+1);
 assert.ok(begin>=0&&end>begin,'complete emitted document fetch exists');
 const emitted=vm.runInNewContext(source.slice(begin,end+2));
 const calls=[];
 let html=false,blobCalls=0;
 const scope={window:{},Blob,q,low:lower,referenceHeaders:()=>({'X-ExportHUB-Token':'SYNTH'}),
  fetch:async(url,options)=>{calls.push({url,options});return{ok:true,type:'basic',redirected:false,url,
   headers:{get:()=>html?'text/html':'application/pdf'},blob:async()=>{blobCalls++;return 'PDF'}}}};
 vm.runInNewContext(emitted,scope);
 assert.equal(await scope.fetchDocBlob({url:'/api/reference-files?itemId=SYNTH'}),'PDF');
 assert.equal(calls[0].options.credentials,'omit');
 assert.equal(calls[0].options.redirect,'manual');
 assert.equal(calls[0].options.headers['X-ExportHUB-Token'],'SYNTH');
 html=true;
 await assert.rejects(scope.fetchDocBlob({url:'/api/reference-files?itemId=SYNTH'}),e=>e.code==='REFERENCE_FILE_LOGIN_REDIRECT');
 assert.equal(blobCalls,1);
 html=false;
 assert.equal(await scope.fetchDocBlob({url:'/api/other-document?itemId=SYNTH'}),'PDF');
 assert.equal(calls[2].options.credentials,'same-origin');
 assert.equal(calls[2].options.redirect,'follow');
});
