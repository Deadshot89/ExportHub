import {test,expect} from '@playwright/test';
import {appEntry,waitReady,openExportHubView,assertNoHorizontalOverflow} from '../helpers/exporthub-browser.mjs';

for(const viewport of ['desktop','mobile-standard']){
  test(`RC1506: Coverage-Dashboard ist im gebauten SOP-Admin sichtbar und öffnet SOP direkt (${viewport})`,async({page},testInfo)=>{
    test.skip(testInfo.project.name!==viewport,`nur ${viewport}`);
    await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
    await waitReady(page);
    await openExportHubView(page,'sop',['SOP & Portale','SOP','SOP-Handbuch'],/SOP|Portale/i);

    await expect.poll(()=>page.evaluate(()=>({
      registry:!!window.ExportHubSopFunctionRegistry,
      coverage:!!window.ExportHubSopCoverage,
      dashboard:!!window.ExportHubSopCoverageDashboard,
      runtime:!!window.ExportHubSopCoverageRuntime
    })),{timeout:10_000}).toEqual({registry:true,coverage:true,dashboard:true,runtime:true});

    const admin=page.locator('#exporthub-rc1506-sop-coverage-panel');
    await expect(admin).toBeVisible();
    const dashboard=admin.locator('[data-sop-coverage-dashboard]');
    await expect(dashboard).toBeVisible();
    await expect(dashboard.locator('[data-kpi="coverage"]')).toContainText('Abdeckungsquote');
    await expect(dashboard.locator('[data-kpi="red"]')).toContainText('SOP fehlt');
    await expect(dashboard.locator('[data-kpi="yellow"]')).toContainText('SOP unvollständig');
    await expect(dashboard.locator('[data-kpi="green"]')).toContainText('SOP vollständig');
    await expect(dashboard.locator('[data-kpi="tour"]')).toContainText('Tour vorhanden');
    await expect(dashboard.locator('[data-kpi="image"]')).toContainText('Bildanleitung vorhanden');

    const abdRow=dashboard.locator('tr[data-coverage-row-id="shipment.abd-decision"]');
    await expect(abdRow).toBeVisible();
    await abdRow.locator('[data-coverage-nav="sop"]').click();
    await expect(page.locator('.rc1007-sop-document[data-sop-number="SOP-EH-060"]')).toBeVisible();

    await assertNoHorizontalOverflow(page);
  });
}
