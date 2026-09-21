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

test.beforeEach(async({page},testInfo)=>{
  const dedicatedNonAdmin=/RC1169 P0: Nicht-Admin/.test(testInfo.title);
  if(process.env.EXPORTHUB_E2E_LIVE==='1'&&!dedicatedNonAdmin)await installE2ESession(page);
});

async function assertView(page){
  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
}

test('RC1124 P0: Hauptnavigation öffnet auf jedem Viewport die richtige Ansicht',async({page},testInfo)=>{
  if(process.env.EXPORTHUB_E2E_LIVE==='1')test.setTimeout(120_000);
  const runtime=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await assertView(page);

  const views=[...coreViews,...wideViews];

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

  for(const selector of [
    '#rc363BlockCustomer',
    '#rc363BlockShipment',
    '#rc363BlockColli',
    '#rc363BlockDocuments',
    '#rc363BlockStow',
    '#rc363BlockMail',
    '#rc363BlockActions'
  ])await expect(page.locator(selector),selector+' fehlt in Sendung erstellen').toBeVisible();
  await expect(page.locator('#rc543MailArea')).toBeVisible();
  await expect(page.locator('#content')).toContainText(/Kunde|Empfänger/i);
  await expect(page.locator('#content')).toContainText(/Sendungsdaten/i);
  await expect(page.locator('#content')).toContainText(/Colli|Lademeter/i);
  await expect(page.locator('#content')).toContainText(/Dokument|ABD/i);
  await expect(page.locator('#content')).toContainText(/Stauplan/i);
  await expect(page.locator('#content')).toContainText(/Mail|E-Mail/i);
  await expect(page.locator('#content')).toContainText(/Speichern|Ausgabe/i);
  await expect(page.locator('#rc363BlockActions [data-rc1203-print-cover-only]')).toBeVisible();
  await expect(page.locator('[data-rc1203-print-cover-only]')).toHaveCount(1);
  await expect(page.locator('[data-rc1203-print-cmr-only]')).toHaveCount(0);
  await expect(page.locator('#content')).not.toContainText(/^\s*Historie\s*$/i);
  await assertView(page);
  await assertRuntimeClean(runtime,testInfo);
});

