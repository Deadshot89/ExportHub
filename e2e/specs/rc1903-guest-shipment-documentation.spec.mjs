import {test,expect} from '@playwright/test';

// RC1903: Browser-Vertrag ohne echte Versanddaten oder Live-Schreibzugriffe.
test('RC1903 Gast legt Sendungsdokumentation inline an und laedt Nachweise hoch',async({page,context},testInfo)=>{
 test.skip(process.env.EXPORTHUB_E2E_LIVE==='1','Gemockter Browsertest darf keine Live-Umgebung veraendern.');
 test.skip(!['laptop','mobile-small'].includes(testInfo.project.name),'Desktop und kleines Smartphone pruefen.');
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
   record={id,revision:1,fields:payload.fields,files:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
   result={ok:true,record,publicToken:token};status=201;
  }else if(action==='public-save'){
   record={...record,revision:record.revision+1,fields:payload.fields};
   result={ok:true,record};
  }else if(action==='public-upload'){
   const kind=payload.kind,name=(kind==='foto'?'Versandfoto_':'Lieferschein_')+id+'_'+record.files.length+'.'+(kind==='foto'?'jpg':'pdf');
   record={...record,revision:record.revision+1,files:[...record.files,{id:String(record.files.length+1),name,kind,mime:kind==='foto'?'image/jpeg':'application/pdf',size:16,uploadedAt:new Date().toISOString()}]};
   result={ok:true,record};
  }else{status=401;result={ok:false,code:'SESSION_INVALID',message:'Bitte anmelden'};}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.goto('/?sendungsdokumentation=neu',{waitUntil:'domcontentloaded'});
 const overlay=page.locator('#eh1903-guest-overlay');
 await expect(overlay).toBeVisible();
 await expect(page.getByRole('heading',{name:'Neue Sendung dokumentieren'})).toBeVisible();
 await page.locator('[data-guest-field="customer"]').fill('Beispielkunde');
 await page.locator('[data-guest-field="shipmentNumber"]').fill('EXT-2026-123');
 await page.locator('[data-guest-field="dispatchDate"]').fill('2026-11-07');
 await page.locator('[data-guest-field="colli"]').fill('3');
 await page.locator('[data-guest-field="weightKg"]').fill('27.5');
 await page.locator('[data-guest-save]').click();
 await expect(page.locator('[data-guest-summary]')).toContainText(id);
 const files=page.locator('[data-guest-files] input[type="file"]');
 await expect(files).toHaveCount(2);
 await files.nth(0).setInputFiles({name:'Abfahrt.jpg',mimeType:'image/jpeg',buffer:Buffer.from([0xff,0xd8,0xff,0xe0,0x00,0x00])});
 await expect(page.locator('[data-guest-files] .eh1903-file')).toHaveCount(1);
 await files.nth(1).setInputFiles({name:'Lieferschein.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\n1 0 obj\nendobj\n')});
 await expect(page.locator('[data-guest-files] .eh1903-file')).toHaveCount(2);
 expect(requests.filter(r=>r.action==='public-create')).toHaveLength(1);
 expect(requests.filter(r=>r.action==='public-upload'&&r.hasToken)).toHaveLength(2);
 expect(context.pages()).toHaveLength(1);
 await page.locator('#eh1903-guest-overlay .eh1903-guest-top button').click();
 await expect(overlay).toHaveCount(0);
});
