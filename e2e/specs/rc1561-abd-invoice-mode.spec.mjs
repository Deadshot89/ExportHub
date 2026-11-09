import {test,expect} from '@playwright/test';
import {appEntry,waitReady,openExportHubView} from '../helpers/exporthub-browser.mjs';

test('RC1942: ABD bietet nur Manuell, Aus Sendung und Gespeichert; Excel liegt in Dokumente erstellen',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='laptop','Chromium Laptop');
 await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
 await waitReady(page);
 await openExportHubView(page,'abd',['ABD erstellen','ABD'],/ABD-Anfrage|Grunddaten|ABD/i,{allowProgrammaticFallback:true});
 const panel=page.locator('[data-rc1294-abd-analysis="1"]');
 await expect(panel).toBeVisible({timeout:10000});
 await expect(panel.locator('[data-rc1294-mode]')).toHaveCount(3);
 await expect(panel.locator('[data-rc1294-mode="invoice"]')).toHaveCount(0);
 await expect(panel.locator('[data-rc1294-invoice-panel]')).toHaveCount(0);
 await expect(page.locator('#rc1294AbdForm')).toBeVisible();
 await panel.locator('[data-rc1294-mode="saved"]').click();
 await expect(page.locator('#rc1294SavedRequests')).toBeVisible();
 await panel.locator('[data-rc1294-mode="manual"]').click();
 await expect(page.locator('#rc1294AbdForm')).toBeVisible();
 const documentsNav=page.locator('#nav > [data-exporthub-documents-nav]');
 await expect(documentsNav).toBeVisible({timeout:10000});
 await documentsNav.click();
 const workspace=page.locator('#rc1940Documents');
 await expect(workspace).toBeVisible();
 const picker=workspace.locator('[data-rc1940-files]');
 await expect(picker).toBeVisible();
 await picker.setInputFiles({name:'rechnung.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from('PK\\u0003\\u0004test-excel')});
 await expect(workspace.locator('[data-rc1940-selection]')).toContainText('rechnung.xlsx');
 await expect(workspace.locator('[data-rc1940-analyze]')).toBeEnabled();
 await workspace.locator('[data-rc1790-tab="delivery"]').click();
 await expect(workspace.locator('[data-rc1940-selection]')).toContainText('rechnung.xlsx');
 await expect(workspace.locator('[data-rc1940-files]')).toBeVisible();
});

test('RC1942: document Excel picker works even if optional export translation asset fails',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='laptop','Chromium Laptop');
 await page.route('**/assets/i18n/rc1499-exportexperte.js*',route=>route.abort());
 await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
 await waitReady(page);
 await openExportHubView(page,'abd',['ABD erstellen','ABD'],/ABD-Anfrage|Grunddaten|ABD/i,{allowProgrammaticFallback:true});
 await expect(page.locator('[data-rc1294-mode="invoice"]')).toHaveCount(0);
 await page.locator('#nav > [data-exporthub-documents-nav]').click();
 const picker=page.locator('#rc1940Documents [data-rc1940-files]');
 await expect(picker).toBeVisible({timeout:10000});
 await expect(picker).toHaveAttribute('accept',/\\.xlsx/);
 await picker.setInputFiles({name:'D365.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from('PK\\u0003\\u0004fixture')});
 await expect(page.locator('#rc1940Documents [data-rc1940-selection]')).toContainText('D365.xlsx');
});