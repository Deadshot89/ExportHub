import {test,expect} from '@playwright/test';
import {
  attachRuntimeGuards,waitReady,openExportHubView,
  assertNoSourceLeak,assertNoHorizontalOverflow,assertRuntimeClean
} from '../helpers/exporthub-browser.mjs';

const CORE=[
  ['dashboard',['Dashboard'],'Dashboard'],
  ['tasks',['Aufgaben'],'Aufgaben'],
  ['notifications',['Benachrichtigungen'],'Benachrichtigungen'],
  ['pickupcalendar',['Abholkalender'],'Abhol'],
  ['shipment',['Sendung erstellen','Neue Sendung'],'Kunde|Empfänger'],
  ['shipmentoverview',['Sendungsübersicht'],'Sendung'],
  ['customerfolder',['Kundenordner'],'Kunden'],
  ['pallet',['Palettenkonto'],'Paletten'],
  ['shippingcosts',['Versandkosten'],'Versand'],
  ['sop',['SOP & Portale','SOP'],'SOP'],
  ['academy',['Academy'],'Academy|Prüfung']
];

const DESKTOP_EXTRA=[
  ['shipmentview',['Sendungsansicht'],'Sendung'],
  ['documents',['Ladeliste & CMR','Ladeliste','CMR'],'Ladeliste|CMR'],
  ['warehouse',['Lager'],'Lager'],
  ['customs',['Zollwissen'],'Zoll'],
  ['exams',['Prüfungen'],'Prüfung']
];

async function openApp(page){
  const target=process.env.EXPORTHUB_E2E_URL||'/demo.html';
  await page.goto(target,{waitUntil:'domcontentloaded'});
  await waitReady(page);
}

test('P0 Navigation öffnet die richtige ExportHUB-Ansicht',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page);
  await openApp(page);
  const full=testInfo.project.name==='laptop'||testInfo.project.name==='desktop';
  const views=full?CORE.concat(DESKTOP_EXTRA):CORE;
  for(const [module,labels,required] of views){
    await openExportHubView(page,module,labels,required);
    await assertNoSourceLeak(page);
    await assertNoHorizontalOverflow(page);
  }
  assertRuntimeClean(runtime);
});

test('Sendung erstellen zeigt echte Erfassungsmaske statt Historie-only',async({page})=>{
  const runtime=attachRuntimeGuards(page);
  await openApp(page);
  await openExportHubView(page,'shipment',['Sendung erstellen','Neue Sendung'],'Kunde|Empfänger');
  await expect(page.locator('#rc363BlockDocuments')).toBeVisible();
  await expect(page.locator('#rc543MailArea')).toBeVisible();
  await expect(page.locator('#content')).toContainText(/Colli|Lademeter/i);
  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  assertRuntimeClean(runtime);
});
