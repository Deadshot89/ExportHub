import {test,expect} from '@playwright/test';

// RC1931: functional shipment-view gallery check using the actual JS bundle.
// All API responses and binary previews are mocked. No Azure/customer writes.
test('RC1931 REF + explicitly linked DOK previews stay in-page and switch shipments safely',async({page,context},testInfo)=>{
 test.skip(process.env.EXPORTHUB_E2E_LIVE==='1','Synthetic browser test only, never live writes.');
 test.skip(!['laptop','mobile-small'].includes(testInfo.project.name),'Desktop and mobile coverage.');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pXcAAAAASUVORK5CYII=','base64');
 const pdf=Buffer.from('%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n');
 const seen=[];
 const fakeRecord=ref=>({revision:1,fields:{reference:ref,customer:'Synthetic Test',shipmentNumber:'TEST-'+ref,dispatchDate:'2026-11-10',colli:'1',weightKg:'1'},complaints:[]});
 const refFile={id:'ref-photo-a',name:'Dokument_ABC123_20261110-120000_Versandfoto_Karton.png',mimeType:'image/png',size:png.length};
 const noteFile={id:'ref-note-a',name:'Lieferschein_ABC123_20261110-120000_Lieferschein.pdf',mimeType:'application/pdf',size:pdf.length};
 const dokFile={id:'evidence-photo-a',name:'Versandfoto_DOK-20261110-ABCDEF12_Karton.png',mime:'image/png',kind:'foto',size:png.length};
 const dokId='DOK-20261110-ABCDEF12';
 await page.route('**/rc1931-gallery-fixture',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"></head><body><main id="shipment-view"><div id="rc786ReferenceFilesCard"></div></main></body></html>'}));
 await page.route('**/api/shipment-documentation*',async route=>{
  const ref=new URL(route.request().url()).searchParams.get('reference');
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,record:fakeRecord(ref)})});
 });
 await page.route('**/api/reference-files*',async route=>{
  const params=new URL(route.request().url()).searchParams,ref=params.get('reference'),fileId=params.get('itemId');
  seen.push({source:'reference',ref,fileId});
  if(fileId){
   const bytes=fileId===refFile.id?png:pdf;
   await route.fulfill({status:200,contentType:fileId===refFile.id?'image/png':'application/pdf',body:bytes});
  }else{
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,files:ref==='ABC123'?[refFile,noteFile]:[]})});
  }
 });
 await page.route('**/api/shipment-evidence*',async route=>{
  const params=new URL(route.request().url()).searchParams,action=params.get('action'),ref=params.get('reference');
  seen.push({source:'evidence',action,ref,id:params.get('id')});
  if(action==='file'){
   if(params.get('id')!==dokId||params.get('fileId')!==dokFile.id){
    await route.fulfill({status:404,contentType:'application/json',body:'{"ok":false}'});
   }else await route.fulfill({status:200,contentType:'image/png',body:png});
  }else{
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,reference:ref,records:ref==='ABC123'?[{id:dokId,files:[dokFile]}]:[]})});
  }
 });
 await page.goto('/rc1931-gallery-fixture');
 await page.evaluate(()=>{
  const state={view:'shipmentView',shipmentViewId:'shipment-a',shipments:[{id:'shipment-a',ref:'ABC123',customerName:'SYNTHETIC A',rows:[]},{id:'shipment-b',ref:'XYZ999',customerName:'SYNTHETIC B',rows:[]}]};
  window.__EXPORTHUB_GET_STATE__=()=>state;
  window.__RC1931_TEST_STATE__=state;
  window.ExportHUBClean={runtime:{authToken:'SYNTHETIC_TOKEN'}};
 });
 await page.addScriptTag({url:'/assets/rc1860-shipment-documentation.js'});
 const gallery=page.locator('[data-proof-files]');
 await expect(page.locator('[data-shipment-documentation="ABC123"]')).toBeVisible();
 await expect(gallery.locator('.eh1860-preview-card')).toHaveCount(3);
 await expect(gallery).toContainText('Versandfoto_DOK-20261110-ABCDEF12');
 const thumbnail=gallery.locator('.eh1860-preview-frame img').first();
 // On a narrow viewport the gallery is below the fold. The image is
 // intentionally lazy-loaded; scroll it into view like a real mobile user.
 await thumbnail.scrollIntoViewIfNeeded();
 await expect(thumbnail).toHaveAttribute('src',/^blob:/);
 await gallery.locator('.eh1860-preview-card').last().locator('.eh1860-preview-open').click();
 const dialog=page.getByRole('dialog');
 await expect(dialog).toBeVisible();
 await expect(dialog.locator('img')).toHaveAttribute('src',/^blob:/);
 await dialog.locator('button').last().click();
 await expect(dialog).toHaveCount(0);
 await gallery.locator('.eh1860-preview-card').nth(1).locator('.eh1860-preview-open').click();
 await expect(page.getByRole('dialog').locator('iframe')).toHaveAttribute('src',/^blob:/);
 await page.getByRole('dialog').locator('button').last().click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(context.pages()).toHaveLength(1);
 // Changing the selected shipment must never reuse previews from the previous REF.
 await page.evaluate(()=>{
  window.__RC1931_TEST_STATE__.shipmentViewId='shipment-b';
  window.dispatchEvent(new Event('exporthub:shipment-saved'));
 });
 await expect(page.locator('[data-shipment-documentation="XYZ999"]')).toBeVisible();
 await expect(page.locator('[data-shipment-documentation="ABC123"]')).toHaveCount(0);
 await expect(page.locator('[data-shipment-documentation="XYZ999"] [data-proof-files] .eh1860-preview-card')).toHaveCount(0);
 expect(seen.some(x=>x.source==='evidence'&&x.action==='for-reference'&&x.ref==='ABC123')).toBe(true);
 expect(seen.some(x=>x.source==='evidence'&&x.action==='file'&&x.id===dokId)).toBe(true);
 expect(seen.some(x=>x.source==='reference'&&x.ref==='XYZ999')).toBe(true);
});
