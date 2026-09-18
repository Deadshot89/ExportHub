import {test,expect} from '@playwright/test';
import {
  appEntry,
  waitReady,
  settleStateSave,
  openExportHubView,
  assertNoSourceLeak,
  assertNoHorizontalOverflow,
  attachRuntimeGuards,
  assertRuntimeClean,
  installE2ESession
} from '../helpers/exporthub-browser.mjs';

const coreViews=[
  ['dashboard',['Dashboard'],/Dashboard/i],
  ['tasks',['Aufgaben'],/Aufgaben|POD/i],
  ['notifications',['Benachrichtigungen','Benachrichtigungscenter'],/Benachrichtig|Offene Aufgaben/i],
  ['pickupcalendar',['Abholkalender'],/Abholkalender|Abholung/i],
  ['shipment',['Sendung erstellen','Neue Sendung','Sendung anlegen'],/Kunde|Empfänger/i],
  ['shipmentoverview',['Sendungsübersicht','Sendungen'],/Sendungsübersicht|Sendungen/i],
  ['customerfolder',['Kundenordner'],/Kundenordner|Kunden/i],
  ['pallet',['Palettenkonto'],/Palettenkonto|Paletten/i],
  ['shippingcosts',['Versandkosten'],/Versandkosten|UPS|Maut|Route/i],
  ['sop',['SOP & Portale','SOP','SOP-Handbuch'],/SOP|Portale/i],
  ['academy',['Academy'],/Academy|Unterweisung/i]
];

const wideViews=[
  ['shipmentview',['Sendungsansicht','Sendung ansehen'],/Sendung|Dokument/i],
  ['documents',['Ladeliste & CMR','Dokumente & CMR','Dokumente','CMR'],/Ladeliste|CMR|Dokument/i],
  ['warehouse',['Lager'],/Lager|Goods|Loc/i],
  ['customs',['Zollwissen','Zoll'],/Zoll|ABD|Ausfuhr/i],
  ['exams',['Prüfungen'],/Prüfung|Fragen/i]
];

test.beforeEach(async({page})=>{
  if(process.env.EXPORTHUB_E2E_LIVE==='1')await installE2ESession(page);
});

async function assertView(page){
  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
}

test('RC1124 P0: Hauptnavigation öffnet auf jedem Viewport die richtige Ansicht',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await assertView(page);

  const views=[...coreViews];
  if(['laptop','desktop'].includes(testInfo.project.name))views.push(...wideViews);

  for(const [module,labels,required] of views){
    await openExportHubView(page,module,labels,required);
    await assertView(page);
  }
  await assertRuntimeClean(runtime,testInfo);
});

test('RC1124 P0: Sendung erstellen bleibt Erfassungsmaske und wird nicht zur Historie',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'shipment',['Sendung erstellen','Neue Sendung','Sendung anlegen'],/Kunde|Empfänger/i);

  await expect(page.locator('#rc363BlockDocuments')).toBeVisible();
  await expect(page.locator('#rc543MailArea')).toBeVisible();
  await expect(page.locator('#content')).toContainText(/Colli|Lademeter/i);
  await expect(page.locator('#content')).not.toContainText(/^\s*Historie\s*$/i);
  await assertView(page);
  await assertRuntimeClean(runtime,testInfo);
});

test('RC1124 P0: Browser Zurück/Vor und F5 behalten die fachliche View',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','History-Smoke läuft einmal auf dem Laptop-Profil.');
  const runtime=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);

  await openExportHubView(page,'dashboard',['Dashboard'],/Dashboard/i);
  await openExportHubView(page,'shipment',['Sendung erstellen','Neue Sendung','Sendung anlegen'],/Colli|Lademeter/i);
  await openExportHubView(page,'tasks',['Aufgaben'],/Aufgaben|POD/i);
  await settleStateSave(page,{timeout:25_000});

  await page.goBack({timeout:10_000}).catch(()=>null);
  await expect.poll(()=>page.locator('#content').innerText(),{timeout:10_000}).toMatch(/Colli|Lademeter/i);
  await assertView(page);

  await page.goForward({timeout:10_000}).catch(()=>null);
  await expect.poll(()=>page.locator('#content').innerText(),{timeout:10_000}).toMatch(/Aufgaben|POD/i);
  await settleStateSave(page,{timeout:25_000});
  await page.reload({waitUntil:'domcontentloaded'});
  await waitReady(page);
  await settleStateSave(page,{timeout:25_000});
  await expect.poll(()=>page.locator('#content').innerText(),{timeout:10_000}).toMatch(/Aufgaben|POD/i);
  await assertView(page);
  await assertRuntimeClean(runtime,testInfo);
});


