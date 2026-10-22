import {test,expect} from '@playwright/test';

const requiredScripts=[
  'exporthub-training-center-model',
  'exporthub-training-center-store',
  'exporthub-training-coverage-dashboard',
  'exporthub-training-center-runtime'
];

const expectedMarker=()=>String(process.env.EXPORTHUB_RC_EXPECTED_MARKER||'').trim();
const expectedDemo=()=>String(process.env.EXPORTHUB_RC_EXPECT_DEMO||'0')==='1';

for(const project of ['laptop','mobile-standard']){
  test('RC1520: Training-Center-Release enthält aktive neue Runtime und keine alte SOPMaster-Runtime ('+project+')',async({page},testInfo)=>{
    test.skip(testInfo.project.name!==project,'nur '+project);
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error&&error.message||error)));
    await page.goto(process.env.EXPORTHUB_E2E_ENTRY||'/demo.html',{waitUntil:'domcontentloaded'});
    await expect(page.locator('body')).toBeVisible();
    const source=await page.content(),marker=expectedMarker();
    expect(marker,'RC1520 environment marker missing').not.toBe('');
    expect(source).toContain(marker);
    for(const id of requiredScripts)await expect(page.locator('#'+id)).toHaveCount(1);
    await expect(page.locator('#exporthub-training-center-style')).toHaveCount(1);
    await expect(page.locator('#exporthub-training-tour-style')).toHaveCount(1);
    await expect(page.locator('script[src*="assets/sop/"],link[href*="assets/sop/"]')).toHaveCount(0);
    await expect.poll(()=>page.evaluate(()=>({
      model:typeof window.ExportHubTrainingCenterModel?.normalizeCenter==='function',
      store:typeof window.ExportHubTrainingCenterStore?.read==='function',
      dashboard:typeof window.ExportHubTrainingCoverageDashboard?.mount==='function',
      runtime:typeof window.ExportHubTrainingCenterRuntime?.mount==='function'
    })),{timeout:15_000}).toEqual({model:true,store:true,dashboard:true,runtime:true});
    expect(await page.evaluate(()=>window.__EXPORTHUB_DEMO_MODE__===true)).toBe(expectedDemo());
    const dimensions=await page.locator('html').evaluate(el=>({scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth+4);
    expect(errors,'Uncaught JS errors in RC1520 candidate').toEqual([]);
  });
}
