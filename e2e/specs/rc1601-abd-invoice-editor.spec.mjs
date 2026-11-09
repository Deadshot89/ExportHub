import {test, expect} from '@playwright/test';
import {appEntry,waitReady,openExportHubView} from '../helpers/exporthub-browser.mjs';

const json=(body,status=200)=>({status,contentType:'application/json',body:JSON.stringify(body)});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLojwAAAABJRU5ErkJggg==','base64');

function uploaded(){
 const hs='39269097',origin='DE',value=50;
 return{
  fileName:'invoice.csv',fileType:'csv',
  header:{invoiceNumber:'INV-BROWSER-1601',invoiceDate:'2026-10-22',customer:'Essentra Components GmbH',recipient:'Example Customer Ltd',destinationCountry:'GB',invoiceTotal:value,currency:'EUR'},
  positions:[{position:'1',itemNumber:'CAP-10',description:'Test component',quantity:10,unit:'pcs',unitPrice:5,value,netMassKg:1.2,grossMassKg:1.4,commodityCode:hs,originCountry:origin,currency:'EUR',confirmed:true,missing:[]}],
  groups:[{key:hs+'|'+origin,commodityCode:hs,originCountry:origin,value,currency:'EUR',positionCount:1,status:'complete',warnings:[]}],
  unassigned:[],totals:{invoiceTotal:value,accountedTotal:value,difference:0,currency:'EUR'},review:{complete:true,groupCount:1,unassignedCount:0}
 }
}
function reanalyzed(payload){
 const positions=payload.positions,invoiceTotal=positions.reduce((total,p)=>total+Number(p.value||0),0);
 const groups=positions.map(p=>({commodityCode:p.commodityCode,originCountry:p.originCountry,value:Number(p.value),currency:p.currency,positionCount:1,status:'complete'}));
 return{header:{...payload.header,invoiceTotal},positions,groups,unassigned:[],totals:{invoiceTotal,accountedTotal:invoiceTotal,difference:0,currency:payload.header.currency},review:{complete:true,groupCount:groups.length,unassignedCount:0}}
}

test('RC1940: eigene Dokumentenerstellung im Menü öffnen und zwischen Rechnung und Lieferschein wechseln',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='laptop','Chromium Laptop');
 await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
 await waitReady(page);
 await openExportHubView(page,'abd',['ABD erstellen','ABD'],/ABD-Anfrage|Grunddaten|ABD/i,{allowProgrammaticFallback:true});
 const nav=page.locator('#nav > [data-exporthub-documents-nav]');
 await expect(nav).toBeVisible({timeout:10_000});
 await expect(nav).toContainText(/Dokumente erstellen|Create documents/i);
 await nav.click();
 const workspace=page.locator('#rc1940Documents');
 await expect(workspace).toBeVisible({timeout:10_000});
 await expect(page.locator('body')).toHaveAttribute('data-exporthub-view','documents');
 await expect(workspace.locator('#rc1549AbdManual')).toBeVisible();
 await expect(workspace.locator('#rc1790DeliveryNote')).toBeHidden();
 await workspace.locator('[data-rc1790-tab="delivery"]').click();
 await expect(workspace.locator('#rc1790DeliveryNote')).toBeVisible();
 await expect(workspace.locator('#rc1549AbdManual')).toBeHidden();
 await workspace.locator('[data-rc1790-tab="invoice"]').click();
 await expect(workspace.locator('#rc1549AbdManual')).toBeVisible();
 await expect(workspace.locator('#rc1790DeliveryNote')).toBeHidden();
 await expect(workspace.locator('[data-rc1294-abd-analysis]')).toHaveCount(0);
});

