import {test,expect} from '@playwright/test';
import {appEntry,waitReady} from '../helpers/exporthub-browser.mjs';
import {installHitProbe} from '../helpers/qa-hit-targets.mjs';

// QA-Bericht 13.11.2026 F03: Layout-Tests prüften nur horizontales Overflow.
// Dieser Test prüft in allen acht Designs und allen fünf Projekt-Viewports,
// dass sichtbare Klickziele zentral erreichbar sind und nicht von festen
// Leisten, Toasts oder schwebenden Schaltflächen dauerhaft verdeckt werden.
const DESIGNS=['classic','premium','neu','frost','graphit','azur','stahl','polar'];
const VIEWS=['dashboard','notifications','tasks','planning','pickupcalendar','shipment','shipmentoverview','abd','customerfolder','sop','history','settings'];
// Fester Freitag mit fälligen Demo-Aufgaben, damit die Aufgaben-Erinnerung reproduzierbar erscheint.
const CLOCK=new Date('2026-11-13T14:00:00+01:00');

async function openDemo(page){
  await page.clock.install({time:CLOCK});
  await page.addInitScript(installHitProbe);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
}

async function setDesign(page,design){
  await page.evaluate(value=>window.ExportHUBDesignSwitcher.apply(value),design);
  await expect.poll(()=>page.evaluate(()=>window.ExportHUBDesignSwitcher.current())).toBe(design);
}

for(const design of DESIGNS){
  test(`QA F03: keine dauerhaft verdeckten Klickziele · ${design}`,async({page})=>{
    test.setTimeout(120_000);
    await openDemo(page);
    await setDesign(page,design);
    const findings=[];
    for(const view of VIEWS){
      const opened=await page.evaluate(v=>{
        if(typeof window.setView!=='function')return false;
        if(typeof window.canView==='function'&&!window.canView(v))return false;
        window.setView(v);return true;
      },view);
      if(!opened)continue;
      await page.waitForTimeout(350);
      // Die Erinnerung ist ein schließbarer Hinweis; ihr Verhältnis zu "SOP / Hilfe" prüft der Test unten.
      await page.evaluate(()=>{const host=document.getElementById('tpv2ReminderToast');if(host)host.style.display='none'});
      for(const row of await page.evaluate(()=>window.__qaHitTargets()))findings.push({view,...row});
    }
    expect(findings,`Verdeckte Klickziele in ${design}: ${JSON.stringify(findings)}`).toEqual([]);
  });
}

test('QA F03: Aufgaben-Erinnerung verdeckt "SOP / Hilfe" nicht',async({page})=>{
  await openDemo(page);
  await page.clock.runFor(5_000);
  const toast=page.locator('#tpv2ReminderToast section');
  await expect(toast).toBeVisible({timeout:15_000});
  for(const design of ['classic','polar','azur']){
    await setDesign(page,design);
    const reachable=await page.evaluate(()=>{
      const launcher=document.getElementById('rc1705-sop-launcher');
      if(!launcher||getComputedStyle(launcher).display==='none')return 'kein Launcher';
      const r=launcher.getBoundingClientRect();
      const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      return hit===launcher||launcher.contains(hit)?'ok':String(hit&&(hit.id||hit.className)||'null');
    });
    expect(reachable,`SOP / Hilfe in ${design} verdeckt`).toMatch(/^(ok|kein Launcher)$/);
  }
});