test('RC1158 P1: Deckblatt-Hervorhebung wird im echten Browser auch im Druckmedium gerendert',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Deckblatt-Rendering wird einmal auf dem Laptop-Profil geprüft.');
  const runtime=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await page.emulateMedia({media:'print'});

  const style=await page.evaluate(()=>{
    const cover=document.createElement('section');
    cover.className='rc352-cover';
    cover.style.position='fixed';
    cover.style.left='-2000px';
    cover.style.top='0';
    cover.style.width='210mm';
    cover.style.height='297mm';
    const ref=document.createElement('div');
    ref.className='rc352-cover-ref';
    ref.innerHTML='<span>Referenz</span><strong>E2E123</strong>';
    cover.appendChild(ref);
    document.body.appendChild(cover);
    const c=getComputedStyle(cover),r=getComputedStyle(ref);
    const out={
      backgroundImage:c.backgroundImage,
      borderTopWidth:c.borderTopWidth,
      borderLeftWidth:c.borderLeftWidth,
      outlineWidth:c.outlineWidth,
      printColorAdjust:c.printColorAdjust||c.webkitPrintColorAdjust||'',
      refBackground:r.backgroundColor,
      refColor:r.color,
      refBorderWidth:r.borderTopWidth
    };
    cover.remove();
    return out;
  });

  expect(style.backgroundImage).toContain('rgb(29, 78, 216)');
  expect(style.backgroundImage).toContain('rgb(96, 165, 250)');
  expect(Number.parseFloat(style.borderTopWidth)).toBeGreaterThan(50);
  expect(Number.parseFloat(style.borderLeftWidth)).toBeGreaterThan(30);
  expect(Number.parseFloat(style.outlineWidth)).toBeGreaterThan(5);
  expect(style.printColorAdjust).toBe('exact');
  expect(style.refBackground).toBe('rgb(250, 204, 21)');
  expect(style.refColor).toBe('rgb(17, 24, 39)');
  expect(Number.parseFloat(style.refBorderWidth)).toBeGreaterThan(10);
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


test('RC1169 P0: Nicht-Admin sieht in Benutzer keine Diagnose und erhält serverseitig 403',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop'||process.env.EXPORTHUB_E2E_LIVE!=='1','Echter Nicht-Admin-Nachweis läuft einmal live im TESTSERVICE.');
  const token=String(process.env.EXPORTHUB_E2E_NONADMIN_SESSION_TOKEN||'').trim();
  const userB64=String(process.env.EXPORTHUB_E2E_NONADMIN_USER_B64||'').trim();
  const runId=String(process.env.EXPORTHUB_E2E_RUN_ID||'').trim();
  expect(token,'Nicht-Admin-Sessiontoken fehlt').toBeTruthy();
  expect(userB64,'Nicht-Admin-Benutzer fehlt').toBeTruthy();
  const user=JSON.parse(Buffer.from(userB64,'base64').toString('utf8'));
  expect(user.globalAdmin).toBe(false);
  expect(user.isGlobalAdmin).not.toBe(true);
  expect(user.permissions||[]).not.toContain('*');

  const base=new URL(String(process.env.EXPORTHUB_E2E_BASE_URL||''));
  await page.context().addCookies([{
    name:'eh_session',value:token,domain:base.hostname,path:'/api',
    httpOnly:true,secure:true,sameSite:'Strict'
  }]);
  await page.addInitScript(({token,user,runId})=>{
    sessionStorage.setItem('exporthub_rc301_tab_session',JSON.stringify({
      token,user,deviceId:'e2e-playwright-nonadmin',view:'dashboard',savedAt:Date.now(),version:'RC1173',_e2eRunId:runId
    }));
  },{token,user,runId});

  const runtime=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);

  const current=await page.evaluate(()=>typeof window.__EXPORTHUB_GET_CURRENT_USER__==='function'?window.__EXPORTHUB_GET_CURRENT_USER__():null);
  expect(current&&current.globalAdmin).not.toBe(true);
  expect(current&&current.isGlobalAdmin).not.toBe(true);

  // Die Benutzer-/Rechteansicht darf für Nicht-Admins vollständig verborgen sein.
  // Falls setView einen direkten Aufruf akzeptiert, darf darin trotzdem keine Diagnose erscheinen.
  await page.evaluate(()=>{
    try{if(typeof window.setView==='function')window.setView('rights')}catch(_){}
  });
  await page.waitForTimeout(250);
  await expect(page.locator('[data-view="diagnostics"]:visible')).toHaveCount(0);
  await expect(page.locator('#rc1013-diagnostics-enhanced')).toHaveCount(0);
  await expect(page.locator('#content')).not.toContainText(/Fehlerdiagnose\s*&\s*automatische Behebung/i);

  const denied=await page.evaluate(async tokenValue=>{
    const response=await fetch('/api/exporthub-state?mode=diagnostics-read',{
      method:'GET',credentials:'same-origin',cache:'no-store',
      headers:{
        'Accept':'application/json',
        'X-ExportHUB-Token':tokenValue,
        'X-ExportHUB-Session':tokenValue,
        'Authorization':'Bearer '+tokenValue,
        'X-ExportHUB-Environment':'testservice'
      }
    });
    return{status:response.status,data:await response.json().catch(()=>({}))};
  },token);
  expect(denied.status).toBe(403);
  expect(denied.data&&denied.data.code).toBe('ADMIN_REQUIRED');

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
    if(!sh)return null;
    const key=String(sh.ref||sh.reference||sh.referenceNumber||sh.id||'').trim();
    if(!key)return null;
    sh.customerAvisPickupDate='2026-09-18';
    sh.avisPickupDate='2026-09-18';
    sh.customerAvisPickupTimeFrom='10:00';
    sh.avisPickupTimeFrom='10:00';
    sh.customerAvisPickupTimeTo='12:00';
    sh.avisPickupTimeTo='12:00';
    sh.customerConfirmed=true;
    sh.customerConfirmedVia='customer-avis';
    return{key:key};
  });
  expect(seeded&&seeded.key).toBeTruthy();

  await openExportHubView(page,'shipmentoverview',['Sendungsübersicht','Sendungen'],/Sendungsübersicht|Sendungen/i,{allowProgrammaticFallback:true});
  const card=page.locator('article').filter({hasText:seeded.key}).first();
  await expect(card).toBeVisible({timeout:10_000});
  const pickup=card.locator('[data-rc1127-customer-pickup]').first();
  await expect(pickup).toBeVisible({timeout:10_000});
  await expect(pickup).toHaveText('Kunden-Abholung: 18.09.2026 · 10:00–12:00');
  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  await assertRuntimeClean(runtime,testInfo);
});
