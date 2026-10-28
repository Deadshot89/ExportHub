import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1059-document-blob.js','utf8');
const file={name:'DNC3019222063.pdf',storage:'blob',blobName:'rc1059/testservice/aa/'+('a'.repeat(64))};
function viewer({runtime={},session,reply}={}){
 const calls=[],clicks=[];
 const hostname='ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';
 const w={
  location:{hostname,origin:'https://'+hostname,href:'https://'+hostname+'/index.html'},
  ExportHUBClean:{runtime},
  sessionStorage:{getItem(key){return key==='exporthub_rc301_tab_session'?(session?JSON.stringify(session):null):null}},
  fetch:async(url,options)=>{calls.push({url,options});return reply},
  document:{createElement(){return{href:'',download:'',click(){clicks.push({href:this.href,download:this.download})},remove(){}}},body:{appendChild(){}}},
  URL:{createObjectURL(){return'blob:pack-original'},revokeObjectURL(){}},
  setTimeout(){},
 };
 vm.runInNewContext(source,{window:w,URL});
 return{api:w.ExportHUBDocumentBlob1059,calls,clicks};
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

test('RC1702: SWA does not send document API downloads to Microsoft platform login',()=>{
 const config=JSON.parse(fs.readFileSync('staticwebapp.config.json','utf8'));
 const route=config.routes.find(item=>item.route==='/api/exporthub-document');
 assert.ok(route,'document route must be explicitly deployed');
 assert.deepEqual(Array.from(route.allowedRoles),['anonymous'],'app bearer is validated by API, not platform Microsoft auth');
 const wildcard=config.routes.findIndex(item=>item.route==='/api/*');
 const exact=config.routes.indexOf(route);
 assert.ok(exact>=0&&exact<wildcard,'exact document route must precede generic API matcher');
 const api=fs.readFileSync('api/exporthub-document/index.js','utf8');
 assert.match(api,/await auth\.validateSession\(req\)/,'endpoint still authenticates via ExportHUB session');
});

test('RC1702: actual TESTSERVICE deployment config keeps document API outside Microsoft platform login',()=>{
 const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
 assert.match(workflow,/cp staticwebapp\.testservice\.config\.json \.rc1112_testservice_app\/staticwebapp\.config\.json/,'TESTSERVICE deploy must use the guarded source config');
 const config=JSON.parse(fs.readFileSync('staticwebapp.testservice.config.json','utf8'));
 const index=config.routes.findIndex(item=>item.route==='/api/exporthub-document');
 const wildcard=config.routes.findIndex(item=>item.route==='/api/*');
 assert.ok(index>=0&&wildcard>=0&&index<wildcard,'TESTSERVICE must route protected PDFs before generic API matcher');
 const route=config.routes[index];
 assert.deepEqual(Array.from(route.allowedRoles),['anonymous'],'API session authorization stays inside ExportHUB function');
 assert.equal(route.headers['X-ExportHUB-Environment'],'test');
 assert.match(config.navigationFallback.exclude.join(' '),/\/api\/\*/);
});

test('RC1702: TESTSERVICE release blocks Microsoft redirects on the protected document endpoint',()=>{
 const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
 const deployed=workflow.indexOf('- name: RC1553 TESTSERVICE deployment identity prüfen');
 const gate=workflow.indexOf('- name: RC1702 Dokumenten-API Routing TESTSERVICE');
 const browser=workflow.indexOf('- name: RC1124 TESTSERVICE Browser Gate');
 assert.ok(deployed>=0&&gate>deployed&&browser>gate,'route must be verified after deploy and before mutating browser test');
 assert.match(workflow,/--max-redirs 0/,'live test must not follow Microsoft redirects');
 assert.match(workflow,/\[ \"\$status\" != '401' \]/,'only ExportHUB authentication rejection is allowed');
 assert.match(workflow,/AUTH_REQUIRED/,'session verification contract');
});

test('RC1705: existing Packmeldung PDF without storage metadata still downloads through authenticated Blob API',async()=>{
 const raw={name:'Lieferschein-alt.pdf',blobName:file.blobName};
 const reply={ok:true,status:200,redirected:false,type:'basic',url:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net/api/exporthub-document',headers:{get(){return'application/pdf'}},async blob(){return new Blob(['%PDF-1.7 legacy'],{type:'application/pdf'})}};
 const {api,calls,clicks}=viewer({session:{token:'EXISTING',user:{id:'u-1'},environment:'testservice'},reply});
 assert.equal(api.isBlobDocument(raw),true);
 assert.equal(await api.open(raw,{name:raw.name,download:true}),true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].options.headers.Authorization,'Bearer EXISTING');
 assert.equal(calls[0].options.redirect,'manual');
 assert.deepEqual(clicks.map(x=>x.download),['Lieferschein-alt.pdf']);
 assert.ok(clicks[0].href.startsWith('blob:'),'download must use fetched PDF bytes, not an unauthenticated API URL');
});

test('RC1705: legacy same-origin document API URL is never clicked without a session',async()=>{
 const old={name:'Pack-alt.pdf',url:'/api/exporthub-document?blob=rc1059%2Ftestservice%2Faa%2F'+('a'.repeat(64))+'&environment=testservice'};
 const reply={ok:true,status:200,redirected:false,type:'basic',url:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net/api/exporthub-document',headers:{get(){return'application/pdf'}},async blob(){return new Blob(['%PDF-1.4 older pack'],{type:'application/pdf'})}};
 const {api,calls,clicks}=viewer({session:{token:'VALID-TAB',user:{id:'u-2'},environment:'testservice'},reply});
 assert.equal(await api.open(old,{download:true,name:old.name}),true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].options.headers.Authorization,'Bearer VALID-TAB');
 assert.equal(calls[0].options.redirect,'manual');
 assert.equal(clicks[0].download,'Pack-alt.pdf');
 assert.equal(clicks[0].href,'blob:pack-original');
});

test('RC1705: cross-origin old document links never receive authenticated ExportHUB headers',async()=>{
 const {api,calls,clicks}=viewer({session:{token:'SECRET',user:{id:'u-2'},environment:'testservice'}});
 assert.equal(api.protectedApiUrl('https://elsewhere.example/api/exporthub-document?blob=abc'),'');
 await api.open({name:'external.pdf',url:'https://elsewhere.example/document.pdf'},{download:true});
 assert.equal(calls.length,0);
 assert.equal(clicks.length,1);
});

test('RC1705: HTTP 200 PDF MIME with Microsoft login HTML payload cannot download',async()=>{
 const {api,clicks}=viewer({session:{token:'VALID',user:{id:'u-2'},environment:'testservice'},reply:{
  ok:true,status:200,redirected:false,type:'basic',url:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net/api/exporthub-document',
  headers:{get(){return'application/pdf'}},
  async blob(){return new Blob(['<html>Microsoft login</html>'],{type:'application/pdf'})}
 }});
 await assert.rejects(api.open({name:'Pack-alt.pdf',url:'/api/exporthub-document?blob=x'},{download:true}),e=>e.code==='DOCUMENT_NOT_PDF');
 assert.equal(clicks.length,0);
});

test('RC1705: non-PDF image attachments remain readable through the shared authenticated blob viewer',async()=>{
 const img={name:'PickupFoto.jpg',storage:'blob',blobName:file.blobName,mimeType:'image/jpeg'};
 const {api}=viewer({runtime:{authToken:'VALID'},reply:{
  ok:true,status:200,redirected:false,type:'basic',url:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net/api/exporthub-document',
  headers:{get(){return'image/jpeg'}},
  async blob(){return new Blob([new Uint8Array([0xff,0xd8,0xff,0xd9])],{type:'image/jpeg'})}
 }});
 const result=await api.fetchBlob(img);
 assert.equal(result.type,'image/jpeg');
 assert.equal(result.size,4);
});