test('RC1941: Rechnung und Lieferschein im eigenen Bereich aus CSV analysieren und übernehmen',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='laptop','Chromium Laptop');
 await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
 await waitReady(page);
 await openExportHubView(page,'abd',['ABD erstellen','ABD'],/ABD-Anfrage|Grunddaten|ABD/i,{allowProgrammaticFallback:true});
 await page.evaluate(analysis=>{
  const original=window.fetch.bind(window);
  window.fetch=async function(input,options){
   const url=typeof input==='string'?input:String(input&&input.url||'');
   if(url==='/api/abd-analysis'||url.endsWith('/api/abd-analysis')){
    const payload=JSON.parse(options&&options.body||'{}');
    if(payload.action==='upload')return new Response(JSON.stringify({ok:true,status:'scanning',upload:{id:'mock-defender',name:payload.file&&payload.file.name}}),{status:202,headers:{'Content-Type':'application/json'}});
    if(payload.action==='status')return new Response(JSON.stringify({ok:true,status:'ready',analysis}),{status:200,headers:{'Content-Type':'application/json'}});
   }
   return original(input,options);
  };
 },uploaded());
 const nav=page.locator('#nav > [data-exporthub-documents-nav]');
 await expect(nav).toBeVisible({timeout:10_000});
 await nav.click();
 const workspace=page.locator('#rc1940Documents');
 await workspace.locator('[data-rc1940-files]').setInputFiles({name:'invoice.csv',mimeType:'text/csv',buffer:Buffer.from('Artikelnummer;Warenbeschreibung;Menge\\nCAP-10;Test component;10','utf8')});
 await workspace.locator('[data-rc1940-analyze]').click();
 const result=workspace.locator('[data-rc1940-upload-results] .rc1940-preview');
 await expect(result).toHaveCount(1,{timeout:10_000});
 await expect(result).toContainText('CAP-10');
 await result.locator('[data-rc1940-use]').click();
 await expect(workspace.locator('#rc1549AbdManual tbody [data-field="itemNumber"]').first()).toHaveValue('CAP-10');
 await expect(workspace.locator('#rc1549AbdManual tbody [data-field="description"]').first()).toHaveValue('Test component');
 await workspace.locator('[data-rc1790-tab="delivery"]').click();
 await result.locator('[data-rc1940-use]').click();
 await expect(workspace.locator('#rc1790DeliveryNote tbody [data-field="itemNumber"]').first()).toHaveValue('CAP-10');
 await expect(workspace.locator('#rc1790DeliveryNote tbody [data-field="quantity"]').first()).toHaveValue('10');
 await expect(workspace.locator('#rc1790DeliveryNote [data-rc1790-header="recipient"]')).toHaveValue('Example Customer Ltd');
 await expect(workspace.locator('[data-rc1294-invoice-panel]')).toHaveCount(0);
});

