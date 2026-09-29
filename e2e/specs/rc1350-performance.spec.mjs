import {test,expect} from '@playwright/test';

const avisId='R'.repeat(32);
const SNAPSHOT={
  ok:true,
  session:'test-session',
  sessionExpiresAt:'2026-09-29T22:00:00.000Z',
  reference:'ABC123',
  status:'Erstellt',
  customerName:'Performance Test',
  country:'DE',
  sender:{name:'Essentra Components GmbH',address:'Nettetal'},
  recipientAddress:'Teststraße 1, 41334 Nettetal',
  totals:{count:1,weight:100,ldm:0.2},
  rows:[],
  documents:[],
  customerUploads:[],
  pod:{available:false,status:'Noch nicht vorhanden',documents:[]},
  appointment:{},
  slotAvailability:[],
  avis:{},
  lastUpdatedAt:'2026-09-29T19:00:00.000Z'
};

test('RC1350: gleichzeitige focus/visibility-Refreshes erzeugen nur einen GET',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Performance-Kollisionsfall wird einmal in Chromium geprüft.');
  let refreshGets=0;
  await page.route('**/api/customer-avis*',async route=>{
    const req=route.request();
    if(req.method()==='GET'){
      refreshGets++;
      await new Promise(resolve=>setTimeout(resolve,350));
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(SNAPSHOT)});
      return;
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(SNAPSHOT)});
  });

  await page.goto('/customer-avis.html?token='+avisId);
  await page.locator('#accessForm input[name="reference"]').fill('ABC123');
  await page.locator('#accessForm button[type="submit"]').click();
  await expect(page.locator('#avisForm')).toBeVisible();

  refreshGets=0;
  await page.evaluate(()=>{
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(700);

  expect(refreshGets,'focus + visibilitychange dürfen keinen doppelten Refresh-GET auslösen').toBe(1);
});
