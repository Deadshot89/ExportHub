import {test,expect} from '@playwright/test';
import {
  assertNoSourceLeak,
  attachRuntimeGuards,
  assertRuntimeClean
} from '../helpers/exporthub-browser.mjs';

const publicPages=[
  ['/pickup.html','Pickup'],
  ['/customer-avis.html','Lieferavis'],
  ['/location.html','Location']
];

for(const [path,label] of publicPages){
  test(`RC1124 public: ${label} lädt read-only ohne Quellcode-Leak`,async({page},testInfo)=>{
    const runtime=attachRuntimeGuards(page,testInfo);
    await page.goto(path,{waitUntil:'domcontentloaded'});
    await expect(page.locator('body')).toBeVisible();
    await expect.poll(()=>page.locator('body').innerText(),{timeout:10_000}).not.toBe('');
    await assertNoSourceLeak(page);
    await assertRuntimeClean(runtime,testInfo);
  });
}

test('RC1124 public: ungültiger Lieferavis-Token endet kontrolliert',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await page.goto('/customer-avis.html?token=__rc1124_invalid__&environment=testservice&lang=de',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toBeVisible();
  await expect.poll(()=>page.locator('body').innerText(),{timeout:15_000}).toMatch(/ungültig|invalid|abgelaufen|nicht gefunden|nicht verfügbar|nicht freigegeben|Zugriff|Token|Fehler/i);
  await assertNoSourceLeak(page);
  await assertRuntimeClean(runtime,testInfo);
});
