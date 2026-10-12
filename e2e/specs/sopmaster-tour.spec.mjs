import {test,expect} from '@playwright/test';
import {appEntry,waitReady,openExportHubView,assertNoHorizontalOverflow} from '../helpers/exporthub-browser.mjs';

async function openAbdSop(page){
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'sop',['SOP & Portale','SOP','SOP-Handbuch'],/SOP|Portale/i);
  const open=page.locator('[data-sop-open="SOP-EH-060"]').first();
  await expect(open).toBeVisible();
  await open.click();
  await expect(page.locator('.rc1007-sop-document[data-sop-number="SOP-EH-060"]')).toBeVisible();
  await expect(page.locator('[data-sop-tour-start="SOP-EH-060"]')).toBeVisible();
}

async function openShipment(page){
  await openExportHubView(page,'shipment',['Sendung erstellen','Neue Sendung','Sendung anlegen'],/Kunde|Empfänger/i);
  await expect(page.locator('#rc363BlockDocuments')).toBeVisible();
  await expect(page.locator('#rc363BlockAbdDecision')).toBeVisible();
}

for(const viewport of ['desktop','mobile-standard']){
  test(`RC1501: geführte ABD-Tour reagiert nur auf korrekte Benutzeraktionen (${viewport})`,async({page},testInfo)=>{
    test.skip(testInfo.project.name!==viewport,`nur ${viewport}`);
    await openAbdSop(page);

    await page.locator('[data-sop-tour-start="SOP-EH-060"]').click();
    const panel=page.locator('.rc1501-sop-tour-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(/Schritt\s+1\s+von\s+1/i);
    await expect(panel.locator('progress')).toHaveAttribute('value','0');

    await openShipment(page);
    await expect(page.locator('#rc363BlockAbdDecision')).toHaveAttribute('data-tour-key','shipment-abd-decision');
    await expect(page.locator('#rc363BlockAbdDecision')).toHaveClass(/rc1501-sop-tour-target/);

    await page.locator('#rc363BlockDocuments').click({position:{x:8,y:8}});
    const afterWrong=await page.evaluate(()=>window.ExportHubSopTour?.current?.());
    expect(afterWrong.status).toBe('active');
    expect(afterWrong.percent).toBe(0);
    expect(afterWrong.wrongActions).toBeGreaterThanOrEqual(1);

    await panel.locator('[data-sop-tour-pause]').click();
    await expect(panel.locator('[role="status"]')).toContainText(/pausiert/i);
    const paused=await page.evaluate(()=>window.ExportHubSopTour?.current?.());
    expect(paused.status).toBe('paused');

    await panel.locator('[data-sop-tour-pause]').click();
    const resumed=await page.evaluate(()=>window.ExportHubSopTour?.current?.());
    expect(resumed.status).toBe('active');

    await page.locator('#rc363BlockAbdDecision').click({position:{x:8,y:8}});
    await expect(panel).toContainText(/Anleitung abgeschlossen/i);
    const completed=await page.evaluate(()=>window.ExportHubSopTour?.current?.());
    expect(completed.status).toBe('completed');
    expect(completed.percent).toBe(100);
    expect(completed.completedStepIds).toHaveLength(1);

    await assertNoHorizontalOverflow(page);
  });
}
