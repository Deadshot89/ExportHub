import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1059-document-blob.js','utf8');
const file={name:'DNC3019222063.pdf',storage:'blob',blobName:'rc1059/testservice/aa/'+('a'.repeat(64))};
function viewer({runtime={},session,reply}={}){
 const calls=[];
 const w={
  location:{hostname:'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'},
  ExportHUBClean:{runtime},
  sessionStorage:{getItem(key){return key==='exporthub_rc301_tab_session'?(session?JSON.stringify(session):null):null}},
  fetch:async(url,options)=>{calls.push({url,options});return reply},
 };
 vm.runInNewContext(source,{window:w});
 return{api:w.ExportHUBDocumentBlob1059,calls};
}

test('RC1702: Packmeldung retrieves original PDF with authenticated session restored from same tab',async()=>{
 const response={
  ok:true,status:200,redirected:false,type:'basic',url:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net/api/exporthub-document',
  headers:{get(name){return name==='content-type'?'application/pdf':null}},
  async blob(){return new Blob(['%PDF-1.7'],{type:'application/pdf'})}
 };
 const {api,calls}=viewer({session:{token:'VALID-TAB-SESSION',user:{id:'u-1'},environment:'testservice'},reply:response});
 const bytes=await api.fetchBytes(file);
 assert.equal(bytes.length,8);
 assert.equal(calls.length,1);
 assert.equal(calls[0].options.headers.Authorization,'Bearer VALID-TAB-SESSION');
 assert.equal(calls[0].options.headers['X-ExportHUB-Environment'],'testservice');
 assert.equal(calls[0].options.redirect,'manual','do not follow Azure redirect to Microsoft');
 assert.match(calls[0].url,/environment=testservice/);
});

test('RC1702: authenticated current runtime token takes priority over stored tab token',()=>{
 const {api}=viewer({runtime:{authToken:'LIVE'},session:{token:'STALE',user:{id:'u-1'}},reply:{}});
 assert.equal(api.headers().Authorization,'Bearer LIVE');
});

test('RC1702: session from another environment must never authorize TESTSERVICE document download',()=>{
 const {api}=viewer({session:{token:'PROD-TOKEN',user:{id:'u-1'},environment:'production'},reply:{}});
 assert.throws(()=>api.headers(),/login/i);
});

test('RC1702: Microsoft redirect is rejected without downloading login HTML as a document',async()=>{
 const {api}=viewer({session:{token:'VALID',user:{id:'u-1'}},reply:{
  ok:false,status:0,type:'opaqueredirect',redirected:false,url:''
 }});
 await assert.rejects(api.fetchBlob(file),err=>err.code==='DOCUMENT_API_LOGIN_REDIRECT');
});

test('RC1702: HTTP 200 HTML login page is never accepted as PDF',async()=>{
 const {api}=viewer({session:{token:'VALID',user:{id:'u-1'}},reply:{
  ok:true,status:200,type:'basic',redirected:false,url:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net/.auth/login/aad',
  headers:{get(){return'text/html'}},
  async blob(){return new Blob(['<html>login</html>'],{type:'text/html'})}
 }});
 await assert.rejects(api.fetchBlob(file),err=>err.code==='DOCUMENT_API_LOGIN_REDIRECT');
});

test('RC1702: HTTP 200 HTML body from API is rejected even with benign URL and missing response headers',async()=>{
 const {api}=viewer({session:{token:'VALID',user:{id:'u-1'}},reply:{
  ok:true,status:200,type:'basic',redirected:false,url:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net/api/exporthub-document',
  async blob(){return new Blob(['<html>login</html>'],{type:'text/html'})}
 }});
 await assert.rejects(api.fetchBlob(file),err=>err.code==='DOCUMENT_API_LOGIN_REDIRECT');
});
