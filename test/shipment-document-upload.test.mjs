import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const av=require('../api/shared/av-check.js');
const refFiles=require('../api/reference-files/index.js');
const NOW=new Date('2026-10-30T18:01:02Z');
const b64=buf=>Buffer.from(buf).toString('base64');
const PDF=b64('%PDF-1.7\n%test\n'),ZIP=b64([0x50,0x4b,0x03,0x04,0x14,0x00]),OLE=b64([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1,0]),CSV=b64('Pos;Menge\n1;5\n');

test('Dokument-Upload: Name mit Dokumentart, Referenz und Zeitstempel',()=>{
  const r=refFiles.documentUploadFile('ABC123',{kind:'rechnung',fileName:'RE 4711.pdf',data:PDF},NOW);
  assert.equal(r.name,'Rechnung_ABC123_20261030-180102_RE 4711.pdf');
  assert.equal(r.mimeType,'application/pdf');
  assert.equal(refFiles.documentUploadFile('ABC123',{kind:'lieferschein',fileName:'LS.pdf',data:PDF},NOW).name,'Lieferschein_ABC123_20261030-180102_LS.pdf');
  assert.equal(refFiles.documentUploadFile('ABC123',{fileName:'x.pdf',data:PDF},NOW).name,'Dokument_ABC123_20261030-180102_x.pdf');
});

test('Dokument-Upload zählt nie als Ausgangsvermerk, auch wenn die Datei mit AV beginnt',()=>{
  for(const kind of ['lieferschein','rechnung','packliste','excel','sonstiges']){
    const r=refFiles.documentUploadFile('ABC123',{kind,fileName:'AV_ABC123.pdf',data:PDF},NOW);
    assert.equal(av.isAvFileName(r.name),false,r.name);
  }
});

test('Dokument-Upload: Excel, Word, CSV, Bilder und E-Mails mit passender Signatur',()=>{
  assert.match(refFiles.documentUploadFile('ABC123',{kind:'excel',fileName:'Liste.xlsx',data:ZIP},NOW).mimeType,/spreadsheetml/);
  assert.equal(refFiles.documentUploadFile('ABC123',{kind:'excel',fileName:'Alt.xls',data:OLE},NOW).mimeType,'application/vnd.ms-excel');
  assert.equal(refFiles.documentUploadFile('ABC123',{kind:'excel',fileName:'Liste.csv',data:CSV},NOW).mimeType,'text/csv');
  assert.match(refFiles.documentUploadFile('ABC123',{kind:'sonstiges',fileName:'Brief.docx',data:ZIP},NOW).mimeType,/wordprocessingml/);
  assert.equal(refFiles.documentUploadFile('ABC123',{kind:'sonstiges',fileName:'Mail.msg',data:OLE},NOW).mimeType,'application/vnd.ms-outlook');
  assert.equal(refFiles.documentUploadFile('ABC123',{kind:'lieferschein',fileName:'Foto.PNG',data:b64([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0])},NOW).mimeType,'image/png');
});

test('Dokument-Upload lehnt falsche, leere, zu große und gefährliche Dateien ab',()=>{
  assert.throws(()=>refFiles.documentUploadFile('ABC123',{kind:'sonstiges',fileName:'tool.exe',data:PDF},NOW),/docTypeInvalid/);
  assert.throws(()=>refFiles.documentUploadFile('ABC123',{kind:'sonstiges',fileName:'seite.html',data:CSV},NOW),/docTypeInvalid/);
  assert.throws(()=>refFiles.documentUploadFile('ABC123',{kind:'excel',fileName:'Liste.xlsx',data:PDF},NOW),/docSignatureInvalid/);
  assert.throws(()=>refFiles.documentUploadFile('ABC123',{kind:'excel',fileName:'Liste.csv',data:b64([0x41,0,0x42])},NOW),/docSignatureInvalid/);
  assert.throws(()=>refFiles.documentUploadFile('ABC123',{kind:'rechnung',fileName:'RE.pdf',data:''},NOW),/docEmpty/);
  assert.throws(()=>refFiles.documentUploadFile('ABC123',{kind:'zoll',fileName:'RE.pdf',data:PDF},NOW),/docKindInvalid/);
  const big=Buffer.alloc(15*1024*1024+1,0x20);big.write('%PDF-',0,'ascii');
  assert.throws(()=>refFiles.documentUploadFile('ABC123',{kind:'rechnung',fileName:'RE.pdf',data:big.toString('base64')},NOW),/docTooLarge/);
});

