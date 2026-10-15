import {test,expect} from '@playwright/test';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const files=[
  'assets/training-center/model.js',
  'assets/training-center/store.js',
  'assets/training-center/i18n.js',
  'assets/training-center/customer-sop.js',
  'assets/training-center/screenshots.js',
  'assets/training-center/coverage-registry.js',
  'assets/training-center/coverage.js',
  'assets/training-center/coverage-dashboard.js',
  'assets/training-center/catalog/shipment-registration.js',
  'assets/training-center/catalog/dhl-express.js',
  'assets/training-center/scenarios/first-shipment.js',
  'assets/training-center/ui.js',
  'assets/training-center/runtime.js'
];

async function boot(page){
  await page.setContent('<html lang="de" data-eh-design="modern"><head></head><body data-exporthub-view="dashboard"><main id="content"><section data-dashboard>Dashboard</section></main></body></html>');
  await page.addStyleTag({content:read('assets/training-center/ui.css')});
  await page.evaluate(()=>{window.__EXPORTHUB_GET_STATE__=()=>({});});
  for(const file of files)await page.addScriptTag({content:read(file)});
}

test('echte sop-Route zeigt ausschließlich das neue Training Center und neue Coverage',async({page})=>{
  await boot(page);
  await expect(page.locator('[data-training-center-route]')).toHaveCount(0);
  await page.evaluate(()=>{
    document.querySelector('#content').innerHTML='<section class="rc1007-sop-overview">Alte SOPMaster Ansicht</section>';
    document.body.setAttribute('data-exporthub-view','sop');
  });
  const shell=page.locator('[data-training-center-shell]');
  await expect(page.locator('[data-training-center-route]')).toBeVisible();
  await expect(shell).toBeVisible();
  await expect(page.locator('[data-training-coverage]')).toBeVisible();
  await expect(page.locator('.rc1007-sop-overview')).toHaveCount(0);
  await expect(shell.getByRole('heading',{name:'Sendung in ExportHUB360 anmelden',exact:true})).toBeVisible();
  await expect(shell.getByRole('heading',{name:'DHL Express – Sendung anmelden',exact:true})).toBeVisible();
  await expect(page.locator('[data-kpi="rate"] strong')).toHaveText('8%');
  await expect(page.locator('[data-kpi="missing"] strong')).toHaveText('23');
  await expect(page.locator('[data-kpi="complete"] strong')).toHaveText('2');
});

test('Legacy-Rerender im sop-View wird wieder durch das neue Training Center ersetzt',async({page})=>{
  await boot(page);
  await page.evaluate(()=>document.body.setAttribute('data-exporthub-view','sop'));
  await expect(page.locator('[data-training-center-route]')).toBeVisible();
  await page.evaluate(()=>{document.querySelector('#content').innerHTML='<div class="rc1007-sop-overview">Legacy rerender</div>';});
  await expect(page.locator('.rc1007-sop-overview')).toHaveCount(0);
  await expect(page.locator('[data-training-center-route]')).toBeVisible();
  await expect(page.locator('[data-training-center-shell]').getByRole('heading',{name:'SOP & Training Center',exact:true,level:1})).toBeVisible();
});

test('Verlassen der sop-Route überschreibt keine fachfremde Ansicht',async({page})=>{
  await boot(page);
  await page.evaluate(()=>document.body.setAttribute('data-exporthub-view','sop'));
  await expect(page.locator('[data-training-center-route]')).toBeVisible();
  await page.evaluate(()=>{
    document.body.setAttribute('data-exporthub-view','dashboard');
    document.querySelector('#content').innerHTML='<section data-dashboard-safe>Dashboard bleibt erhalten</section>';
  });
  await expect(page.locator('[data-training-center-route]')).toHaveCount(0);
  await expect(page.locator('[data-dashboard-safe]')).toHaveText('Dashboard bleibt erhalten');
});