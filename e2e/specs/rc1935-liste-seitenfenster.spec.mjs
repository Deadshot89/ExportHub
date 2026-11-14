import {test,expect} from '@playwright/test';
import {appEntry,waitReady,assertNoHorizontalOverflow,attachRuntimeGuards,assertRuntimeClean} from '../helpers/exporthub-browser.mjs';

// RC1935: in den neuen Designs öffnen Dashboard-Kacheln und Kundenordner ihre Inhalte neben der Liste.
async function start(page,design='polar'){
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await page.evaluate(value=>window.ExportHUBDesignSwitcher.apply(value),design);
  await expect.poll(()=>page.evaluate(()=>window.ExportHUBDesignSwitcher.current())).toBe(design);
}
async function go(page,view){
  await page.evaluate(v=>{if(typeof window.setView==='function')window.setView(v);else document.querySelector('#nav [data-view="'+v+'"]').click()},view);
  await expect(page.locator('body')).toHaveAttribute('data-exporthub-view',view);
}

test('RC1935: Dashboard-Kachel öffnet Seitenfenster, bleibt auf dem Dashboard und führt optional in die Liste',async({page},testInfo)=>{
  test.skip(!['desktop','laptop'].includes(testInfo.project.name),'nur breite Bildschirme');
  const runtime=attachRuntimeGuards(page,testInfo);
  await start(page);
  await go(page,'dashboard');
  const kpi=page.locator('[data-rc1558-kpi="open"]');
  await expect(kpi).toBeVisible();
  const kpiId=await kpi.getAttribute('data-rc1558-kpi');
  await kpi.click();
  const side=page.locator('#rc1935DashSide');
  await expect(side).toBeVisible();
  await expect(side).toHaveAttribute('data-kpi',kpiId);
  await expect(page.locator('body')).toHaveAttribute('data-exporthub-view','dashboard');
  await assertNoHorizontalOverflow(page);
  await page.keyboard.press('Escape');
  await expect(side).toHaveCount(0);
  await kpi.click();
  await expect(side).toBeVisible();
  const route=await kpi.getAttribute('data-rc1558-route');
  await side.locator('[data-rc1935-all]').click();
  await expect(side).toHaveCount(0);
  await expect(page.locator('body')).toHaveAttribute('data-exporthub-view',route);
  await assertRuntimeClean(runtime,testInfo);
});

test('RC1935: Kundenordner zeigt Kundenliste links und wechselt den Kunden über den bestehenden Öffnen-Weg',async({page},testInfo)=>{
  test.skip(!['desktop','laptop'].includes(testInfo.project.name),'nur breite Bildschirme');
  const runtime=attachRuntimeGuards(page,testInfo);
  await start(page);
  await go(page,'customerfolder');
  const list=page.locator('#rc1935CustomerList');
  await expect(list).toBeVisible();
  const items=list.locator('[data-rc1935-customer]');
  expect(await items.count()).toBeGreaterThan(1);
  const target=await items.nth(1).getAttribute('data-rc1935-customer');
  await items.nth(1).click();
  await expect.poll(()=>page.evaluate(()=>document.getElementById('rc405FolderSearch').defaultValue)).toBe(target);
  await expect(list.locator('.rc1935-c-item.is-active')).toHaveAttribute('data-rc1935-customer',target);
  await list.locator('.rc1935-c-filter').fill('zzzz-kein-kunde');
  await expect(list.locator('.rc1935-c-empty')).toBeVisible();
  await assertNoHorizontalOverflow(page);
  // Original-Design: keine Liste, alte Kundensuche sichtbar
  await page.evaluate(()=>window.ExportHUBDesignSwitcher.apply('classic'));
  await expect(list).toHaveCount(0);
  await expect(page.locator('#rc405FolderSearch')).toBeVisible();
  await assertRuntimeClean(runtime,testInfo);
});
