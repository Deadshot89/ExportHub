import {test,expect} from '@playwright/test';

function origin(){
  const raw=process.env.EXPORTHUB_PUBLIC_BASE||process.env.EXPORTHUB_E2E_URL||'http://127.0.0.1:4173';
  return new URL(raw).origin;
}

test.describe('non-destructive production smoke',()=>{
  for(const [path,label] of [
    ['/pickup.html','pickup'],
    ['/customer-avis.html','avis'],
    ['/location.html','location']
  ]){
    test(label+' page starts cleanly',async({page})=>{
      const errors=[];
      page.on('pageerror',e=>errors.push(String(e&&e.message||e)));
      await page.goto(origin()+path,{waitUntil:'domcontentloaded'});
      await expect(page.locator('body')).toBeVisible();
      const body=await page.locator('body').innerText();
      expect(body).not.toMatch(/RC824_SOP_DETAILS|function\s+normalizeActionButtons/i);
      expect(errors).toEqual([]);
    });
  }

  test('avis page without a valid access link stays controlled',async({page})=>{
    await page.goto(origin()+'/customer-avis.html?reference=INVALID',{waitUntil:'domcontentloaded'});
    await expect(page.locator('body')).toContainText(/Link|Avis|Referenz|Fehler|ungültig|nicht gültig/i);
  });
});
