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
