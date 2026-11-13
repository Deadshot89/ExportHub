import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {PDFDocument}=require('../api/node_modules/pdf-lib');
const {extractPdfText}=require('../api/shared/customer-avis-document-content.js');
const {modelFrom,createDeliveryNotePdf}=require('../api/shared/rc1790-delivery-note-pdf.js');
const frontend=fs.readFileSync('assets/rc1790-delivery-note.js','utf8');
const invoiceEditor=fs.readFileSync('assets/rc1549-abd-proforma.js','utf8');
const exportApi=fs.readFileSync('api/abd-analysis-export/index.js','utf8');
const build=fs.readFileSync('.github/rc1549/integrate-abd-proforma.mjs','utf8');
function example(){
 return{header:{
  documentNumber:'DNC3019223442',issuedAt:'2026-11-04',deliveryDate:'2026-11-05',
  senderName:'Essentra Components GmbH',senderAddress:'Montel-Allee 3, 41334 Nettetal, Germany',
  recipient:'Example Customer Ltd',recipientAddress:'Industrial Way 12, Bristol, United Kingdom',
  customerNumber:'C-001',customerOrder:'PO-4711',shipmentReference:'REF-12345',
  packageCount:2,packageType:'Kartons',netWeight:14.5,grossWeight:17.4,notes:'Ware bitte trocken lagern.'
 },items:[
  {itemNumber:'SKU-001',description:'Plastic end cap',quantity:500,unit:'Stk',orderPosition:'10'},
  {itemNumber:'SKU-002',description:'Protective plug',quantity:250,unit:'Stk',orderPosition:'20'}
 ]}
}
test('RC1790: DNC item data and transport metadata are validated',()=>{
 const parsed=modelFrom(example());
 assert.equal(parsed.header.documentNumber,'DNC3019223442');
 assert.equal(parsed.items.length,2);
 assert.equal(parsed.items[0].quantity,500);
});
test('RC1790: generated customer delivery note is A4 and includes Essentra sender, consignee, order and all items',async()=>{
 const bytes=await createDeliveryNotePdf(example());
 const pdf=await PDFDocument.load(bytes);
 assert.ok(bytes.length>2000);
 assert.equal(pdf.getPageCount(),1);
 assert.ok(Math.abs(pdf.getPage(0).getWidth()-595.28)<0.2);
 const text=(await extractPdfText(bytes)).replace(/\s+/g,' ');
 for(const value of ['LIEFERSCHEIN','DNC3019223442','Essentra Components GmbH','Example Customer','Bristol','PO-4711','SKU-001','SKU-002','Plastic end cap','500','250','Seite 1 / 1'])
  assert.ok(text.includes(value),'Missing PDF text: '+value);
 assert.ok(!text.includes('RECHNUNGSWERT'),'Delivery note must not include invoice values');
 assert.ok(!text.includes('D365')&&!text.includes('ExportHUB360'),'Customer PDF must not disclose internal ERP or app processes');
 assert.ok(text.includes('Delivery Note'),'Customer-facing document must include a neutral footer');
});
test('RC1790: lengthy items paginate without silently losing first or last position',async()=>{
 const snapshot=example();
 snapshot.items=Array.from({length:62},(_,i)=>({
  itemNumber:'SKU-'+String(i+1).padStart(3,'0'),
  description:'Protective industrial fastening accessory '.repeat(3)+' END-'+String(i+1).padStart(3,'0'),
  quantity:10+i,unit:'Stk'
 }));
 const bytes=await createDeliveryNotePdf(snapshot),pdf=await PDFDocument.load(bytes);
 assert.ok(pdf.getPageCount()>1);
 const text=(await extractPdfText(bytes)).replace(/\s+/g,' ');
 for(const key of ['SKU-001','SKU-031','SKU-062','END-001','END-062','Seite 1 /'])
  assert.ok(text.includes(key),'Missing position/footer '+key);
});
test('RC1790: malformed DNC, blank goods, invalid quantity, weight and date fail closed',async()=>{
 const mutations=[
  s=>{s.header.documentNumber='<script>';},
  s=>{s.header.issuedAt='2026-13-04';},
  s=>{s.header.recipientAddress='';},
  s=>{s.items[0].description='';},
  s=>{s.items[0].quantity=-5;},
  s=>{s.header.grossWeight=1;},
  s=>{s.header.packageCount=1.5;},
  s=>{s.header.recipientAddress='A'.repeat(501);}
 ];
 for(const update of mutations){
  const s=example();update(s);
  await assert.rejects(()=>createDeliveryNotePdf(s));
 }
 const excessive=example();excessive.items=Array.from({length:251},()=>excessive.items[0]);
 await assert.rejects(()=>createDeliveryNotePdf(excessive),e=>e.code==='DELIVERY_NOTE_ITEMS_REQUIRED');
});
test('RC1790: only existing authenticated ABD export route can produce delivery PDF',()=>{
 assert.match(exportApi,/format==='lieferschein'\?await deliveryNote\.createDeliveryNotePdf\(snapshot\)/);
 assert.match(exportApi,/auth\.validateSession\(req\)/);
 assert.match(exportApi,/if\(!allowed\(current\.user\)\)/);
 assert.match(invoiceEditor,/createDeliveryNote:async function\(snapshot\)/);
 assert.match(invoiceEditor,/headers:headers\(\)/);
 assert.match(frontend,/api\.createDeliveryNote\(data\)/);
});
test('RC1790: editor appears in standalone document workspace in all three builds',()=>{
 assert.match(frontend,/data-rc1940-document-editor/);
  assert.doesNotMatch(frontend,/data-rc1294-invoice-panel/);
 assert.match(frontend,/rc1790DocTabs/);
 assert.match(frontend,/data-rc1790-items/);
 assert.match(frontend,/data-rc1790-export/);
 assert.match(frontend,/essentra-company-logo\.png/);
 assert.match(build,/assets\/rc1790-delivery-note\.js/);
 assert.match(build,/DELIVERY_TAG/);
  assert.match(build,/DOCUMENT_TAG/);
 assert.match(build,/const ENTRIES=\['index\.html','TESTVERSION\.html','demo\.html'\]/);
});