test('RC1601: Rechnung per Upload korrigieren, validieren und als PDF exportieren',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='laptop','Test läuft einmal im Chromium-Laptop-Profil.');
 test.setTimeout(90_000);
 const pageErrors=[];
 page.on('pageerror',e=>pageErrors.push(e.message));
 await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
 await waitReady(page);
 // Demo replaces window.fetch before Playwright's network routing. Install a test-only wrapper
 // after bootstrap so only these isolated fake invoice endpoints are intercepted.
 await page.evaluate(uploadedInvoice=>{
   const original=window.fetch.bind(window);
   window.__rc1601Exports=[];
   window.fetch=async function(input,options){
     const url=typeof input==='string'?input:String(input&&input.url||'');
     const make=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
     if(url==='/api/abd-analysis'||url.endsWith('/api/abd-analysis')){
       const payload=JSON.parse(options&&options.body||'{}');
       if(payload.action==='upload')return make({ok:true,status:'scanning',upload:{id:'rc1601-mock',name:'invoice.csv',fileType:'csv'}},202);
       if(payload.action==='status')return make({ok:true,status:'ready',analysis:uploadedInvoice});
       if(payload.action==='reanalyze'){
         const positions=payload.positions||[],invoiceTotal=positions.reduce((sum,p)=>sum+Number(p.value||0),0);
         return make({ok:true,analysis:{
           header:{...payload.header,invoiceTotal},positions,
           groups:positions.map(p=>({commodityCode:p.commodityCode,originCountry:p.originCountry,value:Number(p.value),currency:p.currency,positionCount:1,status:'complete'})),
           unassigned:[],totals:{invoiceTotal,accountedTotal:invoiceTotal,difference:0,currency:payload.header.currency},review:{complete:true,groupCount:positions.length,unassignedCount:0}
         }});
       }
       return make({ok:false,code:'RC1601_UNEXPECTED_ACTION'},400)
     }
     if(url==='/api/abd-analysis/export'||url.endsWith('/api/abd-analysis/export')){
       window.__rc1601Exports.push(JSON.parse(options&&options.body||'{}'));
       return make({ok:true,file:{name:'Proforma-Browser.pdf',mimeType:'application/pdf',base64:btoa('%PDF-1.4\\n%Browser-test-only')}})
     }
     return original(input,options)
   }
 },uploaded());
 await openExportHubView(page,'abd',['ABD erstellen','ABD'],/ABD-Anfrage|Grunddaten|ABD/i,{allowProgrammaticFallback:true});
 const panel=page.locator('[data-rc1294-abd-analysis="1"]');
 await expect(panel).toBeVisible({timeout:10_000});
 await panel.locator('[data-rc1294-mode="invoice"]').click();
 await expect(panel.locator('#rc1549AbdManual')).toHaveCount(0);
 await panel.locator('[data-rc1294-files]').setInputFiles({name:'invoice.csv',mimeType:'text/csv',buffer:Buffer.from('Artikel;Menge;Wert\nCAP-10;10;50')});
 await panel.locator('[data-rc1294-start]').click();
 const doc=panel.locator('.rc1294-document');
 await expect(doc).toHaveCount(1,{timeout:20_000});
 await expect(doc.locator('[data-rc1549-import]')).toBeEnabled({timeout:10_000});
 await expect(doc.locator('[data-rc1549-proforma]')).toHaveCount(0);
 await doc.locator('[data-rc1549-import]').click();
 const editor=page.locator('#rc1940Documents #rc1549AbdManual');
  await expect(page.locator('#rc1940Documents')).toBeVisible({timeout:10_000});
 await expect(editor.locator('tbody tr')).toHaveCount(1);
 await expect(editor.locator('[data-field="itemNumber"]')).toHaveValue('CAP-10');
 await expect(editor.locator('[data-rc1549-header="senderAddress"]')).toHaveValue(/Montel-Allee 3/);
 await expect(editor.locator('[data-rc1549-header="senderVatId"]')).toHaveValue('DE301601416');
 await expect(editor.locator('[data-rc1549-header="senderTaxNumber"]')).toHaveValue('115/5711/1576');
 await expect(editor.locator('[data-rc1549-header="senderRegister"]')).toHaveValue('HRB 20649, Amtsgericht Krefeld');
 await expect(editor.locator('[data-rc1549-header="senderEori"]')).toHaveValue('');
 await expect(editor.locator('[data-rc1549-header="recipientEori"]')).toHaveCount(0);
 await expect(editor.locator('[data-rc1549-header="recipientVatId"]')).toHaveCount(0);
 await editor.locator('[data-rc1549-header="senderAddress"]').fill('Essentra Components GmbH, 41334 Nettetal, Germany');
 await editor.locator('[data-rc1549-header="recipientAddress"]').fill('Dock Road 18, Liverpool, United Kingdom');
 await editor.locator('[data-rc1549-header="senderEori"]').fill('DE123456789123456');
 await editor.locator('[data-rc1549-header="senderVatId"]').fill('DE123456789');
 await editor.locator('[data-rc1549-header="exportReason"]').fill('Free replacement goods');
 await editor.locator('[data-rc1549-header="incoterm"]').fill('DAP');
 await editor.locator('[data-field="quantity"]').fill('20');
 await expect(editor.locator('[data-field="value"]')).toHaveValue('100.00');
 await editor.locator('[data-rc1549-logo]').setInputFiles({name:'essentra.png',mimeType:'image/png',buffer:png});
 await expect(editor.locator('[data-rc1549-status]')).toBeVisible();
 await editor.locator('[data-rc1549-manual-create]').click();
 await expect(editor.locator('[data-rc1549-result] [data-rc1549-proforma]')).toBeEnabled({timeout:15_000});
 let download;
 try{
  [download]=await Promise.all([page.waitForEvent('download'),editor.locator('[data-rc1549-result] [data-rc1549-proforma]').click()]);
 }catch(error){
  const debug=await page.evaluate(()=>({
   exportCalls:Array.isArray(window.__rc1601Exports)?window.__rc1601Exports.length:-1,
   uiStatus:document.querySelector('#rc1549AbdManual [data-rc1549-status]')?.textContent||'',
   uiStatusKind:document.querySelector('#rc1549AbdManual [data-rc1549-status]')?.getAttribute('data-kind')||'',
   buttonDisabled:document.querySelector('#rc1549AbdManual [data-rc1549-proforma]')?.disabled,
   view:document.body.getAttribute('data-exporthub-view')||''
  }));
  throw new Error('RC1601 PDF-download diagnostics: '+JSON.stringify(debug)+' / '+error.message);
 }
 expect(download.suggestedFilename()).toBe('Proforma-Browser.pdf');
 const exports=await page.evaluate(()=>window.__rc1601Exports);
 expect(exports).toHaveLength(1);
 expect(exports[0].format).toBe('proforma');
 expect(exports[0].snapshot.header.senderAddress).toContain('Nettetal');
 expect(exports[0].snapshot.header.recipientAddress).toContain('Liverpool');
 expect(exports[0].snapshot.header.senderEori).toBe('DE123456789123456');
 expect(exports[0].snapshot.header.senderVatId).toBe('DE123456789');
 expect(exports[0].snapshot.header.exportReason).toBe('Free replacement goods');
 expect(exports[0].snapshot.header.incoterm).toBe('DAP');
 expect(exports[0].snapshot.positions[0].quantity).toBe(20);
 expect(exports[0].snapshot.positions[0].value).toBe(100);
 expect(exports[0].snapshot.logoDataUri).toMatch(/^data:image\/png;base64,/);
 await expect(editor.locator('[data-rc1549-header="shipmentDate"]')).toHaveCount(0);
 await expect(editor.locator('[data-rc1549-header="incotermPlace"]')).toHaveCount(0);
 await expect(editor.locator('[data-rc1549-header="insuranceCost"]')).toHaveCount(0);
 await editor.locator('[data-rc1549-header="senderEori"]').fill('');
 await editor.locator('[data-rc1549-header="exportReason"]').fill('');
 await editor.locator('[data-rc1549-manual-create]').click();
 await expect(editor.locator('[data-rc1549-result] [data-rc1549-proforma]')).toBeEnabled({timeout:15_000});
 const [secondDownload]=await Promise.all([page.waitForEvent('download'),editor.locator('[data-rc1549-result] [data-rc1549-proforma]').click()]);
 expect(secondDownload.suggestedFilename()).toBe('Proforma-Browser.pdf');
 const allExports=await page.evaluate(()=>window.__rc1601Exports);
 expect(allExports).toHaveLength(2);
 expect(allExports[1].snapshot.header.senderEori).toBe('');
 expect(allExports[1].snapshot.header.exportReason).toBe('');
 for(const key of ['shipmentDate','incotermPlace','insuranceCost'])expect(allExports[1].snapshot.header).not.toHaveProperty(key);
 expect(pageErrors).toEqual([]);
});


