import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {integrateAbdProforma} from '../.github/rc1549/integrate-abd-proforma.mjs';

const require=createRequire(import.meta.url);
const parser=require('../api/shared/abd-analysis.js');
const model=require('../api/shared/abd-analysis-model.js');
const exporter=require('../api/shared/abd-analysis-export.js');
const {extractPdfText}=require('../api/shared/customer-avis-document-content.js');
const runtime=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');
const documents=fs.readFileSync('assets/rc1940-documents-workspace.js','utf8');
const proformaUi=fs.readFileSync('assets/rc1549-abd-proforma.js','utf8');
const releaseBuilder=fs.readFileSync('.github/rc1521/build-three-env.mjs','utf8');

test('RC1549: Excel/manuelle Positionen erkennen Volumen und Einzelpreis',()=>{
 const matrix=parser.parseDelimited('Artikelnummer;Warenbeschreibung;Menge;Einzelpreis;Warenwert;Währung;Nettogewicht;Bruttogewicht;Volumen m3;HS Code;Herkunftsland\nA-10;Kunststoffteil;100;2,459;245,90;EUR;12,5;13,1;0,045;39269097;DE');
 const rows=parser.matrixToObjects(matrix,'proforma.csv');
 const out=parser.analyzeObjects(rows).positions[0];
 assert.equal(out.itemNumber,'A-10');
 assert.equal(out.unitPrice,2.459);
 assert.equal(out.value,245.9);
 assert.equal(out.netMassKg,12.5);
 assert.equal(out.grossMassKg,13.1);
 assert.equal(out.volumeM3,0.045);
 assert.equal(out.commodityCode,'39269097');
 assert.equal(out.originCountry,'DE');
});

test('RC1549: HS/Ursprung-Gruppen summieren Warenwert, Gewicht und Volumen',()=>{
 const positions=[
  parser.normalizePosition({position:'1',description:'Teil A',commodityCode:'39269097',originCountry:'DE',quantity:10,netMassKg:4,grossMassKg:5,volumeM3:0.02,value:100,currency:'EUR'},0),
  parser.normalizePosition({position:'2',description:'Teil B',commodityCode:'39269097',originCountry:'DE',quantity:5,netMassKg:6,grossMassKg:7,volumeM3:0.03,value:150,currency:'EUR'},1)
 ];
 const out=model.rebuildReviewedAnalysis({header:{invoiceTotal:250,currency:'EUR'},positions});
 assert.equal(out.groups.length,1);
 assert.equal(out.groups[0].value,250);
 assert.equal(out.groups[0].netMassKg,10);
 assert.equal(out.groups[0].grossMassKg,12);
 assert.equal(out.groups[0].volumeM3,0.05);
 assert.equal(out.totals.netMassKg,10);
 assert.equal(out.totals.grossMassKg,12);
 assert.equal(out.totals.volumeM3,0.05);
});

test('RC1549: Proforma-PDF enthält Essentra Branding, Positionen und Zollzusammenfassung',async()=>{
 const positions=[parser.normalizePosition({position:'1',itemNumber:'A-10',description:'Kunststoffteil',commodityCode:'39269097',originCountry:'DE',quantity:100,unitPrice:2.459,netMassKg:12.5,grossMassKg:13.1,volumeM3:0.045,value:245.9,currency:'EUR'},0)];
 const snapshot=model.rebuildReviewedAnalysis({header:{invoiceNumber:'PF-1001',invoiceDate:'16.10.2026',customer:'Essentra Components GmbH',recipient:'Example Customer GmbH, Musterstrasse 1, DE-12345 Berlin',destinationCountry:'DE',invoiceTotal:245.9,currency:'EUR'},positions});
 const bytes=await exporter.createProformaPdf(snapshot);
 assert.ok(Buffer.isBuffer(bytes));
 const text=(await extractPdfText(bytes)).replace(/\s+/g,' ');
 assert.match(text,/essentra/i);
 assert.match(text,/PROFORMA INVOICE/i);
 assert.match(text,/PF-1001/);
 assert.match(text,/Example Customer GmbH/);
 assert.match(text,/Kunststoffteil/);
 assert.match(text,/39269097/);
 assert.match(text,/0\.045/);
 assert.match(text,/245\.90/);
});

