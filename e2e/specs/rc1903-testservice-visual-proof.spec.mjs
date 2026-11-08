import {test,expect} from '@playwright/test';

const SERVICE='https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';
const DOC='DOK-20261108-AABBCCDD';
const TOKEN='T'.repeat(43);
const moment='2026-11-08T10:00:00.000Z';

async function openPublished(page){
 // The only network reachability is the public static TESTSERVICE web application.
 const response=await page.goto(SERVICE+'/sendungsdokumentation?rc1903-visual-proof=1',{
  waitUntil:'domcontentloaded'
 });
 expect(response?.status(),'Actual public TESTSERVICE page must respond 200').toBe(200);
 expect(new URL(page.url()).hostname).toBe('ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net');
 await expect(page.locator('#eh1903-guest-root')).toBeVisible();
 await expect(page.locator('script[src*="shipment-evidence-guest.js?v=1905"]')).toHaveCount(1);
 await expect(page.locator('link[href*="shipment-evidence.css?v=1906-gallery"]')).toHaveCount(1);
 await expect(page.locator('#login')).toHaveCount(0);
}
async function protectEveryApi(page,respond){
 const calls=[];
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  const payload=req.method()==='POST'?req.postDataJSON()||{}:{};
  const action=payload.action||url.searchParams.get('action')||'';
  const authorized=req.headers()['x-exporthub-evidence-token']===TOKEN;
  calls.push({action,method:req.method(),authorized,url:url.pathname});
  if(url.origin!==SERVICE||url.pathname!=='/api/shipment-evidence'){
   await route.fulfill({status:503,contentType:'application/json',
    body:JSON.stringify({ok:false,code:'MOCK_API_ONLY'})});
   throw new Error('Unexpected API requested in visual proof: '+url.pathname);
  }
  await respond(route,{action,payload,url,authorized});
 });
 return calls;
}
function syntheticPhotoBase64(page){
 return page.evaluate(()=>{
  const canvas=document.createElement('canvas');
  canvas.width=192;canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#dce7f2';ctx.fillRect(0,0,192,128);
  ctx.fillStyle='#466a83';ctx.fillRect(16,36,158,69);
  ctx.fillStyle='#ddad63';ctx.fillRect(50,48,88,45);
  ctx.fillStyle='#f6f7f9';ctx.fillRect(60,48,8,45);
  ctx.fillStyle='#162d45';ctx.font='bold 14px Arial';
  ctx.fillText('TESTFOTO',47,22);
  return canvas.toDataURL('image/png').split(',')[1];
 });
}
test('RC1903 published TESTSERVICE: actual customer selector and visible downloadable photo gallery',async({page,context},testInfo)=>{
 let record=null,photoBytes=Buffer.alloc(0);
 const calls=await protectEveryApi(page,async(route,{action,payload,authorized,url})=>{
  const send=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(action==='public-customer-lookup'){
   expect(payload.customerNumber).toBe('D1001');
   return send(200,{ok:true,customer:{id:'DEMO-1001',number:'D1001',name:'TESTKUNDE – KEINE ECHTEN DATEN'}});
  }
  if(action==='public-create'){
   record={id:DOC,revision:1,fields:payload.fields,files:[],
    createdAt:moment,updatedAt:moment,submittedAt:null};
   return send(201,{ok:true,record,publicToken:TOKEN});
  }
  if(action==='public-upload'&&authorized&&record&&!record.submittedAt){
   const photo=payload.kind==='foto';
   const entry={id:String(record.files.length+1),
    name:photo?'TESTFOTO.png':'TEST-Lieferschein.pdf',kind:payload.kind,
    mime:photo?'image/png':'application/pdf',size:photo?photoBytes.length:16,
    uploadedAt:moment};
   record={...record,revision:record.revision+1,files:[...record.files,entry]};
   return send(200,{ok:true,record});
  }
  if(action==='public-file'){
   if(!authorized)return send(403,{ok:false,code:'FORBIDDEN'});
   const entry=record?.files.find(item=>item.id===url.searchParams.get('fileId'));
   if(!entry)return send(404,{ok:false,code:'FILE_NOT_FOUND'});
   return route.fulfill({status:200,contentType:entry.mime,body:entry.kind==='foto'?
    photoBytes:Buffer.from('%PDF-1.7\n1 0 obj\nendobj\n')});
  }
  if(action==='public-submit'&&authorized){
   record={...record,revision:record.revision+1,submittedAt:moment};
   return send(200,{ok:true,record});
  }
  if(action==='public-get'&&authorized)return send(200,{ok:true,record});
  return send(403,{ok:false,code:'PUBLIC_READ_ONLY',message:'Only mock API calls permitted.'});
 });
 await openPublished(page);
 photoBytes=Buffer.from(await syntheticPhotoBase64(page),'base64');
 for(const removed of ['packaging','shippingMethod','loadSecuring','contents']){
  await expect(page.locator('[data-guest-field="'+removed+'"]')).toHaveCount(0);
 }
 await page.locator('[data-guest-customer-lookup]').fill('D1001');
 await page.getByRole('button',{name:'Kunde suchen'}).click();
 await expect(page.locator('#eh1903-guest-root')).toContainText('D1001 · TESTKUNDE');
 await page.locator('[data-guest-field="shipmentNumber"]').fill('VISUAL-TEST-ONLY');
 await page.getByRole('button',{name:'Weiter zu Fotos und Lieferscheinen'}).click();
 expect(record.fields.customerMode).toBe('existing');
 expect(record.fields.customerNumber).toBe('D1001');
 const inputs=page.locator('.eh1903-uploads input[type=file]');
 await expect(inputs).toHaveCount(2);
 await inputs.first().setInputFiles({
  name:'TESTFOTO.png',mimeType:'image/png',buffer:photoBytes
 });
 const cards=page.locator('.eh1903-photo-card');
 await expect(cards).toHaveCount(1);
 const image=cards.locator('img');
 await expect(image).toHaveAttribute('src',/^blob:/);
 await expect.poll(()=>image.evaluate(el=>el.naturalWidth)).toBe(192);
 const frame=cards.locator('.eh1903-photo-frame');
 const height=await frame.evaluate(el=>Math.round(el.getBoundingClientRect().height));
 expect(height).toBe(testInfo.project.name==='mobile-small'?112:126);
 const box=await frame.boundingBox();
 expect(box?.width).toBeGreaterThan(100);
 expect(box?.width).toBeLessThanOrEqual(200);
 await page.screenshot({path:testInfo.outputPath('rc1903-testservice-inline-gallery.png')});
 await cards.locator('[data-evidence-photo-open]').click();
 const dialog=page.locator('[data-evidence-photo-dialog]');
 await expect(dialog).toBeVisible();
 await expect.poll(()=>dialog.locator('img').evaluate(el=>el.naturalWidth)).toBe(192);
 expect(context.pages()).toHaveLength(1);
 await page.screenshot({path:testInfo.outputPath('rc1903-testservice-photo-open.png')});
 const downloading=page.waitForEvent('download');
 await dialog.getByRole('button',{name:'Datei herunterladen'}).click();
 const saved=await downloading;
 expect(saved.suggestedFilename()).toBe('TESTFOTO.png');
 await dialog.getByRole('button',{name:'Schließen'}).click();
 await expect(dialog).toHaveCount(0);
 await inputs.nth(1).setInputFiles({
  name:'TEST-Lieferschein.pdf',mimeType:'application/pdf',
  buffer:Buffer.from('%PDF-1.7\n1 0 obj\nendobj\n')
 });
 await expect(page.locator('.eh1903-photo-card')).toHaveCount(1);
 await expect(page.locator('.eh1903-file')).toHaveCount(1);
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Dokumentation abschließen'}).click();
 await expect(page.locator('.eh1903-uploads input[type=file]')).toHaveCount(0);
 expect(calls.some(item=>item.action==='public-file'&&!item.authorized)).toBe(false);
 expect(calls.filter(item=>item.action==='public-file'&&item.authorized).length).toBeGreaterThanOrEqual(2);
 expect(calls.some(item=>item.url!=='/api/shipment-evidence')).toBe(false);
});

