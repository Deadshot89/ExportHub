import {test,expect} from '@playwright/test';
import {appEntry,waitReady,openExportHubView} from '../helpers/exporthub-browser.mjs';

// RC1561: choosing invoice files re-renders the ABD view (#rc626Abd). Before the fix the analysis
// panel came back in "Manuell" mode, the start button was hidden and the chosen files were lost.
test('RC1561: Rechnungsanalyse behält Modus und Dateien, wenn die ABD-Ansicht neu zeichnet',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','ABD-Rechnungsanalyse wird einmal im echten Chromium geprüft.');
  test.setTimeout(60_000);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'abd',['ABD erstellen','ABD'],/ABD-Anfrage|Grunddaten|ABD/i,{allowProgrammaticFallback:true});

  const panel=page.locator('[data-rc1294-abd-analysis="1"]');
  await expect(panel).toBeVisible({timeout:10_000});
  await panel.locator('[data-rc1294-mode="invoice"]').click();
  await expect(panel.locator('[data-rc1294-invoice-panel]')).toBeVisible();

  await panel.locator('[data-rc1294-files]').setInputFiles([
    {name:'rechnung-a.csv',mimeType:'text/csv',buffer:Buffer.from('Position;HS;Origin;Value\n10;39269097;CN;100')},
    {name:'rechnung-b.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%E2E')}
  ]);
  await page.waitForTimeout(800);

  await expect(panel.locator('[data-rc1294-mode="invoice"]')).toHaveAttribute('aria-pressed','true');
  await expect(panel.locator('[data-rc1294-mode="manual"]')).toHaveAttribute('aria-pressed','false');
  await expect(panel.locator('[data-rc1294-invoice-panel]')).toBeVisible();
  await expect(panel.locator('[data-rc1294-start]')).toBeVisible();

  // start must use the files chosen before the re-render instead of asking for files again
  await panel.locator('[data-rc1294-start]').click();
  await expect(panel.locator('[data-rc1294-status]')).toContainText('rechnung-a.csv',{timeout:10_000});
  await expect(panel.locator('[data-rc1294-status]')).toContainText('rechnung-b.pdf');
});
