import {test,expect} from '@playwright/test';

const requiredScripts=[
  'exporthub-rc1505-sop-function-registry',
  'exporthub-rc1505-sop-coverage',
  'exporthub-rc1506-sop-coverage-dashboard',
  'exporthub-rc1506-sop-coverage-runtime'
];

const expectedMarker=()=>String(process.env.EXPORTHUB_RC_EXPECTED_MARKER||'').trim();
const expectedDemo=()=>String(process.env.EXPORTHUB_RC_EXPECT_DEMO||'0')==='1';

for(const project of ['laptop','mobile-standard']){
  test(`RC1520: Release-Kandidat lädt vollständiges SOPMaster-Paket (${project})`,async({page},testInfo)=>{
    test.skip(testInfo.project.name!==project,`nur ${project}`);
    const pageErrors=[];
    page.on('pageerror',error=>pageErrors.push(String(error&&error.message||error)));

    await page.goto(process.env.EXPORTHUB_E2E_ENTRY||'/demo.html',{waitUntil:'domcontentloaded'});
    await expect(page.locator('body')).toBeVisible();

    const source=await page.content();
    const marker=expectedMarker();
    expect(marker,'RC1520 erwarteter Umgebungsmarker fehlt').not.toBe('');
    expect(source).toContain(marker);

    for(const id of requiredScripts)await expect(page.locator(`#${id}`)).toHaveCount(1);
    await expect(page.locator('#exporthub-rc1506-sop-coverage-dashboard-style')).toHaveCount(1);

    await expect.poll(()=>page.evaluate(()=>({
      registry:!!window.ExportHubSopFunctionRegistry,
      coverage:!!window.ExportHubSopCoverage,
      dashboard:!!window.ExportHubSopCoverageDashboard,
      runtime:!!window.ExportHubSopCoverageRuntime
    })),{timeout:10_000}).toEqual({registry:true,coverage:true,dashboard:true,runtime:true});

    const demo=await page.evaluate(()=>window.__EXPORTHUB_DEMO_MODE__===true);
    expect(demo).toBe(expectedDemo());

    const dimensions=await page.locator('html').evaluate(el=>({scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth+4);
    expect(pageErrors,'RC1520 Paket darf keinen ungefangenen JS-Fehler erzeugen').toEqual([]);
  });
}
