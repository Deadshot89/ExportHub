import {test,expect} from '@playwright/test';
import {appEntry,waitReady} from '../helpers/exporthub-browser.mjs';

// RC1564: the language chosen in the top bar must stick – across navigation and a reload –
// for all six languages, without flipping back to German.
const language=page=>page.evaluate(()=>window.ExportHUBI18n.language());

test('RC1564: Sprachwahl bleibt beim Navigieren und nach dem Neuladen erhalten',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Sprachwechsel wird einmal im echten Chromium geprüft.');
  test.setTimeout(90_000);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);

  for(const lang of ['en','pl','fr']){
    await page.selectOption('#languageSelect',lang);
    await expect.poll(()=>language(page),{timeout:10_000}).toBe(lang);
    const flips=await page.evaluate(async lang=>{
      const seen=[];const h=document.documentElement;const mo=new MutationObserver(()=>seen.push(h.lang));mo.observe(h,{attributes:true,attributeFilter:['lang']});
      window.setView('tasks');await new Promise(r=>setTimeout(r,1200));window.setView('dashboard');await new Promise(r=>setTimeout(r,1200));
      mo.disconnect();return seen.filter(x=>x!==lang);
    },lang);
    expect(flips,'Sprache darf beim Navigieren nicht zurückspringen').toEqual([]);
    expect(await language(page)).toBe(lang);
  }

  await page.reload({waitUntil:'domcontentloaded'});
  await waitReady(page);
  await expect.poll(()=>language(page),{timeout:10_000}).toBe('fr');

  await page.selectOption('#languageSelect','de');
  await expect.poll(()=>language(page),{timeout:10_000}).toBe('de');
});
