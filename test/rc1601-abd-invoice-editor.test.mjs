import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const model=require('../api/shared/abd-analysis-model.js');
const exporter=require('../api/shared/abd-analysis-export.js');
const {extractPdfText}=require('../api/shared/customer-avis-document-content.js');
const frontend=fs.readFileSync('assets/rc1549-abd-proforma.js','utf8');

function invoice(){
 const positions=[{position:'1',itemNumber:'P-101',description:'Polymer caps',quantity:20,unit:'pcs',unitPrice:2.5,value:50,netMassKg:1.2,grossMassKg:1.4,commodityCode:'39269097',originCountry:'DE',currency:'EUR',confirmed:true}];
 return model.rebuildReviewedAnalysis({header:{
  invoiceNumber:'PF-2026-101',invoiceDate:'2026-10-22',
  customer:'Essentra Components GmbH',senderName:'Essentra Components GmbH',
  senderAddress:'Musterstrasse 23, 41334 Nettetal, Germany',
  recipient:'Example Customer Ltd',recipientAddress:'Dock Road 18, Liverpool, United Kingdom',
  destinationCountry:'GB',currency:'EUR',invoiceTotal:50
 },positions})
}
test('RC1601: complete sender and recipient address survive ABD reanalysis and export model',()=>{
 const reviewed=invoice();
 assert.equal(reviewed.review.complete,true);
 assert.equal(reviewed.header.senderName,'Essentra Components GmbH');
 assert.match(reviewed.header.senderAddress,/Nettetal/);
 assert.match(reviewed.header.recipientAddress,/Liverpool/);
 const exported=exporter.createExportModel(reviewed);
 assert.equal(exported.header.senderAddress,reviewed.header.senderAddress);
 assert.equal(exported.header.recipientAddress,reviewed.header.recipientAddress);
 assert.equal(exported.positions[0].commodityCode,'39269097');
 assert.equal(exported.positions[0].originCountry,'DE')
});
test('RC1601: A4 proforma shows sender, recipient, goods, weights and customs code',async()=>{
 const bytes=await exporter.createProformaPdf(invoice());
 assert.ok(Buffer.isBuffer(bytes));
 const text=(await extractPdfText(bytes)).replace(/\s+/g,' ');
 for(const required of ['ESSENTRA','PROFORMA INVOICE','Musterstrasse','Liverpool','Polymer caps','39269097','1.400','50.00'])assert.ok(text.toLowerCase().includes(required.toLowerCase()),required+' missing in exported PDF')
});
test('RC1601: upload result can be edited and every entry is validated',()=>{
 assert.match(frontend,/data-rc1549-import/);
 assert.match(frontend,/function importUploaded\(index\)/);
 assert.match(frontend,/data-rc1549-header="senderAddress"/);
 assert.match(frontend,/data-rc1549-header="recipientAddress"/);
 assert.match(frontend,/manualSnapshot=null;renderManualResult\(null\)/);
 assert.match(frontend,/p\.grossMassKg<p\.netMassKg/);
 assert.match(frontend,/event\.stopPropagation\(\)/);
 for(const locale of ['de','en','pl','es','fr','it'])assert.match(frontend,new RegExp('\\b'+locale+':\\{invoiceTitle:'))
});

test('RC1601: only valid size-limited PNG or JPEG logo data may enter the PDF',async()=>{
 const bad=Object.assign({},invoice(),{logoDataUri:'data:text/html;base64,PGgxPmJvZ3VzPC9oMT4='});
 await assert.rejects(()=>exporter.createProformaPdf(bad),error=>error.code==='ABD_LOGO_INVALID');
 const oversized=Object.assign({},invoice(),{logoDataUri:'data:image/png;base64,'+'A'.repeat(450000)});
 await assert.rejects(()=>exporter.createProformaPdf(oversized),error=>error.code==='ABD_LOGO_TOO_LARGE');
 assert.match(frontend,/data-rc1549-logo/);
 assert.match(frontend,/exportSnapshot\.logoDataUri=logoDataUri/)
});

test('RC1601: long invoice descriptions are not silently truncated',async()=>{
 const snapshot=invoice(),last='LASTWORD-CHECK-XYZ';
 snapshot.positions[0].description=('International replacement component '.repeat(9))+last;
 const bytes=await exporter.createProformaPdf(snapshot);
 const content=(await extractPdfText(bytes)).replace(/\\s+/g,' ');
 assert.match(content,/LASTWORD-CHECK-XYZ/);
});
test('RC1601: invoice editor avoids MutationObserver feedback loops',()=>{
 assert.ok(frontend.includes('if(button.textContent!==exportLabel)'));
 assert.ok(frontend.includes('if(importButton.textContent!==importLabel)'));
 assert.ok(frontend.includes("if(entry){var title=t('invoiceTitle');if(entry.textContent!==title)"));
});