test('RC1549: document creation keeps manual positions and proforma independent of ABD',()=>{
 assert.match(documents,/accept="[^"]*\.pdf[^"]*\.xlsx[^"]*\.csv/);
 assert.doesNotMatch(runtime,/data-rc1294-mode="invoice"/);
 assert.match(proformaUi,/data-rc1549-manual-add/);
 assert.match(proformaUi,/data-rc1549-manual-list/);
 assert.match(proformaUi,/data-rc1549-manual-create/);
 assert.match(proformaUi,/data-rc1549-proforma/);
 assert.match(proformaUi,/['"]proforma['"]/);
});

test('RC1549: produktiver Drei-Umgebungen-Build liefert die isolierte ABD-Proforma-Runtime aus',()=>{
 assert.match(releaseBuilder,/integrateAbdProforma.*rc1549\/integrate-abd-proforma\.mjs/s);
 assert.match(releaseBuilder,/integrateAbdProforma\(root,out\)/);
 assert.match(releaseBuilder,/ABD_PROFORMA_ASSETS/);
 assert.match(releaseBuilder,/ABD_PROFORMA_MARKERS/);
});

test('RC1549: Integrator injiziert nur in den echten Dokument-Head und niemals in spätere Druckvorlagen',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rc1549-head-'));
 const root=path.join(tmp,'root'),out=path.join(tmp,'out');
 fs.mkdirSync(path.join(root,'assets'),{recursive:true});fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(root,'assets/rc1549-abd-proforma.js'),'window.__RC1549__=true;\n');
 fs.copyFileSync('assets/rc1790-delivery-note.js',path.join(root,'assets/rc1790-delivery-note.js'));
  fs.copyFileSync('assets/rc1940-documents-workspace.js',path.join(root,'assets/rc1940-documents-workspace.js'));
  // RC1962: the release integrator must also copy the two mandatory local XLSX assets.
  for(const asset of ['rc1962-d365-local-import.js','rc1962-d365-xlsx-worker.js'])fs.copyFileSync(path.join('assets',asset),path.join(root,'assets',asset));
 fs.mkdirSync(path.join(root,'assets/i18n'),{recursive:true});
 fs.copyFileSync('assets/i18n/rc1790-delivery-note.js',path.join(root,'assets/i18n/rc1790-delivery-note.js'));

 // Integration copies every mandatory asset; mirror the production logo in this isolated fixture.
 const logo=path.join('assets','essentra-company-logo.png');
 assert.ok(fs.existsSync(logo),'RC1549 logo fixture must exist in the branch');
 fs.copyFileSync(logo,path.join(root,logo));
 const fixture='<!doctype html><html><head><meta charset="utf-8"></head><body><script>function print(){var html=\'<!doctype html><html><head><title>Print</title></head><body>OK</body></html>\';return html}</script></body></html>';
 const legacyProforma='<script id="exporthub-rc1549-abd-proforma" defer src="/assets/rc1549-abd-proforma.js?v=1962"></script>';
 for(const file of ['index.html','TESTVERSION.html','demo.html']){
  const html=file==='TESTVERSION.html'?fixture.replace('</head>',legacyProforma+'</head>'):fixture;
  fs.writeFileSync(path.join(out,file),html);
 }
 try{
  integrateAbdProforma(root,out);
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
   const html=fs.readFileSync(path.join(out,file),'utf8');
   const tag='<script id="exporthub-rc1549-abd-proforma" defer src="/assets/rc1549-abd-proforma.js?v=1971"></script>';
   assert.equal((html.match(/exporthub-rc1549-abd-proforma/g)||[]).length,1);
   assert.doesNotMatch(html,/assets\/rc1549-abd-proforma\.js\?v=1962/,'legacy Proforma cache URL must be upgraded');
   assert.ok(html.indexOf(tag)<html.indexOf('</head>'),'RC1549-Tag muss vor dem echten ersten </head> stehen');
   assert.equal((html.match(/id="exporthub-rc1790-delivery-note"/g)||[]).length,1);
   assert.equal((html.match(/id="exporthub-rc1790-delivery-note-i18n"/g)||[]).length,1);
    assert.equal((html.match(/id="exporthub-rc1940-documents"/g)||[]).length,1);
   assert.ok(html.indexOf('id="exporthub-rc1790-delivery-note"')<html.indexOf('</head>'),'RC1790 muss im echten Head stehen');
   assert.match(html,/var html='<!doctype html><html><head><title>Print<\/title><\/head><body>OK<\/body><\/html>'/);
  }
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});