test('RC1790: all six languages have translated labels and errors',()=>{
 const code=fs.readFileSync('assets/i18n/rc1790-delivery-note.js','utf8');
 for(const locale of ['de','en','pl','es','fr','it']){
  const root={ExportHUBI18n:{language:()=>locale}};
  vm.runInNewContext(code,{window:root});
  const i18n=root.ExportHUBRC1790I18n;
  assert.equal(i18n.language(),locale);
  for(const key of ['pageTitle','documentNumber','recipientAddress','add','export','validationItems','error']){
   const translated=i18n.t(key);
   assert.ok(typeof translated==='string'&&translated.length>4&&translated!==key,locale+'/'+key);
  }
 }
});
test('RC1790: invoice and delivery panels stay exclusive; language changes retain entered draft and items',()=>{
 assert.match(frontend,/a\.hidden=mode==='delivery'/);
 assert.match(frontend,/#rc1549AbdManual\[hidden\]\{display:none!important\}/);
 assert.match(frontend,/function localizeWithoutLosingDraft\(\)/);
 assert.match(frontend,/headerDraft\[input\.getAttribute\('data-rc1790-header'\)\]=input\.value/);
 assert.match(frontend,/root\.addEventListener\('exporthub:language-changed',localizeWithoutLosingDraft\)/);
 assert.match(frontend,/items\.map\(function\(item\)\{return Object\.assign\(\{\},item\)\}\)/);
});

test('RC1790: form field limits match PDF validation for customer and shipping data',()=>{
 for(const marker of ['documentNumber:40','senderName:160','senderAddress:500','recipient:160',
  'recipientAddress:500','customerNumber:60','customerOrder:80','shipmentReference:80','packageType:100','notes:800'])
  assert.ok(frontend.includes(marker),'Missing form limit '+marker);
 const modelSrc=fs.readFileSync('api/shared/rc1790-delivery-note-pdf.js','utf8');
 assert.match(modelSrc,/DELIVERY_NOTE_PACKAGE_COUNT_INVALID/);
});

test('RC1790: long valid DNC references wrap without clipping the printed date',async()=>{
 const snapshot=example();
 snapshot.header.documentNumber='W'.repeat(39);
 const bytes=await createDeliveryNotePdf(snapshot);
 const text=(await extractPdfText(bytes)).replace(/\s+/g,' ');
 assert.match(text,/W{39}/);
 assert.match(text,/04\.11\.2026/);
});

test('RC1790: multiline shipping addresses and long units remain printable without overflow',async()=>{
 const snapshot=example();
 snapshot.header.senderAddress='Montel-Allee 3\n41334 Nettetal\nGermany';
 snapshot.header.recipientAddress='Industrial Way 12\nBristol\nUnited Kingdom';
 snapshot.items[0].unit='boxes of small bags';
 const bytes=await createDeliveryNotePdf(snapshot);
 const pdf=await PDFDocument.load(bytes);
 const visible=(await extractPdfText(bytes)).replace(/\s+/g,' ');
 assert.equal(pdf.getPageCount(),1);
 for(const value of ['Montel-Allee 3','Nettetal','Industrial Way 12','Bristol','boxes','small','bags']){
  assert.ok(visible.includes(value),'Missing delivery-note content '+value);
 }
});
test('RC1790: customer PDF metadata contains no internal application or ERP details',async()=>{
 const bytes=await createDeliveryNotePdf(example());
 const pdf=await PDFDocument.load(bytes);
 assert.equal(pdf.getAuthor(),'Essentra Components GmbH');
 assert.match(pdf.getSubject(),/Delivery Note/);
 assert.ok(!/ExportHUB|D365|nicht abgeglichen/i.test([pdf.getAuthor(),pdf.getSubject()].join(' ')));
});

test('RC1790: article input lengths match backend and UI prevents excessive rows',()=>{
 for(const item of ['itemNumber:100','description:500','quantity:32','unit:24','orderPosition:50']){
  assert.ok(frontend.includes(item),'Missing field max length '+item);
 }
 assert.match(frontend,/if\(items\.length>=250\)return/);
 assert.match(frontend,/if\(items\.length<250&&items\[ci\]\)/);
});

test('RC1790: full address blocks with a tall first position paginate and retain all goods',async()=>{
 const snapshot=example();
 snapshot.header.senderAddress=Array.from({length:19},(_,i)=>'Street '+String(i+1)+' Building X').join('\n');
 snapshot.header.recipientAddress='Harbour Street 5\nBristol\nUnited Kingdom';
 snapshot.items[0].description='Industrial protective cover and matching installation accessory '.repeat(6);
 const bytes=await createDeliveryNotePdf(snapshot),pdf=await PDFDocument.load(bytes);
 const text=(await extractPdfText(bytes)).replace(/\s+/g,' ');
 assert.ok(pdf.getPageCount()>=2);
 for(const value of ['SKU-001','SKU-002','Protective plug','Street 1 Building X','Street 19 Building X']){
  assert.ok(text.includes(value),'Missing item or address after page break: '+value);
 }
 const src=fs.readFileSync('api/shared/rc1790-delivery-note-pdf.js','utf8');
 assert.match(src,/if\(y-68-itemLayout\(data\.items\[0\]\)\.height<BOTTOM\+20\)addPage\(\)/);
});
