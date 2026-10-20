import {test,expect} from '@playwright/test';
import {appEntry,waitReady} from '../helpers/exporthub-browser.mjs';

// RC1559: uses the real loadHtml template (showSavedCmr) instead of a hand-built fixture.
// The template keeps the old pickup value in .rc390-line and a helper text in .rc390-hint;
// both must disappear once the confirmed pickup value is printed.
const SIGNATURE='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MDAiIGhlaWdodD0iMjAwIj48cGF0aCBkPSJNMTAgMTUwIEM4MCAyMCAxNjAgMTgwIDI2MCA2MCBTNDIwIDE2MCA1OTAgMzAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iNiIvPjwvc3ZnPg==';

async function openLoadingList(page,pickedUp){
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await page.evaluate(async({pickedUp,sig})=>{
    const s=window.__EXPORTHUB_GET_STATE__();const sh=s.shipments[0];
    if(pickedUp)Object.assign(sh,{status:'Abgeholt',freigabe:'Abgeholt',pickedUp:true,driverName:'Balletanu',licensePlate:'KÜN R 764',loaderName:'Daniel Ollmann',
      signatureData:sig,driverSignature:sig,palletOut:2,
      pickupHistory:[{complete:true,driverName:'Balletanu',licensePlate:'KÜN R 764',loaderName:'Daniel Ollmann',confirmedAt:'2026-10-17T08:41:00.000Z',signatureData:sig,returnedEuroPallets:0}]});
    await window.showSavedCmr(sh.id);
  },{pickedUp,sig:SIGNATURE});
  await page.waitForSelector('.rc390-load');
  await page.waitForTimeout(1200);
  await page.emulateMedia({media:'print'});
  await page.waitForTimeout(400);
  return page.evaluate(()=>{
    const load=document.querySelector('.rc390-load');
    const card=label=>{const l=[...load.querySelectorAll('.rc390-label')].find(x=>x.textContent.trim().startsWith(label));return l&&l.closest('.rc390-sign')};
    const out={};
    for(const label of ['Unterschrift Fahrer','Fahrername','Datum / Uhrzeit','Kennzeichen','Verlader','Palettenkonto']){
      const c=card(label);
      out[label]=c?{text:c.innerText.split(/\s+/).join(' ').trim(),height:c.getBoundingClientRect().height,pickup:c.hasAttribute('data-rc1503-pickup-field'),
        lines:[...c.querySelectorAll('.rc390-line,.rc390-hint')].filter(n=>getComputedStyle(n).display!=='none').length}:null;
    }
    return out;
  });
}

test('RC1559: POD aus der echten Ladelisten-Vorlage zeigt jeden Abholwert genau einmal',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','POD-Druck wird einmal im echten Chromium geprüft.');
  test.setTimeout(60_000);
  const cards=await openLoadingList(page,true);
  const once=(label,value)=>{
    expect(cards[label],label+' fehlt').toBeTruthy();
    expect(cards[label].text.split(value).length-1,label+': '+cards[label].text).toBe(1);
    expect(cards[label].lines,label+': alte Linie/Hinweis sichtbar').toBe(0);
  };
  once('Fahrername','Balletanu');
  once('Kennzeichen','KÜN R 764');
  once('Verlader','Daniel Ollmann');
  once('Palettenkonto','Aktueller Stand / Balance');
  once('Palettenkonto','Eingang / Return');
  expect(cards['Palettenkonto'].text).not.toContain('Ausgang: 2');
  // labels are uppercased by CSS, innerText returns the rendered case
  expect(cards['Datum / Uhrzeit'].text.toLowerCase().split('datum / uhrzeit').length-1,'Label doppelt: '+cards['Datum / Uhrzeit'].text).toBe(1);
  expect(cards['Unterschrift Fahrer'].lines).toBe(0);
  for(const label of ['Fahrername','Kennzeichen','Verlader'])expect(cards[label].height,label+' zu hoch').toBeLessThan(80);
});

test('RC1559: Ladeliste vor der Abholung behält Linien und Hinweise zum Unterschreiben',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','POD-Druck wird einmal im echten Chromium geprüft.');
  test.setTimeout(60_000);
  const cards=await openLoadingList(page,false);
  for(const label of ['Unterschrift Fahrer','Fahrername','Kennzeichen']){
    expect(cards[label].pickup,label).toBe(false);
    expect(cards[label].lines,label+': Linie für die Unterschrift fehlt').toBeGreaterThan(0);
  }
});
