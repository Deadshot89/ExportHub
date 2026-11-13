import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {appEntry,waitReady,openExportHubView} from '../helpers/exporthub-browser.mjs';

const require=createRequire(import.meta.url);
const ExcelJS=require('../../api/node_modules/exceljs');

async function sampleD365(){
 const wb=new ExcelJS.Workbook(),sheet=wb.addWorksheet('D365');
 const columns=['PACKINGSLIPID','ITEMNUMBER','QTY','COMMODITYCODE','SHIPPEDAMOUNT','LINEAMOUNT','SALESORDERLINESTATUS','DELIVERYADDRESSNAME','FORMATTEDDELVERYADDRESS','DELIVERYADDRESSCOUNTRYREGIONISOCODE','ORIGCOUNTRYREGIONID','PRODUCTDESCRIPTION','SHIPPEDQTYNETWEIGHT','SHIPPEDQTYGROSSWEIGHT'];
 sheet.addRow(columns);
 const record=(slip,item,qty,amount,recipient)=>({
  PACKINGSLIPID:slip,ITEMNUMBER:item,QTY:qty,COMMODITYCODE:'39269097',
  SHIPPEDAMOUNT:amount,LINEAMOUNT:amount,SALESORDERLINESTATUS:'invoiced',
  DELIVERYADDRESSNAME:recipient,FORMATTEDDELVERYADDRESS:'Private address, '+recipient,
  DELIVERYADDRESSCOUNTRYREGIONISOCODE:'GB',ORIGCOUNTRYREGIONID:'DEU',
  PRODUCTDESCRIPTION:'Synthetic component',SHIPPEDQTYNETWEIGHT:0.5,
  SHIPPEDQTYGROSSWEIGHT:0.6
 });
 for(const entry of [
  record('SLIP-A','ART-100',3,30,'Synthetic Customer A'),
  record('SLIP-B','ART-200',2,12,'Synthetic Customer B')
 ])sheet.addRow(columns.map(k=>entry[k]??''));
 return Buffer.from(await wb.xlsx.writeBuffer());
}

test('RC1962: real compressed D365 XLSX stays on client; only positions enter Proforma',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='laptop','Chromium laptop only');
 test.setTimeout(90_000);
 const outboundFiles=[];
 page.on('request',request=>{
  if(request.method()!=='POST')return;
  if(!request.url().includes('/api/abd-analysis'))return;
  const data=request.postData()||'';
  if(/"action"\s*:\s*"upload"/.test(data)||/"base64"\s*:/.test(data))outboundFiles.push(request.url());
 });
 await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
 await waitReady(page);
 await openExportHubView(page,'abd',['ABD erstellen','ABD'],/ABD-Anfrage|Grunddaten|ABD/i,{allowProgrammaticFallback:true});
 const nav=page.locator('#nav > [data-exporthub-documents-nav]');
 await expect(nav).toBeVisible({timeout:10_000});
 await nav.click();
 const workspace=page.locator('#rc1940Documents');
 const editor=workspace.locator('#rc1549AbdManual');
 const local=workspace.locator('#rc1962D365LocalImport');
 await expect(editor).toBeVisible();
 await expect(local).toBeVisible();
 await editor.locator('[data-rc1549-header="invoiceNumber"]').fill('MANUALLY-ENTERED-42');
 await editor.locator('[data-rc1549-header="recipient"]').fill('Manual recipient only');
 await editor.locator('[data-rc1549-header="recipientAddress"]').fill('Manual address only');
 await editor.locator('[data-rc1549-header="shipmentReference"]').fill('MANUAL-REF-7');
 await local.locator('[data-rc1962-file]').setInputFiles({
  name:'synthetic-d365.xlsx',
  mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  buffer:await sampleD365()
 });
 await local.locator('[data-rc1962-start]').click();
 const previews=local.locator('.rc1962-preview');
 await expect(previews).toHaveCount(2,{timeout:15_000});
 await expect(previews.nth(0)).toContainText('SLIP-A');
 await expect(previews.nth(1)).toContainText('SLIP-B');
 await previews.nth(1).locator('[data-rc1962-use]').click();
 await expect(editor.locator('tbody tr')).toHaveCount(1);
 await expect(editor.locator('tbody [data-field="itemNumber"]')).toHaveValue('ART-200');
 await expect(editor.locator('tbody [data-field="quantity"]')).toHaveValue('2');
 await expect(editor.locator('tbody [data-field="value"]')).toHaveValue('12');
 await expect(editor.locator('[data-rc1549-header="invoiceNumber"]')).toHaveValue('MANUALLY-ENTERED-42');
 await expect(editor.locator('[data-rc1549-header="recipient"]')).toHaveValue('Manual recipient only');
 await expect(editor.locator('[data-rc1549-header="recipientAddress"]')).toHaveValue('Manual address only');
 await expect(editor.locator('[data-rc1549-header="shipmentReference"]')).toHaveValue('MANUAL-REF-7');
 expect(outboundFiles).toEqual([]);
});
