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

test('RC1310: explicit design switch builds the layout only once',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await openShipment(page);
  await setDesign(page,'classic');
  await page.evaluate(()=>{
    window.__RC1310_LAYOUT_ADDS__=0;
    const observer=new MutationObserver(records=>{
      for(const record of records){
        for(const node of record.addedNodes||[]){
          if(node.nodeType!==1)continue;
          if(node.id==='rc1306Workspace'||node.querySelector?.('#rc1306Workspace'))window.__RC1310_LAYOUT_ADDS__++;
        }
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
    window.__RC1310_LAYOUT_OBSERVER__=observer;
  });
  await setDesign(page,'modern');
  await page.waitForTimeout(220);
  const builds=await page.evaluate(()=>{
    window.__RC1310_LAYOUT_OBSERVER__?.disconnect();
    return window.__RC1310_LAYOUT_ADDS__;
  });
  expect(builds).toBe(1);
  await assertRuntimeClean(runtime,testInfo);
});

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
    return nav&&center&&rail?{
      navX:nav.x,centerX:center.x,railX:rail.x,
      navY:nav.y,centerY:center.y,railY:rail.y,
      navW:nav.width,centerW:center.width,railW:rail.width
    }:null;
  });
  expect(businessGeometry).not.toBeNull();
  const businessViewport=page.viewportSize()?.width||1366;
  if(businessViewport>1120){
    expect(businessGeometry.navX).toBeLessThan(businessGeometry.centerX);
    expect(businessGeometry.centerX).toBeLessThan(businessGeometry.railX);
  }else{
    expect(businessGeometry.navY).toBeLessThan(businessGeometry.centerY);
    expect(businessGeometry.centerY).toBeLessThan(businessGeometry.railY);
  }
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
  const glassViewport=page.viewportSize()?.width||1366;
  if(glassViewport<=760){
    expect(new Set(glassGeometry.map(row=>Math.round(row.x))).size).toBe(1);
    expect(glassGeometry[0].y).toBeLessThan(glassGeometry[1].y);
    expect(glassGeometry[1].y).toBeLessThan(glassGeometry[2].y);
  }else if(glassViewport<=1120){
    expect(glassGeometry[0].x).toBeLessThan(glassGeometry[1].x);
    expect(Math.abs(glassGeometry[0].y-glassGeometry[1].y)).toBeLessThan(4);
    expect(glassGeometry[2].y).toBeGreaterThan(glassGeometry[0].y);
  }else{
    expect(glassGeometry[0].x).toBeLessThan(glassGeometry[1].x);
    expect(glassGeometry[1].x).toBeLessThan(glassGeometry[2].x);
  }
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
    return command&&core&&telemetry?{
      commandX:command.x,coreX:core.x,telemetryX:telemetry.x,
      commandY:command.y,coreY:core.y,telemetryY:telemetry.y,
      commandW:command.width,coreW:core.width,telemetryW:telemetry.width
    }:null;
  });
  expect(neonGeometry).not.toBeNull();
  const neonViewport=page.viewportSize()?.width||1366;
  if(neonViewport>1120){
    expect(neonGeometry.commandX).toBeLessThan(neonGeometry.coreX);
    expect(neonGeometry.coreX).toBeLessThan(neonGeometry.telemetryX);
  }else{
    expect(neonGeometry.commandY).toBeLessThan(neonGeometry.coreY);
    expect(neonGeometry.coreY).toBeLessThan(neonGeometry.telemetryY);
  }
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