test('RC1549 compatibility: legacy extraction totals remain when individual weights are absent',()=>{
 const legacy={positions:[
  {position:'1',invoiceNumber:'INV-42',commodityCode:'39269097',originCountry:'DE',value:100,currency:'EUR',missing:[],warnings:[]},
  {position:'2',invoiceNumber:'INV-42',commodityCode:'39269097',originCountry:'DE',value:50,currency:'EUR',missing:[],warnings:[]}
 ],totals:{value:150,netMassKg:12.5,grossMassKg:13.1},currencies:['EUR']};
 const enriched=model.enrichLegacyAnalysis(legacy,{invoiceTotal:150});
 assert.equal(enriched.totals.netMassKg,12.5);
 assert.equal(enriched.totals.grossMassKg,13.1);
 assert.equal(enriched.totals.volumeM3,undefined);
});

test('RC1549 compatibility: absent group metrics do not change the legacy export schema',()=>{
 const reviewed=model.rebuildReviewedAnalysis({
  header:{invoiceNumber:'INV',invoiceTotal:100,currency:'EUR'},
  positions:[{position:'1',description:'Part',commodityCode:'39269097',originCountry:'DE',value:100,currency:'EUR',confirmed:true}]
 });
 assert.equal(reviewed.review.complete,true);
 assert.deepEqual(exporter.createExportModel(reviewed).groups,[{
  commodityCode:'39269097',originCountry:'DE',value:100,currency:'EUR',positionCount:1
 }]);
});


