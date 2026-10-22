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
test('RC1601: Rechnung per Upload korrigieren, validieren und als PDF exportieren',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='laptop','Test läuft einmal im Chromium-Laptop-Profil.');
 test.setTimeout(90_000);
 const pageErrors=[],exports=[];
 // Isolated static demo browser uses a synthetic token only for intercepted E2E endpoints.
 await page.addInitScript(()=>sessionStorage.setItem('__rc1601_test_session',JSON.stringify({token:'RC1601-E2E-FAKE-SESSION'})));
 page.on('pageerror',e=>pageErrors.push(e.message));
 await page.route('**/api/abd-analysis',async route=>{
  if(route.request().method()!=='POST')return route.continue();
  const payload=route.request().postDataJSON()||{};
  if(payload.action==='upload')return route.fulfill(json({ok:true,status:'scanning',upload:{id:'rc1601-mock',name:payload.file?.name,fileType:'csv'}},202));
  if(payload.action==='status')return route.fulfill(json({ok:true,status:'ready',analysis:uploaded()}));
  if(payload.action==='reanalyze')return route.fulfill(json({ok:true,status:'ready',analysis:reanalyzed(payload)}));
  return route.fulfill(json({ok:false,code:'MOCK_ACTION_NOT_SUPPORTED'},400))
 });
 await page.route('**/api/abd-analysis/export',async route=>{
  const payload=route.request().postDataJSON();
  exports.push(payload);
  return route.fulfill(json({ok:true,file:{name:'Proforma-Browser.pdf',mimeType:'application/pdf',base64:Buffer.from('%PDF-1.4\n%Browser-test-only').toString('base64')}}))
 });
 await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
 await waitReady(page);
 await openExportHubView(page,'abd',['ABD erstellen','ABD'],/ABD-Anfrage|Grunddaten|ABD/i,{allowProgrammaticFallback:true});
 const panel=page.locator('[data-rc1294-abd-analysis="1"]');
 await expect(panel).toBeVisible({timeout:10_000});
 await panel.locator('[data-rc1294-mode="invoice"]').click();
 await expect(panel.locator('#rc1549AbdManual')).toBeVisible({timeout:10_000});
 await panel.locator('[data-rc1294-files]').setInputFiles({name:'invoice.csv',mimeType:'text/csv',buffer:Buffer.from('Artikel;Menge;Wert\nCAP-10;10;50')});
 await panel.locator('[data-rc1294-start]').click();
 const doc=panel.locator('.rc1294-document');
 await expect(doc).toHaveCount(1,{timeout:20_000});
 await expect(doc.locator('[data-rc1549-import]')).toBeEnabled({timeout:10_000});
 await expect(doc.locator('[data-rc1549-proforma]')).toBeDisabled();
 await doc.locator('[data-rc1549-import]').click();
 const editor=page.locator('#rc1549AbdManual');
 await expect(editor.locator('tbody tr')).toHaveCount(1);
 await expect(editor.locator('[data-field="itemNumber"]')).toHaveValue('CAP-10');
 await editor.locator('[data-rc1549-header="senderAddress"]').fill('Essentra Components GmbH, 41334 Nettetal, Germany');
 await editor.locator('[data-rc1549-header="recipientAddress"]').fill('Dock Road 18, Liverpool, United Kingdom');
 await editor.locator('[data-field="quantity"]').fill('20');
 await expect(editor.locator('[data-field="value"]')).toHaveValue('100.00');
 await editor.locator('[data-rc1549-logo]').setInputFiles({name:'essentra.png',mimeType:'image/png',buffer:png});
 await expect(editor.locator('[data-rc1549-status]')).toBeVisible();
 await editor.locator('[data-rc1549-manual-create]').click();
 await expect(editor.locator('[data-rc1549-result] [data-rc1549-proforma]')).toBeEnabled({timeout:15_000});
 const [download]=await Promise.all([page.waitForEvent('download'),editor.locator('[data-rc1549-result] [data-rc1549-proforma]').click()]);
 expect(download.suggestedFilename()).toBe('Proforma-Browser.pdf');
 expect(exports).toHaveLength(1);
 expect(exports[0].format).toBe('proforma');
 expect(exports[0].snapshot.header.senderAddress).toContain('Nettetal');
 expect(exports[0].snapshot.header.recipientAddress).toContain('Liverpool');
 expect(exports[0].snapshot.positions[0].quantity).toBe(20);
 expect(exports[0].snapshot.positions[0].value).toBe(100);
 expect(exports[0].snapshot.logoDataUri).toMatch(/^data:image\/png;base64,/);
 expect(pageErrors).toEqual([]);
});
