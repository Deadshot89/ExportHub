import {test,expect} from '@playwright/test';
import {appEntry,waitReady,openExportHubView,assertNoHorizontalOverflow} from '../helpers/exporthub-browser.mjs';

async function openSop(page,number='SOP-EH-060'){
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'sop',['SOP & Portale','SOP','SOP-Handbuch'],/SOP|Portale/i);
  const open=page.locator(`[data-sop-open="${number}"]`).first();
  await expect(open).toBeVisible();
  await open.click();
  await expect(page.locator(`.rc1007-sop-document[data-sop-number="${number}"]`)).toBeVisible();
}

for(const viewport of ['desktop','mobile-standard']){
  test(`RC1544: alle SOPs verwenden den geführten Workspace (${viewport})`,async({page},testInfo)=>{
    test.skip(testInfo.project.name!==viewport,`nur ${viewport}`);
    await openSop(page);

    const guided=page.locator('[data-rc1544-guided]').first();
    await expect(guided).toBeVisible();
    await expect(guided.locator('.rc1544-sop-steps')).toBeVisible();
    await expect(guided.locator('.rc1544-sop-main')).toBeVisible();
    await expect(guided.locator('.rc1544-sop-context')).toBeVisible();
    await expect(guided.locator('.rc1544-sop-footer')).toBeVisible();
    await expect(guided.locator('[data-sop-guided-catalog-toggle]')).toBeVisible();

    const visibleSteps=guided.locator('.rc1007-sop-steps > li:visible');
    await expect(visibleSteps).toHaveCount(1);
    await expect(guided.locator('[data-sop-guided-step][aria-current="step"]')).toHaveCount(1);

    const imageOrPlaceholder=guided.locator('.rc1007-sop-visual img,.rc1544-sop-media-placeholder').first();
    await expect(imageOrPlaceholder).toBeVisible();

    await assertNoHorizontalOverflow(page);
  });
}


for(const viewport of ['desktop','mobile-standard']){
  test('RC1705: Standard-SOP vor Kundenauswahl aufrufbar ('+viewport+')',async({page},testInfo)=>{
    test.skip(testInfo.project.name!==viewport,'nur '+viewport);
    await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
    await waitReady(page);
    await openExportHubView(page,'shipment',['Sendung erstellen'],/Sendung erstellen|Versandauftrag/i,{allowProgrammaticFallback:true});
    const button=page.locator('#rc1705-sop-shipment [data-rc1705-open="SOP-EH-031"]');
    await expect(button).toBeVisible();
    await button.click();
    const panel=page.locator('#rc1705-sop-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.rc1705-guide h3')).toContainText(/Sendung/i);
    await expect(panel.locator('.rc1705-step')).toBeVisible();
    await panel.locator('[data-rc1705-close]').click();
    await expect(panel).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
  });
}