test('RC1903 published TESTSERVICE: pending new customer form does not write to Azure API',async({page})=>{
 let submitted=null;
 const calls=await protectEveryApi(page,async(route,{action,payload})=>{
  if(action!=='public-create'){
   return route.fulfill({status:403,contentType:'application/json',
    body:JSON.stringify({ok:false,code:'MOCK_ONLY'})});
  }
  submitted=payload;
  const record={id:DOC,revision:1,fields:payload.fields,
   files:[],createdAt:moment,updatedAt:moment,submittedAt:null};
  await route.fulfill({status:201,contentType:'application/json',
   body:JSON.stringify({ok:true,record,publicToken:TOKEN})});
 });
 await openPublished(page);
 await page.getByRole('button',{name:'Neuen Kunden anlegen'}).click();
 await expect(page.locator('[data-guest-customer-number]')).toBeVisible();
 await page.locator('[data-guest-customer-number]').fill('N12345');
 await page.locator('[data-guest-customer-name]').fill('NUR TEST – Kein echter Kunde');
 await page.locator('[data-guest-field="shipmentNumber"]').fill('NEU-TEST-ONLY');
 await page.getByRole('button',{name:'Weiter zu Fotos und Lieferscheinen'}).click();
 await expect(page.getByText(DOC)).toBeVisible();
 expect(submitted?.fields?.customerMode).toBe('pending');
 expect(submitted?.fields?.customerNumber).toBe('N12345');
 expect(submitted?.fields?.customer).toBe('NUR TEST – Kein echter Kunde');
 expect(calls.filter(item=>item.method==='POST')).toHaveLength(1);
 expect(calls[0]?.action).toBe('public-create');
});
