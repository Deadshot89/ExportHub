const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {wrapCustomerAvisHandler}=require('../api/shared/customer-avis-download-all.js');

function jsonBody(res){return typeof res.body==='string'?JSON.parse(res.body):res.body}
function fakeBase(){
 return async function(context,req){
  const action=String(req.query&&req.query.action||req.body&&req.body.action||'').toLowerCase();
  if(req.method==='POST'&&action==='authorize'){
   context.res={status:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true,session:'SESSION-1',reference:'ABC123',documents:[
    {id:'a',name:'Lieferschein.pdf',category:'Lieferschein',downloadUrl:'/api/customer-avis?action=document&id=a&session=SESSION-1'},
    {id:'b',name:'CMR.pdf',category:'CMR',downloadUrl:'/api/customer-avis?action=document&id=b&session=SESSION-1'}
   ]})};return;
  }
  if(req.method==='GET'&&action==='document'){
   const id=String(req.query.id||'');
   if(id==='a'){context.res={status:200,isRaw:true,headers:{'Content-Type':'application/pdf'},body:Buffer.from('PDF-A')};return}
   if(id==='b'){context.res={status:200,isRaw:true,headers:{'Content-Type':'application/pdf'},body:Buffer.from('PDF-B')};return}
   context.res={status:404,headers:{'Content-Type':'application/json'},body:{ok:false,code:'DOCUMENT_NOT_FOUND'}};return;
  }
  if(req.method==='GET'){
   context.res={status:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true,reference:'ABC123',documents:[
    {id:'a',name:'Lieferschein.pdf',category:'Lieferschein',downloadUrl:'/api/customer-avis?action=document&id=a&session=SESSION-1'},
    {id:'b',name:'CMR.pdf',category:'CMR',downloadUrl:'/api/customer-avis?action=document&id=b&session=SESSION-1'}
   ]})};return;
  }
  context.res={status:400,headers:{'Content-Type':'application/json'},body:{ok:false}};
 }
}

test('RC1454 exposes one ZIP action before individual AVIS documents',async()=>{
 const handler=wrapCustomerAvisHandler(fakeBase()),context={};
 await handler(context,{method:'POST',headers:{},query:{},body:{action:'authorize'}});
 const body=jsonBody(context.res);
 assert.equal(body.documents[0].id,'__all_attachments_zip__');
 assert.equal(body.documents[0].name,'Alle Anhänge herunterladen');
 assert.equal(body.documents[0].category,'ZIP · Alle Dokumente');
 assert.match(body.documents[0].downloadUrl,/action=download-all/);
 assert.match(body.documents[0].downloadUrl,/session=SESSION-1/);
 assert.equal(body.documents.length,3);
});

test('RC1454 localizes the bulk-download action through API i18n',async()=>{
 const handler=wrapCustomerAvisHandler(fakeBase()),context={};
 await handler(context,{method:'POST',headers:{'x-exporthub-language':'en'},query:{},body:{action:'authorize'}});
 const body=jsonBody(context.res);
 assert.equal(body.documents[0].name,'Download all attachments');
 assert.equal(body.documents[0].category,'ZIP · All documents');
});

test('RC1454 download-all returns one ZIP containing every released document',async()=>{
 const handler=wrapCustomerAvisHandler(fakeBase()),context={};
 await handler(context,{method:'GET',headers:{},query:{action:'download-all',session:'SESSION-1'},body:{}});
 assert.equal(context.res.status,200);
 assert.equal(context.res.isRaw,true);
 assert.equal(context.res.headers['Content-Type'],'application/zip');
 assert.match(context.res.headers['Content-Disposition'],/ExportHUB360_ABC123_Anhaenge\.zip/);
 const zip=Buffer.from(context.res.body);
 assert.equal(zip.readUInt32LE(0),0x04034b50);
 assert.ok(zip.includes(Buffer.from('Lieferschein.pdf')));
 assert.ok(zip.includes(Buffer.from('CMR.pdf')));
 assert.ok(zip.includes(Buffer.from('PDF-A')));
 assert.ok(zip.includes(Buffer.from('PDF-B')));
 assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);
});

test('RC1454 never returns a partial ZIP when one document fails',async()=>{
 const base=fakeBase(),broken=async(context,req)=>{
  if(req.method==='GET'&&String(req.query&&req.query.action)==='document'&&String(req.query.id)==='b'){
   context.res={status:404,headers:{'Content-Type':'application/json'},body:{ok:false,code:'DOCUMENT_NOT_FOUND'}};return;
  }
  return base(context,req);
 };
 const handler=wrapCustomerAvisHandler(broken),context={};
 await handler(context,{method:'GET',headers:{},query:{action:'download-all',session:'SESSION-1'},body:{}});
 assert.equal(context.res.status,409);
 const body=jsonBody(context.res);
 assert.equal(body.ok,false);
 assert.equal(body.code,'ZIP_DOCUMENT_FAILED');
 assert.match(body.message,/CMR\.pdf/);
});

test('RC1454 localizes bulk-download errors through API i18n',async()=>{
 const base=fakeBase(),broken=async(context,req)=>{
  if(req.method==='GET'&&String(req.query&&req.query.action)==='document'&&String(req.query.id)==='b'){
   context.res={status:404,headers:{'Content-Type':'application/json'},body:{ok:false,code:'DOCUMENT_NOT_FOUND'}};return;
  }
  return base(context,req);
 };
 const handler=wrapCustomerAvisHandler(broken),context={};
 await handler(context,{method:'GET',headers:{'x-exporthub-language':'en'},query:{action:'download-all',session:'SESSION-1'},body:{}});
 const body=jsonBody(context.res);
 assert.equal(body.message,'The bulk download was cancelled because “CMR.pdf” could not be loaded completely.');
});

test('RC1454 renders the ZIP action as a dedicated responsive AVIS header CTA',()=>{
 assert.equal(fs.existsSync('assets/rc1454-avis-download-all-ui.js'),true,'RC1454 UI runtime is missing');
 assert.equal(fs.existsSync('scripts/rc1454-avis-download-all-ui.mjs'),true,'RC1454 AVIS injector is missing');
 const ui=fs.readFileSync('assets/rc1454-avis-download-all-ui.js','utf8');
 const injector=fs.readFileSync('scripts/rc1454-avis-download-all-ui.mjs','utf8');
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 assert.match(ui,/action=download-all/);
 assert.match(ui,/\.section-head/);
 assert.match(ui,/rc1454-bulk-download/);
 assert.match(ui,/MutationObserver/);
 assert.match(ui,/removeAttribute\(['"]target['"]\)/);
 assert.match(injector,/customer-avis\.html/);
 assert.match(injector,/rc1454-avis-download-all-ui\.js/);
 assert.match(injector,/fs\.readFileSync\(runtimeFile,'utf8'\)/);
 assert.doesNotMatch(injector,/defer src=/);
 assert.match(pkg.scripts.pretest,/rc1454-avis-download-all-ui\.mjs/);
});

test('RC1454 Azure customer-avis entrypoint wraps but does not replace the proven handler',()=>{
 const cfg=JSON.parse(fs.readFileSync('api/customer-avis/function.json','utf8'));
 const wrapper=fs.readFileSync('api/customer-avis/wrapper.js','utf8');
 assert.equal(cfg.scriptFile,'wrapper.js');
 assert.match(wrapper,/require\('\.\/index'\)/);
 assert.match(wrapper,/wrapCustomerAvisHandler/);
});
