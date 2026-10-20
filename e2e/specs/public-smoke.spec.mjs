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

test('RC1555 production smoke: verschachtelte POD-Abholkarten zeigen nur die neuen Werte',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','RC1555 POD-Liveprüfung läuft einmal im Laptop-Profil.');
  const runtime=attachRuntimeGuards(page,testInfo);
  await installStaticApiFallback(page);
  await page.goto('/',{waitUntil:'domcontentloaded'});
  // The base print runtime can load before the final RC1556/RC1561 print wrapper.
  // Geometry must be measured against the fully installed production print runtime.
  await page.waitForFunction(()=>window.ExportHUBRC1305LoadingListPrint?.__pickupNestedCleanupRC1556===true,null,{timeout:20_000});
  await page.emulateMedia({media:'print'});

  const layout=await page.evaluate(()=>{
    const api=window.ExportHUBRC1305LoadingListPrint;
    const card=(label,oldValue,legacyHeight='0')=>
      '<div class="rc390-card" data-rc1555-live-card="1" style="box-sizing:border-box;min-height:26mm;padding:2mm;border:1px solid #cbd5e1">'+
        '<div class="rc390-field-head"><div class="rc390-label">'+label+'</div></div>'+
        '<div class="rc390-txt"><span>Alter Hilfetext</span><div style="min-height:'+legacyHeight+'">'+oldValue+'</div></div>'+
      '</div>';
    const raw='<section class="rc390-page rc390-load" style="width:194mm;min-height:120mm;padding:8mm">'+
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2mm">'+
        card('Unterschrift Fahrer','ALTE UNTERSCHRIFT','52mm')+
        card('Fahrername','ALTER FAHRER')+
        card('Datum / Uhrzeit','ALTES DATUM')+
        card('Kennzeichen','ALTES KENNZEICHEN')+
        card('Verlader','ALTER VERLADER')+
        card('Europaletten Ausgang','Ausgang: 99 Europaletten')+
      '</div><div data-rc1305-pickup-summary>ALTER ERSATZBLOCK</div></section>';
    const shipment={
      reference:'RC1555-LIVE',status:'Abgeholt',palletOut:3,
      signatureData:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl9sAAAAASUVORK5CYII=',
      pickupHistory:[{complete:true,driverName:'Max Fahrer',licensePlate:'KLE-RC1555',loaderName:'Live Verlader',confirmedAt:'2026-10-16T12:00:00.000Z'}]
    };
    // Reproduce the actual print DOM hierarchy. A naked .rc390-load directly in
    // document.body can be hidden by the production @media print view selectors,
    // yielding a false 0px signature (blank screenshot) only in TESTSERVICE.
    document.body.classList.add('print-rc390');
    document.body.innerHTML='<main class="rc390-docview"><div class="rc390-bundle">'+api.enhance(raw,shipment,true)+'</div></main>';
    const root=document.querySelector('.rc390-docview .rc390-bundle > .rc390-load');
    if(!root)throw new Error('RC1555: Druckcontainer oder Ladeliste fehlt');
    const fields=Array.from(root.querySelectorAll('[data-rc1503-pickup-field]'));
    const visibleLegacy=Array.from(root.querySelectorAll('[data-rc1555-live-card="1"] .rc390-txt,[data-rc1555-live-card="1"] .rc352-txt')).filter(node=>getComputedStyle(node).display!=='none');
    const signature=root.querySelector('.rc1503-signature-value');
    const image=root.querySelector('.rc1503-signature-value .rc1305-signature-image');
    const cards=Array.from(root.querySelectorAll('[data-rc1555-live-card="1"]'));
    return {
      fieldCount:fields.length,
      printRootHeight:root.getBoundingClientRect().height,
      outerCards:fields.every(field=>field.matches('.rc390-card,.rc352-card')),
      visibleLegacy:visibleLegacy.length,
      signatureHeight:signature?signature.getBoundingClientRect().height:0,
      imageHeight:image?image.getBoundingClientRect().height:0,
      maxCardHeight:Math.max(...cards.map(card=>card.getBoundingClientRect().height)),
      bodyText:String(document.body.innerText||'')
    };
  });

  expect(layout.fieldCount).toBe(6);
  expect(layout.printRootHeight,'Der echte Ladelisten-Druckcontainer muss sichtbar sein').toBeGreaterThan(0);
  expect(layout.outerCards).toBe(true);
  expect(layout.visibleLegacy).toBe(0);
  expect(layout.signatureHeight).toBeGreaterThan(0);
  expect(layout.signatureHeight).toBeLessThanOrEqual(62);
  expect(layout.imageHeight).toBeLessThanOrEqual(58);
  expect(layout.maxCardHeight).toBeLessThanOrEqual(120);
  expect(layout.bodyText).not.toMatch(/ALTE UNTERSCHRIFT|ALTER FAHRER|ALTES DATUM|ALTES KENNZEICHEN|ALTER VERLADER|ALTER ERSATZBLOCK|Alter Hilfetext|Ausgang:\s*99/i);
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