test('RC1968: Proforma recipient lookup finds customer number including leading zeros and distinct locations',()=>{
 const start=proformaUi.indexOf('/* RC1968: client-side recipient lookup');
 const end=proformaUi.indexOf('function normalizeRows(){',start);
 assert.ok(start>0&&end>start);
 const customers=[
  {account:'000123',name:'Danfoss GmbH',address:'Main Street 1, 40000 Exampletown, DE',
   locations:[{name:'Warehouse North',recipientName:'Danfoss Receiving',address:'Dock 7, Exampletown, DE'},
    {name:'Warehouse South',recipientName:'Danfoss Receiving',address:'Dock 9, Exampletown, DE'}]},
  {account:'0912',name:'Neff',address:'Another street 8, DE'}
 ];
 const ctx={
  root:{__EXPORTHUB_GET_STATE__:()=>({customers})},
  q:value=>String(value??'').trim(),
  language:()=> 'de',
  manualPanel:()=>null
 };
 const funcs=vm.runInNewContext(proformaUi.slice(start,end)+'\n({rcmatches,rcdirectory,rcaddress})',ctx);
 const matches=Array.from(funcs.rcmatches('000123'));
 assert.equal(matches.length,3);
 assert.ok(matches.every(x=>x.account==='000123'));
 assert.deepEqual(matches.map(x=>x.address).sort(),[
  'Dock 7, Exampletown, DE','Dock 9, Exampletown, DE','Main Street 1, 40000 Exampletown, DE'
 ]);
 assert.equal(funcs.rcmatches('danfoss').length,3);
 assert.equal(funcs.rcmatches('0912').length,1);
 assert.equal(funcs.rcmatches('nonexistent').length,0);
 assert.match(proformaUi,/data-rc1549-recipient-search/);
 assert.match(proformaUi,/data-rc1549-recipient-choice/);
 assert.doesNotMatch(proformaUi.slice(start,end),/fetch\s*\(|localStorage|sessionStorage|sendBeacon\s*\(/);
});
test('RC1968: selected recipient cannot overwrite manually entered invoice fields without approval',()=>{
 const start=proformaUi.indexOf('/* RC1968: client-side recipient lookup');
 const end=proformaUi.indexOf('function normalizeRows(){',start);
 const customers=[{account:'0042',name:'Customer A',address:'Correct address 3'}];
 const fields={
  recipient:{value:'Manual recipient'},recipientAddress:{value:'Manual address'}
 };
 const results={replaceChildren(){this.nodes=[]},appendChild(node){(this.nodes??=[]).push(node)}};
 const search={value:'0042'};
 const panel={querySelector(selector){
  if(selector==='[data-rc1549-recipient-search]')return search;
  if(selector==='[data-rc1549-recipient-results]')return results;
  const match=/^\[data-rc1549-header="([^"]+)"\]$/.exec(selector);
  return match?fields[match[1]]||null:null
 }};
 let confirm=false,invalidated=0,status='';
 const root={
  __EXPORTHUB_GET_STATE__:()=>({customers}),
  confirm:()=>confirm,
  document:{createElement:()=>({children:[],setAttribute(){},appendChild(x){this.children.push(x)}})}
 };
 const headerDraft={recipient:'Manual recipient',recipientAddress:'Manual address',invoiceNumber:'INV-OLD',shipmentReference:'REF-OLD',currency:'EUR',incoterm:'DAP'};
 const ctx={root,headerDraft,q:value=>String(value??'').trim(),language:()=> 'de',manualPanel:()=>panel,invalidate:()=>{invalidated++},setStatus:s=>{status=s}};
 const {rcrender,rcchoose}=vm.runInNewContext(proformaUi.slice(start,end)+'\n({rcrender,rcchoose})',ctx);
 rcrender('0042');
 assert.equal(rcchoose(0),false,'no overwrite without confirmation');
 assert.equal(headerDraft.recipient,'Manual recipient');
 assert.equal(fields.recipientAddress.value,'Manual address');
 confirm=true;
 assert.equal(rcchoose(0),true);
 assert.equal(fields.recipient.value,'Customer A');
 assert.equal(fields.recipientAddress.value,'Correct address 3');
 assert.equal(headerDraft.invoiceNumber,'INV-OLD');
 assert.equal(headerDraft.shipmentReference,'REF-OLD');
 assert.equal(headerDraft.incoterm,'DAP');
 assert.equal(headerDraft.currency,'EUR');
 assert.equal(invalidated,1);
 assert.match(status,/Adresse prüfen/);
});

test('RC1968: customer without a stored address clears stale recipient address only after confirmation',()=>{
 const start=proformaUi.indexOf('/* RC1968: client-side recipient lookup');
 const end=proformaUi.indexOf('function normalizeRows(){',start);
 const customers=[
  {account:'0077',name:'Customer Without Address'},
  {account:'0088',name:'Disabled',address:'Should not show',disabled:true},
  {account:'0089',name:'Deleted',address:'Should not show',deleted:true},
  {account:'0090',name:'Inactive',address:'Should not show',active:false}
 ];
 const fields={recipient:{value:'Previous Customer'},recipientAddress:{value:'Previous Customer Address'}};
 const results={replaceChildren(){this.nodes=[]},appendChild(node){(this.nodes??=[]).push(node)}};
 const search={value:'0077'};
 const panel={querySelector(selector){
  if(selector==='[data-rc1549-recipient-search]')return search;
  if(selector==='[data-rc1549-recipient-results]')return results;
  const match=/^\[data-rc1549-header="([^"]+)"\]$/.exec(selector);
  return match?fields[match[1]]||null:null
 }};
 let confirm=false,invalidated=0,status='';
 const root={
  __EXPORTHUB_GET_STATE__:()=>({customers}),
  confirm:()=>confirm,
  document:{createElement:()=>({children:[],setAttribute(){},appendChild(x){this.children.push(x)}})}
 };
 const headerDraft={recipient:'Previous Customer',recipientAddress:'Previous Customer Address',invoiceNumber:'KEEP-123'};
 const ctx={root,headerDraft,q:v=>String(v??'').trim(),language:()=> 'de',manualPanel:()=>panel,invalidate:()=>{invalidated++},setStatus:s=>{status=s}};
 const {rcmatches,rcrender,rcchoose}=vm.runInNewContext(proformaUi.slice(start,end)+'\n({rcmatches,rcrender,rcchoose})',ctx);
 assert.equal(rcmatches('0088').length,0);
 assert.equal(rcmatches('0089').length,0);
 assert.equal(rcmatches('0090').length,0);
 rcrender('0077');
 assert.equal(rcchoose(0),false,'missing address may not silently retain a different recipient address');
 assert.equal(fields.recipient.value,'Previous Customer');
 assert.equal(fields.recipientAddress.value,'Previous Customer Address');
 confirm=true;
 assert.equal(rcchoose(0),true);
 assert.equal(fields.recipient.value,'Customer Without Address');
 assert.equal(fields.recipientAddress.value,'');
 assert.equal(headerDraft.recipientAddress,'');
 assert.equal(headerDraft.invoiceNumber,'KEEP-123');
 assert.equal(invalidated,1);
 assert.match(status,/Adresse ergänzen/);
});
