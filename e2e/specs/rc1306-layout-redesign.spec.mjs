import {test,expect} from '@playwright/test';
import {
  appEntry, waitReady, openExportHubView, assertNoHorizontalOverflow,
  assertNoSourceLeak, attachRuntimeGuards, assertRuntimeClean
} from '../helpers/exporthub-browser.mjs';

async function openShipment(page){
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'shipment',['Sendung erstellen','Neue Sendung','Sendung anlegen'],/Kunde|Empfänger/i);
  await expect(page.locator('#rc363BlockCustomer')).toBeVisible();
  await expect(page.locator('#rc363BlockShipment')).toBeVisible();
}

async function setDesign(page,design){
  await page.evaluate(value=>{
    if(!window.ExportHUBDesignSwitcher)throw new Error('ExportHUBDesignSwitcher missing');
    window.ExportHUBDesignSwitcher.apply(value);
  },design);
  await expect(page.locator('html')).toHaveAttribute('data-eh-design',design);
}

async function commonAssertions(page){
  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  const duplicates=await page.evaluate(()=>{
    const ids=['rc363BlockCustomer','rc363BlockShipment','rc573ColliCard','rc363BlockDocuments','rc363BlockStow','rc363BlockAbdDecision','rc363BlockMail','rc363BlockActions'];
    return ids.map(id=>({id,count:document.querySelectorAll('#'+id).length}));
  });
  for(const row of duplicates)expect(row.count,row.id+' duplicated').toBeLessThanOrEqual(1);
}

test('RC1306: Modern Business uses process rail, work canvas and status rail',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await openShipment(page);
  await setDesign(page,'modern');
  await expect(page.locator('html')).toHaveAttribute('data-eh-layout-mode','business');
  await expect(page.locator('.rc1306-business-workspace')).toHaveCount(1);
  await expect(page.locator('.rc1306-business-workspace > .rc1306-process-nav')).toHaveCount(1);
  await expect(page.locator('.rc1306-business-center #rc363BlockCustomer')).toHaveCount(1);
  await expect(page.locator('.rc1306-business-center #rc363BlockShipment')).toHaveCount(1);
  await expect(page.locator('.rc1306-business-rail #rc573ColliCard')).toHaveCount(1);
  const businessGeometry=await page.evaluate(()=>{
    const box=selector=>document.querySelector(selector)?.getBoundingClientRect();
    const nav=box('.rc1306-business-workspace > .rc1306-process-nav');
    const center=box('.rc1306-business-center');
    const rail=box('.rc1306-business-rail');
    return nav&&center&&rail?{navX:nav.x,centerX:center.x,railX:rail.x,navW:nav.width,centerW:center.width,railW:rail.width}:null;
  });
  expect(businessGeometry).not.toBeNull();
  expect(businessGeometry.navX).toBeLessThan(businessGeometry.centerX);
  expect(businessGeometry.centerX).toBeLessThan(businessGeometry.railX);
  expect(businessGeometry.navW).toBeGreaterThan(0);
  expect(businessGeometry.centerW).toBeGreaterThan(0);
  expect(businessGeometry.railW).toBeGreaterThan(0);
  await commonAssertions(page);
  await assertRuntimeClean(runtime,testInfo);
});

test('RC1306: Glass uses twelve-column mosaic with reordered functional modules',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await openShipment(page);
  await setDesign(page,'glass');
  await expect(page.locator('html')).toHaveAttribute('data-eh-layout-mode','glass');
  await expect(page.locator('.rc1306-glass-command')).toHaveCount(1);
  await expect(page.locator('.rc1306-glass-mosaic')).toHaveCount(1);
  await expect(page.locator('.rc1306-glass-mosaic #rc363BlockCustomer')).toHaveCount(1);
  await expect(page.locator('.rc1306-glass-mosaic #rc363BlockDocuments')).toHaveCount(1);
  await expect(page.locator('.rc1306-glass-mosaic #rc363BlockActions')).toHaveCount(1);
  const glassGeometry=await page.evaluate(()=>{
    const selectors=['#rc363BlockCustomer','#rc363BlockShipment','#rc573ColliCard'];
    return selectors.map(selector=>{
      const el=document.querySelector('.rc1306-glass-mosaic '+selector);
      const rect=el&&el.closest('.rc1306-glass-card')?.getBoundingClientRect();
      return rect?{x:rect.x,y:rect.y,width:rect.width}:null;
    });
  });
  expect(glassGeometry.every(Boolean)).toBe(true);
  expect(new Set(glassGeometry.map(row=>Math.round(row.x))).size).toBeGreaterThanOrEqual(3);
  expect(glassGeometry.every(row=>row.width>0)).toBe(true);
  await commonAssertions(page);
  await assertRuntimeClean(runtime,testInfo);
});

test('RC1306: Neon Night uses command rail, core workspace and telemetry rail',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await openShipment(page);
  await setDesign(page,'neon');
  await expect(page.locator('html')).toHaveAttribute('data-eh-layout-mode','neon');
  await expect(page.locator('.rc1306-neon-workspace')).toHaveCount(1);
  await expect(page.locator('.rc1306-neon-command')).toHaveCount(1);
  await expect(page.locator('.rc1306-neon-core #rc363BlockCustomer')).toHaveCount(1);
  await expect(page.locator('.rc1306-neon-core #rc363BlockDocuments')).toHaveCount(1);
  await expect(page.locator('.rc1306-neon-telemetry #rc573ColliCard')).toHaveCount(1);
  const neonGeometry=await page.evaluate(()=>{
    const box=selector=>document.querySelector(selector)?.getBoundingClientRect();
    const command=box('.rc1306-neon-command');
    const core=box('.rc1306-neon-core');
    const telemetry=box('.rc1306-neon-telemetry');
    return command&&core&&telemetry?{commandX:command.x,coreX:core.x,telemetryX:telemetry.x,commandW:command.width,coreW:core.width,telemetryW:telemetry.width}:null;
  });
  expect(neonGeometry).not.toBeNull();
  expect(neonGeometry.commandX).toBeLessThan(neonGeometry.coreX);
  expect(neonGeometry.coreX).toBeLessThan(neonGeometry.telemetryX);
  expect(neonGeometry.commandW).toBeGreaterThan(0);
  expect(neonGeometry.coreW).toBeGreaterThan(0);
  expect(neonGeometry.telemetryW).toBeGreaterThan(0);
  await commonAssertions(page);
  await assertRuntimeClean(runtime,testInfo);
});

test('RC1306: returning to Classic restores original functional DOM',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await openShipment(page);
  const original=await page.locator('#rc363BlockCustomer').evaluate(el=>({parentId:el.parentElement?el.parentElement.id:'',parentClass:el.parentElement?el.parentElement.className:''}));
  await setDesign(page,'glass');
  await expect(page.locator('.rc1306-glass-mosaic #rc363BlockCustomer')).toHaveCount(1);
  await setDesign(page,'classic');
  await expect(page.locator('html')).not.toHaveAttribute('data-eh-layout-mode',/./);
  await expect(page.locator('#rc1306Workspace')).toHaveCount(0);
  const restored=await page.locator('#rc363BlockCustomer').evaluate(el=>({parentId:el.parentElement?el.parentElement.id:'',parentClass:el.parentElement?el.parentElement.className:''}));
  expect(restored).toEqual(original);
  await commonAssertions(page);
  await assertRuntimeClean(runtime,testInfo);
});
