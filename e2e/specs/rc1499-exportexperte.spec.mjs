import {test,expect} from '@playwright/test';
import {
  appEntry,
  waitReady,
  openExportHubView,
  assertNoSourceLeak,
  assertNoHorizontalOverflow,
  attachRuntimeGuards,
  assertRuntimeClean,
  installE2ESession
} from '../helpers/exporthub-browser.mjs';

function completeAnalysis(fileName,index){
  const hs=['39269097','73181595','85369010','40169997'][index%4];
  const origin=['CN','DE','PL','IT'][index%4];
  const value=100+index*25;
  return{
    fileName,fileType:fileName.split('.').pop(),
    header:{invoiceNumber:'INV-E2E-'+(index+1),invoiceDate:'2026-10-12',customer:'E2E Kunde',recipient:'E2E Empfaenger',destinationCountry:'CH',invoiceTotal:value,currency:'EUR'},
    positions:[{position:'10',itemNumber:'ITEM-'+(index+1),description:'E2E Position '+(index+1),commodityCode:hs,originCountry:origin,quantity:1,netMassKg:1,grossMassKg:1.2,value,currency:'EUR',source:fileName,confirmed:true,missing:[]}],
    groups:[{key:hs+'|'+origin,commodityCode:hs,originCountry:origin,value,currency:'EUR',positionCount:1,status:'complete',warnings:[]}],
    unassigned:[],
    totals:{invoiceTotal:value,groupedTotal:value,unassignedKnownValue:0,accountedTotal:value,difference:0,currency:'EUR',currencies:['EUR'],currencyCompatible:true,valueCoverageComplete:true,unassignedCount:0},
    review:{groupCount:1,readyGroupCount:1,reviewGroupCount:0,unassignedCount:0,missingHsCount:0,missingOriginCount:0,missingValueCount:0,complete:true,warnings:[]}
  };
}

function reviewAnalysis(fileName,index){
  const value=175;
  const position={position:'10',itemNumber:'SCAN-'+(index+1),description:'OCR Position pruefen',commodityCode:'',originCountry:'CN',quantity:1,netMassKg:1,grossMassKg:1.2,value,currency:'EUR',source:fileName,confirmed:false,missing:['commodityCode'],warnings:['ocr-review-required']};
  return{
    fileName,fileType:fileName.split('.').pop(),
    header:{invoiceNumber:'INV-E2E-'+(index+1),invoiceDate:'2026-10-12',customer:'E2E Kunde',recipient:'E2E Empfaenger',destinationCountry:'CH',invoiceTotal:value,currency:'EUR'},
    positions:[position],groups:[],unassigned:[position],
    totals:{invoiceTotal:value,groupedTotal:0,unassignedKnownValue:value,accountedTotal:value,difference:0,currency:'EUR',currencies:['EUR'],currencyCompatible:true,valueCoverageComplete:true,unassignedCount:1},
    review:{groupCount:0,readyGroupCount:0,reviewGroupCount:0,unassignedCount:1,missingHsCount:1,missingOriginCount:0,missingValueCount:0,complete:false,warnings:['unassigned-positions']}
  };
}

test.beforeEach(async({page})=>{
  if(process.env.EXPORTHUB_E2E_LIVE==='1')await installE2ESession(page);
});

