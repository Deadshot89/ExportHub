import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
import {Readable} from 'node:stream';

// RC1803: Zscaler (redirect marker `_sm_nck=1`) redirects PDF downloads. A
// fetch with ExportHUB headers cannot follow that redirect, so every
// Lieferschein in a shipment created from a Packmeldung failed in production
// with AZURE_ROUTE_BLOCKED. The PDF is now opened through a short-lived ticket
// URL as a plain navigation that the web filter can redirect.
const require=createRequire(import.meta.url);
process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='rc1803-test-connection';
const hash='c'.repeat(64),blobName=`rc1059/production/cc/${hash}`;
const prodHost='wonderful-forest-0f315e310.7.azurestaticapps.net';

function loadEndpoint(){
  const target=path.resolve('api/exporthub-document/index.js');
  const original=Module._load;
  const reads=[];
  const fastAuth={async validateSession(req){
    const h=req&&req.headers||{};
    if(!String(h.authorization||'').startsWith('Bearer ')){const e=new Error('login');e.code='AUTH_REQUIRED';e.status=401;throw e;}
    return {user:{id:'U1'},session:{id:'S1'}};
  }};
  const blob=name=>({async download(){reads.push(name);return{readableStreamBody:Readable.from(Buffer.from('%PDF-1.7 rc1803')),contentType:'application/pdf'};}});
  const service={getContainerClient(){return{getBlockBlobClient:blob};}};
  Module._load=function(request,parent,isMain){
    if(request==='../shared/fast-auth-store')return fastAuth;
    if(request==='../shared/blob-rest')return{createBlobServiceClient(){return service;}};
    return original.call(this,request,parent,isMain);
  };
  delete require.cache[target];
  try{const mod=require(target);mod.reads=reads;return mod;}finally{Module._load=original;}
}
async function call(endpoint,query,{authorization='',host=prodHost}={}){
  const context={res:null,log:{error(){}}};
  await endpoint(context,{method:'GET',headers:{host,authorization},query});
  return context.res;
}