test('Dokument-Upload: Fehlermeldungen in allen sechs API-Sprachen',()=>{
  for(const l of ['de','en','pl','es','fr','it']){
    const pack=JSON.parse(fs.readFileSync(`api/shared/i18n/${l}.json`,'utf8'));
    for(const k of ['docKindInvalid','docTypeInvalid','docEmpty','docTooLarge','docSignatureInvalid'])assert.ok(pack['api.reference.'+k],l+' '+k);
  }
});

test('Dokument-Upload ist in Build, Routing und Sendungsansicht eingebunden',()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8'),asset=fs.readFileSync('assets/shipment-document-upload.js','utf8');
  assert.match(build,/assets\/i18n\/shipment-document-upload\.js\?v=3/);
  assert.match(build,/assets\/shipment-document-upload\.js\?v=3/);
  assert.match(build,/'assets\/shipment-document-upload\.js',/);
  assert.match(fs.readFileSync('staticwebapp.config.json','utf8'),/"route": "\/assets\/shipment-document-upload\.js"/);
  assert.match(asset,/#rc786ReferenceFilesCard \.rc786-doc-head-actions/);
  assert.match(asset,/action:'upload-document'/);
  assert.match(asset,/multiple/);
  const api=fs.readFileSync('api/reference-files/index.js','utf8');
  assert.match(api,/const environment=publicAccess\.environment\(req,payload\)/);
  assert.match(api,/action==='upload-document'[\s\S]{0,900}referenceFolder\.upload\(ref,file\.name,file\.buffer,file\.mimeType,environment\)/);
  assert.match(api,/action==='upload-document'[\s\S]{0,700}refDocBlob\.save\(ref,environment,file\.name,file\.buffer,file\.mimeType\)/);
  const i18n=fs.readFileSync('assets/i18n/shipment-document-upload.js','utf8');
  for(const l of ['de','en','pl','es','fr','it'])assert.match(i18n,new RegExp('\\n '+l+':\\{button:'));
});


test('Dokument-Upload: nur bestätigte Datei-ID und REF-Readback zählen als erfolgreich',async()=>{
 const source=fs.readFileSync('assets/shipment-document-upload.js','utf8');
 const bytes=Buffer.from('%PDF-1.7\n%test\n','utf8');
 const receipt={id:'refdoc:123456',name:'Lieferschein_ABC123_20261110-123000_LS.pdf',size:bytes.length};
 async function run(post,listing){
  const file={name:'LS.pdf',size:bytes.length,type:'application/pdf'};
  const calls=[],window={},document={body:null,addEventListener(){},getElementById(){return null}};
  class Reader {readAsDataURL(){this.result='data:application/pdf;base64,'+bytes.toString('base64');this.onload()}}
  const fetch=async(url,options)=>{
   calls.push({url,method:options.method});
   const result=options.method==='POST'?post:listing;
   return{ok:true,status:200,async json(){return result}};
  };
  vm.runInNewContext(source,{window,document,FileReader:Reader,fetch,CustomEvent:function(){},console});
  return{result:window.ExportHUBShipmentDocUpload.upload('ABC123',file,'lieferschein'),calls};
 }
 const noReceipt=await run({ok:true},{ok:true,files:[]});
 await assert.rejects(noReceipt.result,/uploadUnverified/);
 assert.deepEqual(noReceipt.calls.map(x=>x.method),['POST'],'Never list or claim a missing receipt');
 const noStorage=await run({ok:true,file:receipt,azureSaved:false,sharepointSaved:false},{ok:true,files:[]});
 await assert.rejects(noStorage.result,/uploadUnverified/);
 const sameNameOldFile=await run({ok:true,file:receipt,azureSaved:true,sharepointSaved:false},
  {ok:true,reference:'ABC123',files:[{...receipt,id:'refdoc:other'}]});
 await assert.rejects(sameNameOldFile.result,/uploadNotListed/,'A same-name file is not the new upload');
 assert.deepEqual(sameNameOldFile.calls.map(x=>x.method),['POST','GET']);
 const exact=await run({ok:true,file:receipt,azureSaved:true,sharepointSaved:false},
  {ok:true,reference:'ABC123',files:[{...receipt}]});
 const confirmed=await exact.result;
 assert.equal(confirmed.id,receipt.id);
 assert.equal(confirmed.size,bytes.length);
 assert.equal(confirmed.azureSaved,true);
 assert.equal(confirmed.sharepointSaved,false);
 assert.deepEqual(exact.calls.map(x=>x.method),['POST','GET']);
 const changedRef=await run({ok:true,file:receipt,azureSaved:true,sharepointSaved:true},
  {ok:true,reference:'ZZZ999',files:[{...receipt}]});
 await assert.rejects(changedRef.result,/uploadNotListed/,'Never confirm a receipt from another shipment');
});

