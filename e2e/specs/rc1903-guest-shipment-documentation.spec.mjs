import {test,expect} from '@playwright/test';

// RC1903: public landing page. API intercepted; no live customer data or cloud writes.
test('RC1903 public link creates, uploads and submits read-only records without login UI',async({page,context},testInfo)=>{
 test.skip(process.env.EXPORTHUB_E2E_LIVE==='1','This mocked test must not modify Azure data.');
 test.skip(!['laptop','mobile-small'].includes(testInfo.project.name),'Desktop and mobile test only.');
 const id='DOK-20261107-ABCDEF12',token='T'.repeat(43),requests=[];
 let record=null;
 await page.route('**/api/shipment-evidence*',async route=>{
  const req=route.request(),method=req.method();
  let payload={};
  if(method==='POST')try{payload=req.postDataJSON()||{}}catch(_){}
  const action=payload.action||new URL(req.url()).searchParams.get('action')||'list';
  requests.push({method,action,hasToken:req.headers()['x-exporthub-evidence-token']===token});
  let status=200,result={ok:true,record};
  if(action==='public-create'){
   record={id,revision:1,fields:payload.fields,files:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),submittedAt:null};
   result={ok:true,record,publicToken:token};status=201;
  }else if(action==='public-upload'&&!record.submittedAt){
   const kind=payload.kind,name=(kind==='foto'?'Versandfoto_':'Lieferschein_')+id+'_'+record.files.length+'.'+(kind==='foto'?'jpg':'pdf');
   record={...record,revision:record.revision+1,files:[...record.files,{id:String(record.files.length+1),name,kind,mime:kind==='foto'?'image/jpeg':'application/pdf',size:16,uploadedAt:new Date().toISOString()}]};
   result={ok:true,record};
  }else if(action==='public-submit'){
   record={...record,submittedAt:new Date().toISOString(),revision:record.revision+1};
   result={ok:true,record};
  }else if(action==='public-get'&&req.headers()['x-exporthub-evidence-token']===token){
   result={ok:true,record};
  }else{status=403;result={ok:false,code:'PUBLIC_READ_ONLY',message:'Nur auf der Website bearbeiten.'};}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
 });
 // Static Playwright server uses the real asset path; Azure routes /sendungsdokumentation to this page.
 await page.goto('/assets/sendungsdokumentation.html',{waitUntil:'domcontentloaded'});
 const publicRoot=page.locator('#eh1903-guest-root');
 await expect(publicRoot).toBeVisible();
 await expect(page.getByRole('heading',{name:'Neue Sendung'})).toBeVisible();
 await expect(page.locator('[data-eh1903-guest-open]')).toHaveCount(0);
 await expect(page.locator('#login')).toHaveCount(0);
 await page.locator('[data-guest-field="customer"]').fill('Beispielkunde');
 await page.locator('[data-guest-field="shipmentNumber"]').fill('EXT-2026-123');
 await page.locator('[data-guest-field="dispatchDate"]').fill('2026-11-07');
 await page.locator('[data-guest-field="colli"]').fill('3');
 await page.locator('[data-guest-field="weightKg"]').fill('27.5');
 await page.getByRole('button',{name:'Weiter zu Fotos und Lieferscheinen'}).click();
 await expect(publicRoot).toContainText(id);
 const files=page.locator('.eh1903-uploads input[type="file"]');
 await expect(files).toHaveCount(2);
 await files.nth(0).setInputFiles({name:'Abfahrt.jpg',mimeType:'image/jpeg',buffer:Buffer.from([0xff,0xd8,0xff,0xe0,0x00,0x00])});
 await expect(page.locator('.eh1903-file')).toHaveCount(1);
 await files.nth(1).setInputFiles({name:'Lieferschein.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\n1 0 obj\nendobj\n')});
 await expect(page.locator('.eh1903-file')).toHaveCount(2);
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Dokumentation abschließen'}).click();
 await expect(publicRoot).toContainText('Gespeichert – nur ExportHUB-Mitarbeiter');
 await expect(page.locator('.eh1903-uploads input[type=file]')).toHaveCount(0);
 await expect(page.locator('[data-guest-field="customer"]')).toHaveAttribute('readonly','');
 await page.getByRole('button',{name:'Meine Nachweise'}).click();
 await expect(publicRoot).toContainText(id);
 await page.getByRole('button',{name:'Nur ansehen'}).click();
 await expect(publicRoot).toContainText('Gespeichert – nur ExportHUB-Mitarbeiter');
 expect(requests.filter(r=>r.action==='public-create')).toHaveLength(1);
 expect(requests.filter(r=>r.action==='public-upload'&&r.hasToken)).toHaveLength(2);
 expect(requests.filter(r=>r.action==='public-submit'&&r.hasToken)).toHaveLength(1);
 expect(requests.filter(r=>r.action==='public-get'&&r.hasToken)).toHaveLength(1);
 expect(requests.some(r=>r.action==='public-save')).toBe(false);
 expect(context.pages()).toHaveLength(1);
});
