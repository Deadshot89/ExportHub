import {test,expect} from '@playwright/test';

const requiredScripts=[
  'exporthub-rc1505-sop-function-registry',
  'exporthub-rc1505-sop-coverage',
  'exporthub-rc1506-sop-coverage-dashboard',
  'exporthub-rc1506-sop-coverage-runtime'
];

test('RC1507: TESTVERSION lädt als TESTSERVICE mit vollständigem RC1506 SOPMaster-Paket',async({page},testInfo)=>{
  test.skip(!['laptop','mobile-standard'].includes(testInfo.project.name),'RC1507 läuft auf Laptop und Mobile.');
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error&&error.message||error)));

  await page.goto(process.env.EXPORTHUB_E2E_ENTRY||'/TESTVERSION.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toBeVisible();

  const source=await page.content();
  expect(source).toContain('ExportHUB RC1112 environment=testservice');
  expect(source).not.toContain('ExportHUB RC1112 environment=demo');

  for(const id of requiredScripts)await expect(page.locator(`#${id}`)).toHaveCount(1);
  await expect(page.locator('#exporthub-rc1506-sop-coverage-dashboard-style')).toHaveCount(1);

  await expect.poll(()=>page.evaluate(()=>({
    registry:!!window.ExportHubSopFunctionRegistry,
    coverage:!!window.ExportHubSopCoverage,
    dashboard:!!window.ExportHubSopCoverageDashboard,
    runtime:!!window.ExportHubSopCoverageRuntime
  })),{timeout:10_000}).toEqual({registry:true,coverage:true,dashboard:true,runtime:true});

  const flags=await page.evaluate(()=>({
    demo:window.__EXPORTHUB_DEMO_MODE__===true,
    pendingNavigation:window.__EXPORTHUB_SOP_PENDING_NAV__||null
  }));
  expect(flags.demo).toBe(false);
  expect(flags.pendingNavigation).toBeNull();

  const root=page.locator('html');
  const dimensions=await root.evaluate(el=>({scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth+4);
  expect(pageErrors,'TESTVERSION darf beim Laden des RC1506-Pakets keinen ungefangenen JS-Fehler erzeugen').toEqual([]);
});