test('RC1499: Rechnungsanalyse verarbeitet alle Pflichtformate, mehrere Rechnungen und schützt Legacy-ABD',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Exportexperte-End-to-End läuft einmal auf dem Laptop-Profil.');
  test.setTimeout(90_000);

  const uploads=new Map();let sequence=0;
  await page.route('**/api/abd-analysis',async route=>{
    const request=route.request();
    if(request.method()!=='POST')return route.continue();
    let payload={};try{payload=request.postDataJSON()||{}}catch(_){}
    if(payload.action==='upload'){
      const id='e2e-upload-'+(++sequence),name=String(payload.file&&payload.file.name||'invoice.csv');
      uploads.set(id,{name,index:sequence-1});
      return route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({ok:true,status:'scanning',upload:{id,name,size:32,fileType:name.split('.').pop(),provider:'E2E'}})});
    }
    if(payload.action==='status'){
      const item=uploads.get(String(payload.uploadId||''));
      if(!item)return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({ok:false,code:'E2E_UPLOAD_NOT_FOUND'})});
      const analysis=/\.pdf$/i.test(item.name)?reviewAnalysis(item.name,item.index):completeAnalysis(item.name,item.index);
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,status:'ready',analysis})});
    }
    return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({ok:false,code:'E2E_ACTION_UNSUPPORTED'})});
  });

  const runtime=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'abd',['ABD erstellen','ABD'],/ABD-Anfrage|Grunddaten|ABD/i,{allowProgrammaticFallback:true});

  const panel=page.locator('[data-rc1294-abd-analysis="1"]');
  await expect(panel).toBeVisible({timeout:10_000});
  await panel.locator('[data-rc1294-mode="invoice"]').click();
  await expect(panel.locator('[data-rc1294-invoice-panel]')).toBeVisible();

  await panel.locator('[data-rc1294-files]').setInputFiles([
    {name:'invoice.csv',mimeType:'text/csv',buffer:Buffer.from('Position;HS;Origin;Value\n10;39269097;CN;100')},
    {name:'invoice.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from('PK\u0003\u0004E2E-XLSX')},
    {name:'invoice.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%E2E')},
    {name:'invoice.png',mimeType:'image/png',buffer:Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x45,0x32,0x45])}
  ]);
  await panel.locator('[data-rc1294-start]').click();

  const documents=panel.locator('.rc1294-document');
  await expect(documents).toHaveCount(4,{timeout:20_000});
  for(const name of ['invoice.csv','invoice.xlsx','invoice.pdf','invoice.png'])await expect(panel).toContainText(name);
  for(const invoice of ['INV-E2E-1','INV-E2E-2','INV-E2E-3','INV-E2E-4'])await expect(panel).toContainText(invoice);

  const csvDoc=documents.filter({hasText:'invoice.csv'}).first();
  const xlsxDoc=documents.filter({hasText:'invoice.xlsx'}).first();
  const pdfDoc=documents.filter({hasText:'invoice.pdf'}).first();
  const pngDoc=documents.filter({hasText:'invoice.png'}).first();
  await expect(csvDoc.locator('.rc1294-group-table tbody tr')).toHaveCount(1);
  await expect(xlsxDoc.locator('.rc1294-group-table tbody tr')).toHaveCount(1);
  await expect(pngDoc.locator('.rc1294-group-table tbody tr')).toHaveCount(1);
  await expect(csvDoc.locator('.rc1294-metric').last()).toHaveClass(/ok/);
  await expect(csvDoc.locator('.rc1294-metric').last()).toContainText(/0/);

  await expect(pdfDoc.locator('.rc1294-unassigned')).toBeVisible();
  await expect(pdfDoc.locator('.rc1294-state.review')).toBeVisible();
  await expect(pdfDoc).toContainText(/prüfen|review|missing|fehlt/i);

  await expect(csvDoc.locator('[data-rc1499-export-pdf]')).toBeEnabled({timeout:10_000});
  await expect(csvDoc.locator('[data-rc1499-export-xlsx]')).toBeEnabled();
  await expect(pdfDoc.locator('[data-rc1499-export-pdf]')).toBeDisabled();
  await expect(page.locator('[data-rc1499-prepare-abd]')).toBeDisabled();

  await panel.locator('[data-rc1294-mode="manual"]').click();
  await expect(panel.locator('[data-rc1294-invoice-panel]')).toBeHidden();
  await expect(page.locator('#rc626Abd')).toBeVisible();
  await expect(page.locator('#rc626Abd')).toContainText(/ABD-Anfrage|Grunddaten|Colli/i);

  await panel.locator('[data-rc1294-mode="shipment"]').click();
  await expect(page.locator('#rc626Abd')).toBeVisible();

  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  await assertRuntimeClean(runtime,testInfo);
});
