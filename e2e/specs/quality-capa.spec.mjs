import {test,expect} from '@playwright/test';

test('CAPA: Fehler erfassen, Verbesserungsvorschlag übernehmen und A4-Bericht vorbereiten',async({page},testInfo)=>{
 test.skip(process.env.EXPORTHUB_E2E_LIVE==='1','Mock-Test darf keine Live-Umgebung verändern.');
 test.skip(!['laptop','mobile-small'].includes(testInfo.project.name),'Zwei repräsentative Viewports reichen für diesen isolierten Funktionsvertrag.');
 let saved=[];
 await page.route('**/api/quality-capa',async route=>{
  const data=JSON.parse(route.request().postData()||'{}'),action=data.action;
  let response={ok:true};
  if(action==='list')response={ok:true,items:saved,environment:'testservice',canEdit:true,canClose:true};
  else if(action==='create'){
   const now=new Date().toISOString();
   const item={...data,id:'QM-20261105-ABCD1234',revision:1,createdAt:now,updatedAt:now,createdBy:'QM Testnutzer',status:'offen',history:[{at:now,action:'ANGELEGT',actor:'QM Testnutzer',notes:'Abweichung erfasst'}]};
   saved=[item];response={ok:true,item,environment:'testservice'};
  }else if(action==='advise')response={ok:true,mode:'regelbasiert',suggestions:[{priority:'praevention',title:'Verladefreigabe absichern',detail:'Referenz und Colli-Zahl beim Laden prüfen.'}],relatedCases:[]};
  else if(action==='update'){
   const now=new Date().toISOString();
   saved[0]={...saved[0],...data,revision:saved[0].revision+1,updatedAt:now};
   response={ok:true,item:saved[0],environment:'testservice'};
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
 });
 await page.goto('/qualitaet.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#app')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Fehler & Verbesserungen'})).toBeVisible();
 await page.locator('#title').fill('Palette vor Verladung verwechselt');
 await page.locator('#reference').fill('REF-QM-TEST');
 await page.locator('#description').fill('Palette wurde vor der Beladung falsch zugeordnet.');
 await page.locator('#saveBtn').click();
 await expect(page.locator('#formMeta')).toContainText('QM-20261105-ABCD1234');
 await expect(page.locator('#caseList .case')).toHaveCount(1);
 await page.locator('#tipsBtn').click();
 await expect(page.locator('.tip')).toHaveCount(1);
 await page.getByRole('button',{name:'Als Maßnahme vorschlagen'}).click();
 await expect(page.locator('#correctiveAction')).toHaveValue(/\[Vorschlag – vor Umsetzung prüfen\]/);
 await expect(page.locator('#saveHint')).toContainText('noch nicht gespeichert');
 await page.evaluate(()=>{window.print=()=>{window.__printedContent=document.getElementById('printReport').textContent}});
 await page.locator('#printBtn').click();
 await expect(page.locator('#printReport')).toContainText('Palette vor Verladung verwechselt');
 await expect(page.locator('#printReport')).toContainText('ENTWURF');
 await expect(page.locator('#printReport')).toContainText('REF-QM-TEST');
 await expect(page.locator('#printReport')).toContainText('Änderungsverlauf');
 const printed=await page.evaluate(()=>window.__printedContent);
 expect(printed).toContain('Abweichungsbericht'.toUpperCase());
 await expect(page.locator('html')).toHaveJSProperty('scrollWidth',await page.evaluate(()=>document.documentElement.scrollWidth));
});