test('RC1125 P0: Benutzerverwaltung zeigt keine Fehlerdiagnose',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Benutzer-/Diagnose-Isolation läuft einmal auf dem Laptop-Profil.');
  const runtime=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);

  await page.evaluate(()=>{
    const root=document.getElementById('content')||document.body;
    const stale=document.createElement('section');
    stale.id='rc1013-diagnostics-enhanced';
    stale.innerHTML='<h3>Fehlerdiagnose & automatische Behebung</h3>';
    root.appendChild(stale);
  });
  await openExportHubView(page,'rights',['Benutzer & Rechte','Benutzer','Rechte','Berechtigungen'],/Benutzer|Rechte|Rollen/i,{allowProgrammaticFallback:true});

  await expect(page.locator('#rc1013-diagnostics-enhanced')).toHaveCount(0);
  await expect(page.locator('#content')).not.toContainText(/Fehlerdiagnose\s*&\s*automatische Behebung/i);
  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  await assertRuntimeClean(runtime,testInfo);
});


test('RC1126 P0: Kundenordner bietet sichere Kundenlöschung für Admins',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Kundenlöschung wird einmal auf dem Laptop-Profil geprüft.');
  const runtime=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'customerfolder',['Kundenordner'],/Kundenordner|Kunden/i,{allowProgrammaticFallback:true});

  const selected=await page.evaluate(()=>{
    const s=typeof window.__EXPORTHUB_GET_STATE__==='function'?window.__EXPORTHUB_GET_STATE__():null;
    const c=s&&Array.isArray(s.customers)&&s.customers[0];
    if(!s||!c)return false;
    const id=String(c.id||c.account||c.customerNumber||c.name||'').trim();
    s.selectedCustomerId=id;s.currentCustomerId=id;s.customerFolderId=id;
    if(typeof window.setView==='function')window.setView('customerfolder');
    try{window.dispatchEvent(new CustomEvent('exporthub:rendered'))}catch(_){}
    return true;
  });
  expect(selected).toBe(true);

  const deleteButton=page.getByRole('button',{name:'Kunde löschen',exact:true}).last();
  await expect(deleteButton).toBeVisible({timeout:10_000});
  await deleteButton.click();
  await expect(page.getByText('Diesen Kundenstammsatz wirklich löschen?',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Endgültig löschen',exact:true})).toBeVisible();
  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  await assertRuntimeClean(runtime,testInfo);
});


test('RC1127 P0: Sendungsübersicht zeigt vom Kunden erfasstes Abholdatum in der Kachel',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Kunden-Abholtermin wird einmal auf dem Laptop-Profil geprüft.');
  const runtime=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);

  const seeded=await page.evaluate(()=>{
    const s=typeof window.__EXPORTHUB_GET_STATE__==='function'?window.__EXPORTHUB_GET_STATE__():null;
    const sh=s&&Array.isArray(s.shipments)&&s.shipments[0];
    if(!sh)return false;
    sh.customerAvisPickupDate='2026-09-18';
    sh.avisPickupDate='2026-09-18';
    sh.customerAvisPickupTimeFrom='10:00';
    sh.avisPickupTimeFrom='10:00';
    sh.customerAvisPickupTimeTo='12:00';
    sh.avisPickupTimeTo='12:00';
    sh.customerConfirmed=true;
    sh.customerConfirmedVia='customer-avis';
    return {
      id:String(sh.id||sh.shipmentId||'').trim(),
      ref:String(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||'').trim()
    };
  });
  expect(seeded).toBeTruthy();
  expect(seeded.ref||seeded.id).toBeTruthy();

  await openExportHubView(page,'shipmentoverview',['Sendungsübersicht','Sendungen'],/Sendungsübersicht|Sendungen/i,{allowProgrammaticFallback:true});
  const shipmentCard=page.locator('#content article,#content .card').filter({hasText:seeded.ref||seeded.id}).first();
  await expect(shipmentCard).toBeVisible({timeout:10_000});
  const pickup=shipmentCard.locator('[data-rc1127-customer-pickup]').first();
  await expect(pickup).toBeVisible({timeout:10_000});
  await expect(pickup).toHaveText('Kunden-Abholung: 18.09.2026 · 10:00–12:00');
  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  await assertRuntimeClean(runtime,testInfo);
});
