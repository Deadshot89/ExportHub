import {test,expect} from '@playwright/test';
import {
  assertNoSourceLeak,
  attachRuntimeGuards,
  assertRuntimeClean
} from '../helpers/exporthub-browser.mjs';
import {
  packStationTokenFromFixture,
  runPackNotificationLiveFlow
} from '../helpers/pack-notification-live.mjs';

const publicPages=[
  ['/pickup.html','Pickup'],
  ['/customer-avis.html','Lieferavis'],
  ['/location.html','Location']
];

async function installStaticApiFallback(page,{invalidAvis=false}={}){
  if(process.env.EXPORTHUB_E2E_STATIC!=='1')return;
  await page.route('**/api/**',async route=>{
    const url=route.request().url();
    const isAvis=/\/api\/customer-avis/i.test(url);
    const status=invalidAvis&&isAvis?404:200;
    await route.fulfill({
      status,
      contentType:'application/json',
      body:JSON.stringify(status===404?{error:'INVALID_TOKEN'}:{ok:true,items:[],documents:[]})
    });
  });
}

for(const [path,label] of publicPages){
  test(`RC1124 public: ${label} lädt read-only ohne Quellcode-Leak`,async({page},testInfo)=>{
    const runtime=attachRuntimeGuards(page,testInfo);
    await installStaticApiFallback(page);
    await page.goto(path,{waitUntil:'domcontentloaded'});
    await expect(page.locator('body')).toBeVisible();
    await expect.poll(()=>page.locator('body').innerText(),{timeout:10_000}).not.toBe('');
    await assertNoSourceLeak(page);
    await assertRuntimeClean(runtime,testInfo);
  });
}

test('RC1124 public: ungültiger Lieferavis-Token endet kontrolliert',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await installStaticApiFallback(page,{invalidAvis:true});
  const environment=process.env.EXPORTHUB_E2E_PUBLIC_ENV||'testservice';
  await page.goto('/customer-avis.html?token=__rc1124_invalid__&environment='+encodeURIComponent(environment)+'&lang=de',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toBeVisible();
  await expect.poll(()=>page.locator('body').innerText(),{timeout:15_000}).toMatch(/ungültig|invalid|abgelaufen|nicht gefunden|nicht verfügbar|nicht freigegeben|Zugriff|Token|Fehler/i);
  await assertNoSourceLeak(page);
  await assertRuntimeClean(runtime,testInfo);
});

test('RC1499: echter QR-Packmeldungsfluss blockiert Production bei TESTSERVICE-Regression',async({browser},testInfo)=>{
  test.setTimeout(180_000);
  test.skip(process.env.EXPORTHUB_E2E_LIVE!=='1'||process.env.EXPORTHUB_E2E_MUTATION!=='1','RC1499 läuft nur im mutierenden TESTSERVICE-Gate.');
  test.skip(testInfo.project.name!=='laptop','RC1499 läuft genau einmal auf dem Laptop-Profil.');
  const token=packStationTokenFromFixture();
  expect(token,'Temporärer RC1499 Packtisch-Token fehlt').toMatch(/^E2E-PACK-/);
  await runPackNotificationLiveFlow(browser,testInfo,token);
});
