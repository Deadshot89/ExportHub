import {test,expect} from '@playwright/test';
import {
  assertNoHorizontalOverflow,
  attachRuntimeGuards,
  assertRuntimeClean
} from '../helpers/exporthub-browser.mjs';

const LANGS=['de','en','pl','es','fr','it'];

async function installAvisFallback(page){
  await page.route('**/api/customer-avis**',async route=>{
    await route.fulfill({
      status:404,
      contentType:'application/json',
      body:JSON.stringify({code:'INVALID_TOKEN',error:'INVALID_TOKEN'})
    });
  });
}

for(const lang of LANGS){
  test(`RC1511 customer AVIS renders ${lang} in the real browser`,async({page},testInfo)=>{
    const runtime=attachRuntimeGuards(page,testInfo);
    await installAvisFallback(page);
    await page.goto(`/customer-avis.html?token=__rc1511_invalid__&environment=testservice&lang=${lang}`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ExportHUBI18n&&typeof window.ExportHUBI18n.language==='function'&&typeof window.ExportHUBI18n.t==='function');
    await expect.poll(()=>page.evaluate(()=>window.ExportHUBI18n.language())).toBe(lang);
    await expect(page.locator('html')).toHaveAttribute('lang',lang);
    const expectedTitle=await page.evaluate(()=>window.ExportHUBI18n.t('avis.title'));
    expect(expectedTitle).not.toBe('avis.title');
    await expect(page.locator('.brand h1')).toHaveText(expectedTitle);
    await expect(page.locator('body')).not.toContainText('avis.title');
    await assertNoHorizontalOverflow(page);
    await assertRuntimeClean(runtime,testInfo);
  });
}

const DOC_SNAPSHOT={
 ok:true,session:'avis-test-session',sessionExpiresAt:'2026-12-01T12:00:00Z',
 reference:'ABC123',status:'Erstellt',customerName:'Synthetic Customer',country:'DE',
 sender:{name:'Synthetic Warehouse',address:'Test address'},recipientAddress:'Test destination',
 totals:{count:1,weight:100,ldm:0.2},rows:[],
 documents:[{id:'dnc-1',name:'DNC000123456.pdf',category:'Lieferschein',size:184320,
   downloadUrl:'/api/customer-avis?action=document&id=dnc-1'}],
 customerUploads:[],pod:{available:false,status:'Pending',documents:[]},
 appointment:{},slotAvailability:[],avis:{},lastUpdatedAt:'2026-11-12T09:00:00Z'
};
async function installAvisDocumentFixture(page){
 await page.route('**/api/customer-avis**',async route=>{
  const request=route.request(),url=new URL(request.url());
  const data=request.method()==='GET'&&url.searchParams.get('action')==='delivery-quantities'?
   {ok:true,status:'parsed',checked:1,unavailable:0,limited:false,
    sources:[{document:'DNC000123456.pdf',documentReference:'DNC000123456',
     positions:[{article:'ITEM0001',description:'Synthetic part',quantity:25,unit:'EA'}]}]}:
    DOC_SNAPSHOT;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
}
for(const lang of LANGS){
 test(`RC2026 customer AVIS document types, downloads and quantities render in ${lang}`,async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await installAvisDocumentFixture(page);
  await page.goto('/customer-avis.html?token='+('R'.repeat(32))+'&environment=testservice&lang='+lang,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.ExportHUBI18n&&window.ExportHUBI18n.t('avisPortal.uploadOptDelivery')!=='avisPortal.uploadOptDelivery');
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await page.locator('#accessForm input[name="reference"]').fill('ABC123');
  await page.locator('#accessForm button[type="submit"]').click();
  await expect(page.locator('#customerPdfDocumentType')).toBeVisible();
  const expected=await page.evaluate(()=>({
   title:window.ExportHUBI18n.t('avisPortal.documentsHeading'),
   invoice:window.ExportHUBI18n.t('avisPortal.uploadOptInvoice'),
   delivery:window.ExportHUBI18n.t('avisPortal.uploadOptDelivery'),
   download:window.ExportHUBI18n.t('avisPortal.downloadDocument')
  }));
  await expect(page.locator('h2[data-i18n="avisPortal.documentsHeading"]')).toHaveText(expected.title);
  await expect(page.locator('#customerPdfDocumentType option[value="delivery_note"]')).toHaveText(expected.delivery);
  await expect(page.locator('#customerPdfDocumentType option[value="invoice"]')).toHaveText(expected.invoice);
  await expect(page.locator('.doc strong[data-i18n="avisPortal.downloadDocument"]')).toHaveText(expected.download);
  await expect(page.locator('#avisQuantitiesResult')).toContainText('ITEM0001');
  await expect(page.locator('#avisQuantitiesResult')).toContainText('25');
  await assertNoHorizontalOverflow(page);
  await assertRuntimeClean(runtime,testInfo);
 });
}
test('RC2026 AVIS select and document headings update after in-place language switch',async({page},testInfo)=>{
 const runtime=attachRuntimeGuards(page,testInfo);
 await installAvisDocumentFixture(page);
 await page.goto('/customer-avis.html?token='+('R'.repeat(32))+'&environment=testservice&lang=de',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.ExportHUBI18n&&window.ExportHUBI18n.t('avisPortal.uploadOptInvoice')!=='avisPortal.uploadOptInvoice');
 await page.locator('#accessForm input[name="reference"]').fill('ABC123');
 await page.locator('#accessForm button[type="submit"]').click();
 await expect(page.locator('#customerPdfDocumentType')).toBeVisible();
 await page.evaluate(()=>window.ExportHUBI18n.setLanguage('en',{persist:false}));
 await expect(page.locator('#customerPdfDocumentType option[value="invoice"]')).toHaveText('Invoice / commercial invoice');
 await expect(page.locator('h2[data-i18n="avisPortal.documentsHeading"]')).toHaveText('Documents & attachments');
 await expect(page.locator('.doc small[data-avis-category]')).toContainText('Delivery note');
 await assertRuntimeClean(runtime,testInfo);
});
