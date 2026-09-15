import {test,expect} from '@playwright/test';
import {
  attachRuntimeGuards,waitReady,openExportHubView,
  assertNoSourceLeak,assertNoHorizontalOverflow,assertRuntimeClean
} from '../helpers/exporthub-browser.mjs';

test('Benachrichtigungen enthalten keine Ghost-Aufgaben mit Fallbacktitel',async({page})=>{
  const runtime=attachRuntimeGuards(page);
  const target=process.env.EXPORTHUB_E2E_URL||'/demo.html';
  await page.goto(target,{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'notifications',['Benachrichtigungen'],'Benachrichtigungen');
  await expect(page.locator('#index236NotificationCenter')).toBeVisible();

  const titles=await page.locator('#index236NotificationCenter article.index236-item h3').allTextContents();
  for(const title of titles)expect(title.trim()).not.toMatch(/^(Aufgabe|Task)$/i);

  const rendered=await page.locator('#index236NotificationCenter article.index236-item').count();
  const metric=page.locator('#index236NotificationCenter .metric').filter({hasText:'Offene Aufgaben'}).locator('strong');
  await expect(metric).toHaveText(String(rendered));

  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  assertRuntimeClean(runtime);
});
