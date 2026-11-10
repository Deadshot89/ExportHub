import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1059-document-blob.js','utf8');
const file={name:'DNC123456.pdf',storage:'blob',blobName:'rc1059/production/aa/'+'a'.repeat(64)};

function fixture(results){
 const calls=[],replies=results.slice();
 let ticketCount=0;
 class XHR{
  open(method,url){this.method=method;this.url=url}
  send(){
   const result=replies.shift();
   assert.ok(result,'a ticket was retried more than the fixture allows');
   calls.push({method:this.method,kind:'xhr',url:this.url});
   this.status=result.status;
   this.response=new Blob([result.body],{type:result.mime});
   queueMicrotask(()=>this.onload());
  }
 }
 const w={
  location:{hostname:'www.exporthub360.de',origin:'https://www.exporthub360.de'},
  ExportHUBClean:{runtime:{authToken:'SYNTHETIC-TOKEN',environment:'production'}},
  XMLHttpRequest:XHR,
  fetch:async(url,options)=>{
   if(url.includes('&action=ticket')){
    ticketCount++;
    calls.push({kind:'ticket',url,options});
    return{ok:true,status:200,redirected:false,url:'',type:'basic',
     headers:{get:()=> 'application/json'},
     json:async()=>({ok:true,url:'/api/exporthub-document?ticket=edt1.AAA.T'+ticketCount})};
   }
   calls.push({kind:'blob',url,options});
   const failure=Object.assign(new Error('synthetic blocked header fetch'),{code:'AZURE_ROUTE_BLOCKED'});
   throw failure;
  }
 };
 vm.runInNewContext(source,{window:w,URL,Blob,Uint8Array,String,TypeError});
 return{api:w.ExportHUBDocumentBlob1059,calls,getTicketCount:()=>ticketCount};
}

const expired={status:403,mime:'application/json',body:JSON.stringify({ok:false,code:'DOCUMENT_TICKET_EXPIRED',message:'PRIVATE MESSAGE'})};
const validPdf={status:200,mime:'application/pdf',body:'%PDF-1.7 original'};
const invalid={status:403,mime:'application/json',body:JSON.stringify({ok:false,code:'DOCUMENT_TICKET_INVALID',message:'PRIVATE MESSAGE'})};

test('RC1963: confirmed expired signed ticket renews via authenticated same-origin GET exactly once',async()=>{
 const f=fixture([expired,validPdf]);
 const blob=await f.api.fetchBlob(file);
 assert.equal(await blob.slice(0,5).text(),'%PDF-');
 assert.equal(f.getTicketCount(),2);
 assert.deepEqual(f.calls.filter(x=>x.kind==='xhr').map(x=>x.url),[
  '/api/exporthub-document?ticket=edt1.AAA.T1',
  '/api/exporthub-document?ticket=edt1.AAA.T2'
 ]);
 const tickets=f.calls.filter(x=>x.kind==='ticket');
 assert.equal(tickets.length,2);
 for(const t of tickets){
  assert.equal(t.options.method,'GET');
  assert.equal(t.options.credentials,'omit');
  assert.equal(t.options.headers.Authorization,'Bearer SYNTHETIC-TOKEN');
  assert.ok(!t.url.includes('SYNTHETIC-TOKEN'));
 }
});

test('RC1963: forged or invalid signed ticket 403 never retries or exposes server message',async()=>{
 const f=fixture([invalid]);
 await assert.rejects(()=>f.api.fetchBlob(file),e=>{
  assert.equal(e.status,403);
  assert.notEqual(e.code,'DOCUMENT_TICKET_EXPIRED');
  assert.doesNotMatch(e.message,/PRIVATE MESSAGE/);
  return true;
 });
 assert.equal(f.getTicketCount(),1);
 assert.equal(f.calls.filter(x=>x.kind==='xhr').length,1);
});

test('RC1963: proxy-generated HTML 403 cannot trigger ticket renewal',async()=>{
 const f=fixture([{status:403,mime:'text/html',body:'<html>DOCUMENT_TICKET_EXPIRED</html>'}]);
 await assert.rejects(()=>f.api.fetchBlob(file),e=>e.status===403&&e.code!=='DOCUMENT_TICKET_EXPIRED');
 assert.equal(f.getTicketCount(),1);
});

test('RC1963: a second expired 403 stays rejected after one renewal',async()=>{
 const f=fixture([expired,expired]);
 await assert.rejects(()=>f.api.fetchBlob(file),e=>e.code==='DOCUMENT_TICKET_EXPIRED'&&e.status===403);
 assert.equal(f.getTicketCount(),2);
 assert.equal(f.calls.filter(x=>x.kind==='xhr').length,2);
});

test('RC1963: invalid PDF after a successful retry stays blocked, never silently accepted',async()=>{
 const f=fixture([expired,{status:200,mime:'application/pdf',body:'<html>not a PDF</html>'}]);
 await assert.rejects(()=>f.api.fetchBlob(file),e=>e.code==='DOCUMENT_NOT_PDF');
 assert.equal(f.getTicketCount(),2);
});

test('RC1963: giant or non-JSON 403 cannot be trusted as server expiry',async()=>{
 const f=fixture([{status:403,mime:'application/json',body:JSON.stringify({code:'DOCUMENT_TICKET_EXPIRED',padding:'x'.repeat(5000)})}]);
 await assert.rejects(()=>f.api.fetchBlob(file),e=>e.status===403&&e.code!=='DOCUMENT_TICKET_EXPIRED');
 assert.equal(f.getTicketCount(),1);
});