test('RC1803: ticket request needs an ExportHUB session and returns only a ticket URL',async()=>{
  const endpoint=loadEndpoint();
  const denied=await call(endpoint,{blob:blobName,environment:'production',action:'ticket'});
  assert.equal(denied.status,401);
  const res=await call(endpoint,{blob:blobName,environment:'production',action:'ticket',name:'DNC3019228460.pdf'},{authorization:'Bearer ehs1.a.b'});
  assert.equal(res.status,200);
  const body=JSON.parse(res.body);
  assert.match(body.url,/^\/api\/exporthub-document\?ticket=edt1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.doesNotMatch(body.url,/ehs1|Bearer/,'the session token never appears in the URL');
  assert.equal(endpoint.reads.length,0,'issuing a ticket does not read the PDF');
});

test('RC1803: the ticket URL serves the PDF without session headers, also after the filter adds _sm_nck=1',async()=>{
  const endpoint=loadEndpoint();
  const issued=JSON.parse((await call(endpoint,{blob:blobName,environment:'production',action:'ticket',name:'DNC3019228460.pdf'},{authorization:'Bearer ehs1.a.b'})).body);
  const ticket=decodeURIComponent(issued.url.split('ticket=')[1]);
  const res=await call(endpoint,{ticket,_sm_nck:'1'});
  assert.equal(res.status,200);
  assert.equal(res.isRaw,true);
  assert.equal(res.body.toString(),'%PDF-1.7 rc1803');
  assert.match(res.headers['Content-Disposition'],/^inline; filename="DNC3019228460\.pdf"/);
  assert.equal(res.headers['Cache-Control'],'private, no-store');
  const download=await call(endpoint,{ticket,download:'1'});
  assert.match(download.headers['Content-Disposition'],/^attachment; filename="DNC3019228460\.pdf"/);
  assert.deepEqual(endpoint.reads,[blobName,blobName]);
});

test('RC1803: forged, expired or foreign-environment tickets are rejected',async()=>{
  const endpoint=loadEndpoint();
  const good=endpoint.createTicket(blobName,'production','a.pdf');
  const parts=good.split('.');
  const forgedPayload=Buffer.from(JSON.stringify({v:1,p:'exporthub-document',b:`rc1059/production/dd/${'d'.repeat(64)}`,e:'production',n:'x',x:Date.now()+60000})).toString('base64url');
  // Flip a significant signature character; replacing its suffix with AA can
  // accidentally leave a valid HMAC unchanged when it already ends in AA.
  const tamperedSignature=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
  for(const ticket of ['edt1.x.y',`edt1.${forgedPayload}.${parts[2]}`,`${parts[0]}.${parts[1]}.${tamperedSignature}`]){
    const res=await call(endpoint,{ticket});
    assert.equal(res.status,403,ticket);
    assert.equal(JSON.parse(res.body).code,'DOCUMENT_TICKET_INVALID');
  }
  const expired=endpoint.createTicket(blobName,'production','a.pdf',Date.now()-6*60*1000);
  const old=await call(endpoint,{ticket:expired});
  assert.equal(old.status,403);
  assert.equal(JSON.parse(old.body).code,'DOCUMENT_TICKET_EXPIRED');
  const onTest=await call(endpoint,{ticket:good},{host:'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'});
  assert.equal(onTest.status,409,'a production ticket never opens on TESTSERVICE');
  assert.equal(endpoint.reads.length,0);
});

test('RC1803: a TESTSERVICE ticket opens when the function host is not the public host (Azure SWA backend)',async()=>{
  const endpoint=loadEndpoint();
  const testBlob=`rc1059/testservice/81/${'8'.repeat(64)}`;
  const internalHost='exporthub-api.internal.azurewebsites.net';
  const issued=await call(endpoint,{blob:testBlob,environment:'testservice',action:'ticket',name:'DNC1.pdf'},{authorization:'Bearer ehs1.a.b',host:internalHost});
  assert.equal(issued.status,200);
  const ticket=decodeURIComponent(JSON.parse(issued.body).url.split('ticket=')[1]);
  const res=await call(endpoint,{ticket},{host:internalHost});
  assert.equal(res.status,200,'navigation without ?environment= must use the signed ticket environment');
  assert.equal(Buffer.from(res.body).subarray(0,5).toString('latin1'),'%PDF-');
  const onProd=await call(endpoint,{ticket},{host:prodHost});
  assert.equal(onProd.status,409,'a TESTSERVICE ticket never opens on the production host');
  const forced=await call(endpoint,{ticket,environment:'production'},{host:internalHost});
  assert.equal(forced.status,409,'an explicit foreign environment hint is still rejected');
});

function browser({ticketReply,blobReply,throwBlob}={}){
  const source=fs.readFileSync('assets/rc1059-document-blob.js','utf8');
  const events=[],calls=[];
  const tab={closed:false,opener:'x',location:{set href(v){events.push('navigate:'+v);}},close(){this.closed=true;events.push('close');}};
  const anchors=[];
  class XHR{open(m,u){this.url=u;calls.push({xhr:u});}send(){this.status=200;this.response=new Blob(['%PDF-1.7'],{type:'application/pdf'});events.push('xhr:'+this.url);this.onload();}}
  const w={
    location:{hostname:'wonderful-forest-0f315e310.7.azurestaticapps.net',origin:'https://wonderful-forest-0f315e310.7.azurestaticapps.net'},
    ExportHUBClean:{runtime:{authToken:'T'}},
    open(url,target){events.push('open:'+url);return tab;},
    fetch:async(url,options)=>{calls.push({url,options});
      if(/action=ticket/.test(url)){events.push('ticket');return ticketReply;}
      events.push('fetch');if(throwBlob){const e=new Error('Zscaler');e.code='AZURE_ROUTE_BLOCKED';throw e;}return blobReply;},
    XMLHttpRequest:XHR,
    document:{createElement(){const a={click(){events.push('click:'+a.href+':'+a.download);},remove(){}};anchors.push(a);return a;},body:{appendChild(){}}},
    URL:{createObjectURL(){return'blob:pdf';},revokeObjectURL(){}},
    setTimeout(){}
  };
  vm.runInNewContext(source,{window:w,URL,Blob,Uint8Array,String,TypeError});
  return{api:w.ExportHUBDocumentBlob1059,events,calls,tab};
}
const ticketJson={ok:true,status:200,type:'basic',redirected:false,url:'',headers:{get(){return'application/json';}},async json(){return{ok:true,url:'/api/exporthub-document?ticket=edt1.AAA.BBB'};}};
const doc={name:'DNC3019228460.pdf',storage:'blob',blobName};

test('RC1803: Öffnen navigates the reserved tab to the ticket URL instead of fetching the PDF',async()=>{
  const b=browser({ticketReply:ticketJson});
  assert.equal(await b.api.open(doc,{name:doc.name}),true);
  assert.deepEqual(b.events,['open:about:blank','ticket','navigate:https://wonderful-forest-0f315e310.7.azurestaticapps.net/api/exporthub-document?ticket=edt1.AAA.BBB']);
  assert.equal(b.tab.opener,null);
  assert.equal(b.calls[0].options.headers['X-ExportHUB-Token'],'T','the ticket request is authenticated');
  assert.equal(b.calls[0].options.credentials,'omit');
  assert.match(b.calls[0].url,/&action=ticket&name=DNC3019228460\.pdf$/);
});

test('RC1803: Download uses the ticket URL as a named anchor download',async()=>{
  const b=browser({ticketReply:ticketJson});
  await b.api.open(doc,{name:doc.name,download:true});
  assert.deepEqual(b.events,['ticket','click:https://wonderful-forest-0f315e310.7.azurestaticapps.net/api/exporthub-document?ticket=edt1.AAA.BBB&download=1:DNC3019228460.pdf']);
});

test('RC1803: a failed ticket request closes the reserved tab and shows the server message',async()=>{
  const b=browser({ticketReply:{ok:false,status:409,type:'basic',redirected:false,url:'',headers:{get(){return'application/json';}},async json(){return{ok:false,message:'Andere Umgebung'};}}});
  await assert.rejects(b.api.open(doc,{name:doc.name}),/Andere Umgebung/);
  assert.deepEqual(b.events,['open:about:blank','ticket','close']);
});

test('RC1803: fetchBlob falls back to the ticket URL when a web filter blocks the header fetch',async()=>{
  const b=browser({ticketReply:ticketJson,throwBlob:true});
  const blob=await b.api.fetchBlob(doc);
  assert.equal(await blob.slice(0,5).text(),'%PDF-');
  assert.deepEqual(b.events,['fetch','ticket','xhr:/api/exporthub-document?ticket=edt1.AAA.BBB']);
});

test('RC1803: a ticket URL from the server must point to the document API',async()=>{
  const b=browser({ticketReply:{...ticketJson,async json(){return{ok:true,url:'https://evil.example/x.pdf'};}},blobReply:{ok:true,status:200,type:'basic',redirected:false,url:'',headers:{get(){return'application/pdf';}},async blob(){return new Blob(['%PDF-1.7'],{type:'application/pdf'});}}});
  await b.api.open(doc,{name:doc.name});
  assert.ok(!b.events.some(e=>/evil/.test(e)),'foreign URLs are never opened');
  assert.deepEqual(b.events,['open:about:blank','ticket','fetch','navigate:blob:pdf']);
});