test('Dokument-Upload: Erfolg nur nach REF-Identität, korrekte Kopien und Sprachmeldungen',()=>{
 const src=fs.readFileSync('assets/shipment-document-upload.js','utf8');
 const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 assert.match(src,/q\(saved\.id\)===q\(info\.id\)/);
 assert.match(src,/q\(saved\.name\)===q\(info\.name\)/);
 assert.match(src,/Number\(saved\.size\)===file\.size/);
 assert.match(src,/referenceFolder:sharepointCopies===ok/);
 assert.match(src,/picked=files\.filter/,'Files without a confirmed receipt must remain selectable');
 assert.match(build,/shipment-document-upload\.js\?v=3/);
 assert.match(build,/i18n\/shipment-document-upload\.js\?v=3/);
 const local={};
 new Function('window',fs.readFileSync('assets/i18n/shipment-document-upload.js','utf8'))(local);
 for(const language of ['de','en','pl','es','fr','it'])
  for(const key of ['uploadUnverified','uploadNotListed','uploadNotReadable'])
   assert.ok(local.ExportHUBShipmentDocUploadI18n.packs[language][key],language+' '+key);
});


test('Dokument-Upload: SharePoint-only muss exakte Datei-Bytes zurückliefern',async()=>{
 const source=fs.readFileSync('assets/shipment-document-upload.js','utf8');
 const bytes=Buffer.from('%PDF-1.7\nSharePoint fallback proof\n','utf8');
 const receipt={id:'GraphFile-123',name:'Lieferschein_ABC123_20261110-130000_Fallback.pdf',size:bytes.length};
 async function scenario({readBytes=bytes,downloadOk=true,azureSaved=false,sharepointSaved=true}={}){
  const calls=[],window={},document={body:null,addEventListener(){},getElementById(){return null}};
  const file={name:'Fallback.pdf',size:bytes.length,type:'application/pdf',async arrayBuffer(){
   return Uint8Array.from(bytes).buffer;
  }};
  class Reader {readAsDataURL(){this.result='data:application/pdf;base64,'+bytes.toString('base64');this.onload()}}
  const fetch=async(url,options)=>{
   calls.push({url,method:options.method});
   if(options.method==='POST')return{ok:true,status:200,async json(){return{
    ok:true,file:receipt,azureSaved,sharepointSaved
   }}};
   if(url.includes('itemId='))return{
    ok:downloadOk,status:downloadOk?200:503,
    async arrayBuffer(){return Uint8Array.from(readBytes).buffer;}
   };
   return{ok:true,status:200,async json(){return{ok:true,reference:'ABC123',files:[receipt]}}};
  };
  vm.runInNewContext(source,{window,document,FileReader:Reader,fetch,CustomEvent:function(){},console});
  return{calls,result:window.ExportHUBShipmentDocUpload.upload('ABC123',file,'lieferschein')};
 }
 const valid=await scenario();
 assert.equal((await valid.result).id,receipt.id);
 assert.equal(valid.calls.length,3,'SharePoint-only needs independent exact-file GET');
 assert.match(valid.calls[2].url,/itemId=GraphFile-123/);
 const corrupt=await scenario({readBytes:Buffer.from(bytes.map((v,i)=>i===12?v^1:v))});
 await assert.rejects(corrupt.result,/uploadNotReadable/,'Same size but changed bytes must fail');
 const missing=await scenario({downloadOk:false});
 await assert.rejects(missing.result,/uploadNotReadable/,'Unreachable SharePoint original must fail');
 const azure=await scenario({azureSaved:true,sharepointSaved:false});
 assert.equal((await azure.result).id,receipt.id);
 assert.equal(azure.calls.length,2,'Azure primary has its own server-side SHA-256 verification');
});