test('RC1784: D365-TXT-Upload erzeugt getrennte Empfänger-Rechnungsentwürfe',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='laptop','Chromium Laptop');
 test.setTimeout(90_000);
 await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
 await waitReady(page);
 await page.evaluate(()=>{
   const original=window.fetch.bind(window);
   const make=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
   const position=(item,value)=>({position:'1',itemNumber:item,description:'Component '+item,quantity:2,unit:'EA',unitPrice:value/2,value,netMassKg:0.5,grossMassKg:0.6,commodityCode:'3926909790',originCountry:'IN',currency:'EUR',confirmed:false,missing:[]});
   const document=(name,ref,item,value)=>({
     fileName:'D365.txt · '+ref+' · '+name,fileType:'d365',
     header:{recipient:name,recipientAddress:'Warehouse, '+name+', United Kingdom',destinationCountry:'GB',shipmentReference:ref,invoiceTotal:value,currency:'EUR'},
     positions:[position(item,value)],groups:[],unassigned:[],review:{complete:false},totals:{invoiceTotal:value,currency:'EUR'}
   });
   window.fetch=async(input,options)=>{
     const url=typeof input==='string'?input:String(input&&input.url||'');
     if(url==='/api/abd-analysis'||url.endsWith('/api/abd-analysis')){
       const payload=JSON.parse(options&&options.body||'{}');
       if(payload.action==='upload')return make({ok:true,status:'scanning',upload:{id:'rc1784-mock',name:payload.file.name}},202);
       if(payload.action==='status'){
         const docs=[document('Customer A','DNC1','A1',10),document('Customer B','DNC2','B1',20)];
         return make({ok:true,status:'ready',analysis:{fileName:'D365.txt',positions:docs.flatMap(d=>d.positions),deliveryDocuments:docs}});
       }
     }
     return original(input,options);
   };
 });
 await openExportHubView(page,'abd',['ABD erstellen','ABD'],/ABD-Anfrage|Grunddaten|ABD/i,{allowProgrammaticFallback:true});
 const panel=page.locator('[data-rc1294-abd-analysis="1"]');
 await expect(panel).toBeVisible({timeout:10_000});
 await panel.locator('[data-rc1294-mode="invoice"]').click();
 await panel.locator('[data-rc1294-files]').setInputFiles({name:'D365.txt',mimeType:'text/plain',buffer:Buffer.from('PACKINGSLIPID\\tITEMNUMBER\\tQTY\\nDNC1\\tA1\\t2')});
 await panel.locator('[data-rc1294-start]').click();
 const docs=panel.locator('.rc1294-document');
 await expect(docs).toHaveCount(2,{timeout:20_000});
 await expect(docs.nth(0)).toContainText('Customer A');
 await expect(docs.nth(1)).toContainText('Customer B');
 await docs.nth(1).locator('[data-rc1549-import]').click();
 const editor=page.locator('#rc1940Documents #rc1549AbdManual');
  await expect(page.locator('#rc1940Documents')).toBeVisible({timeout:10_000});
 await expect(editor.locator('[data-rc1549-header="recipient"]')).toHaveValue('Customer B');
 await expect(editor.locator('tbody tr')).toHaveCount(1);
 await expect(editor.locator('[data-field="itemNumber"]')).toHaveValue('B1');
});