test('RC1601: upload export cannot bypass complete invoice address and weight validation',()=>{
 assert.ok(frontend.includes('function readyInvoice(snapshot)'));
 assert.ok(frontend.includes('if(!q(h.senderName||h.customer)||!q(h.senderAddress)||!q(h.recipient)||!q(h.recipientAddress))return false'));
 assert.ok(frontend.includes('button.disabled=!readyInvoice(snapshot)'));
 assert.ok(frontend.includes('if(!readyInvoice(snapshot)||busy)'));
});

test('RC1601: standard production/Testservice build includes the invoice editor',()=>{
 const pipeline=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 const release=fs.readFileSync('.github/workflows/exporthub-production-release.yml','utf8');
 assert.match(pipeline,/integrateAbdProforma\(ROOT,OUT\)/);
 assert.match(release,/node \.github\/rc1112\/build-three-env\.mjs/);
});

test('RC1603: full A4 PDF has repeated headers, complete positions, multi-page footer and no clipped tail',async()=>{
 const {PDFDocument}=require('../api/node_modules/pdf-lib');
 const snapshot=invoice();
 snapshot.positions=Array.from({length:53},(_,index)=>({
   ...snapshot.positions[0],
   position:String(index+1),itemNumber:'SKUTEST-'+String(index+1).padStart(3,'0'),
   description:'Precision plastic manufacturing parts '.repeat(4)+'ENDPOS-'+String(index+1).padStart(3,'0'),
   value:50,currency:'EUR'
 }));
 snapshot.groups=[{commodityCode:'39269097',originCountry:'DE',value:2650,currency:'EUR',positionCount:53,netMassKg:63.6,grossMassKg:74.2}];
 snapshot.totals={invoiceTotal:2650,accountedTotal:2650,groupedTotal:2650,difference:0,currency:'EUR',netMassKg:63.6,grossMassKg:74.2};
 snapshot.review={complete:true,groupCount:1,unassignedCount:0};snapshot.unassigned=[];
 snapshot.header.senderAddress='Industriestrasse 100 / Building 2, Logistic Center, 41334 Nettetal, Nordrhein-Westfalen, Deutschland';
 snapshot.header.recipientAddress='Distribution and Supply Chain, North Docks & Engineering, International Receiving, City of Liverpool, United Kingdom';
 const bytes=await exporter.createProformaPdf(snapshot);
 const pdf=await PDFDocument.load(bytes);
 assert.ok(pdf.getPageCount()>=4,'53 positions must paginate onto multiple A4 sheets');
 for(const page of pdf.getPages()){
  assert.ok(Math.abs(page.getWidth()-595.28)<0.2);
  assert.ok(Math.abs(page.getHeight()-841.89)<0.2);
 }
 const content=(await extractPdfText(bytes)).replace(/\s+/g,' ');
 for(const key of ['SKUTEST-001','SKUTEST-027','SKUTEST-053','ENDPOS-053','ZOLLZUSAMMENFASSUNG','2650.00','Seite 1 /'])
  assert.ok(content.includes(key),key+' must be visible on all pages');
 if(process.env.EXPORTHUB_PDF_SAMPLE_DIR){
  fs.mkdirSync(process.env.EXPORTHUB_PDF_SAMPLE_DIR,{recursive:true});
  fs.writeFileSync(path.join(process.env.EXPORTHUB_PDF_SAMPLE_DIR,'rc1603-proforma-53-positionen.pdf'),bytes);
  fs.writeFileSync(path.join(process.env.EXPORTHUB_PDF_SAMPLE_DIR,'rc1603-proforma-one-position.pdf'),await exporter.createProformaPdf(invoice()))
 }
});
test('RC1603: Polish / accented addresses do not crash standard PDF fonts',async()=>{
 const invoiceWithAccents=invoice();
 invoiceWithAccents.header.recipient='Żółć Łódź Sp. z o.o.';
 invoiceWithAccents.header.recipientAddress='ul. Długa 25, Łódź, Polska';
 const bytes=await exporter.createProformaPdf(invoiceWithAccents);
 assert.ok(bytes.length>1000);
 assert.match(await extractPdfText(bytes),/Lodz/i)
});
