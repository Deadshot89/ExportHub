import {test,expect} from '@playwright/test';

async function instrumentTimers(page){
  await page.evaluate(()=>{
    const nativeSetTimeout=window.setTimeout.bind(window);
    window.__rc1516TimerCount=0;
    window.setTimeout=function(fn,delay,...args){
      window.__rc1516TimerCount+=1;
      return nativeSetTimeout(fn,delay,...args);
    };
  });
}

async function timerCount(page){
  return page.evaluate(()=>window.__rc1516TimerCount||0);
}

async function resetTimerCount(page){
  await page.evaluate(()=>{window.__rc1516TimerCount=0;});
}

async function dispatchSync(page){
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('exporthub:sync',{detail:{reason:'save-confirmation',concurrentMerge:false}})));
  await page.waitForTimeout(40);
}

test.describe('RC1516: real Chromium runtime performance verification',()=>{
  test.beforeEach(async({page},testInfo)=>{
    test.skip(testInfo.project.name!=='laptop','Runtime-Performance wird einmal reproduzierbar in Chromium geprüft.');
    await page.goto('about:blank');
    await instrumentTimers(page);
  });

  test('RC1499 Handoff erzeugt off-view weder Start- noch Sync-Timer',async({page})=>{
    await page.addScriptTag({path:'assets/rc1499-exportexperte-handoff.js'});
    await page.waitForTimeout(40);
    expect(await timerCount(page),'off-view Start darf im echten Browser keinen Handoff-Timer planen').toBe(0);
    await resetTimerCount(page);
    await dispatchSync(page);
    expect(await timerCount(page),'off-view exporthub:sync darf im echten Browser keinen Handoff-Remount planen').toBe(0);
    await expect(page.locator('#rc1499HandoffStyle')).toHaveCount(0);
    await expect(page.locator('#exporthub-rc1499-abd-export')).toHaveCount(0);
  });

  test('RC1499 Handoff behält im sichtbaren ABD-Kontext den Runtime-Refresh',async({page})=>{
    await page.setContent('<!doctype html><html><head></head><body><div id="rc626Abd"></div></body></html>');
    await instrumentTimers(page);
    await page.addScriptTag({path:'assets/rc1499-exportexperte-handoff.js'});
    await page.waitForTimeout(40);
    expect(await timerCount(page),'sichtbarer ABD-Kontext muss den initialen Handoff-Refresh behalten').toBeGreaterThan(0);
    await expect(page.locator('#rc1499HandoffStyle')).toHaveCount(1);
    await expect(page.locator('#exporthub-rc1499-abd-export')).toHaveCount(1);
    await resetTimerCount(page);
    await dispatchSync(page);
    expect(await timerCount(page),'sichtbarer ABD-Kontext muss den Sync-Refresh behalten').toBeGreaterThan(0);
  });

  test('RC1499 ABD-Export erzeugt off-view weder Start- noch Sync-Timer',async({page})=>{
    await page.addScriptTag({path:'assets/rc1499-abd-export.js'});
    await page.waitForTimeout(40);
    expect(await timerCount(page),'off-view Start darf im echten Browser keinen ABD-Export-Timer planen').toBe(0);
    await resetTimerCount(page);
    await dispatchSync(page);
    expect(await timerCount(page),'off-view exporthub:sync darf im echten Browser keinen Export-Remount planen').toBe(0);
    await expect(page.locator('#rc1499AbdExportStyle')).toHaveCount(0);
  });

  test('RC1499 ABD-Export behält im sichtbaren ABD-Kontext den Runtime-Refresh',async({page})=>{
    await page.setContent('<!doctype html><html><head></head><body><div id="rc626Abd"></div></body></html>');
    await instrumentTimers(page);
    await page.addScriptTag({path:'assets/rc1499-abd-export.js'});
    await page.waitForTimeout(40);
    expect(await timerCount(page),'sichtbarer ABD-Kontext muss den initialen Export-Refresh behalten').toBeGreaterThan(0);
    await expect(page.locator('#rc1499AbdExportStyle')).toHaveCount(1);
    await resetTimerCount(page);
    await dispatchSync(page);
    expect(await timerCount(page),'sichtbarer ABD-Kontext muss den Export-Sync-Refresh behalten').toBeGreaterThan(0);
  });
});
