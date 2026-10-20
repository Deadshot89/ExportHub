import {test,expect} from '@playwright/test';
import {
  appEntry,
  waitReady,
  openExportHubView,
  assertNoSourceLeak,
  assertNoHorizontalOverflow,
  attachRuntimeGuards,
  assertRuntimeClean,
  installE2ESession
} from '../helpers/exporthub-browser.mjs';

test.beforeEach(async({page})=>{
  if(process.env.EXPORTHUB_E2E_LIVE==='1')await installE2ESession(page);
});

function numberFrom(text){
  const m=String(text||'').match(/(?:ALLE\s+)?OFFENEN\s+AUFGABEN\s*[:·-]?\s*(\d+)/i);
  return m?Number(m[1]):null;
}

test('RC1124 P0: Benachrichtigungen enthalten keine leeren Ghost-Aufgaben und Zähler stimmt',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'notifications',['Benachrichtigungen','Benachrichtigungscenter'],/Benachrichtig|Aufgaben/i,{allowProgrammaticFallback:true});

  const center=page.locator('#index236NotificationCenter');
  await expect(center).toBeVisible();

  const cards=center.locator('.rc229-task-card.rc628-unified-task, .task-card, .index236-item');
  const cardCount=await cards.count();
  const entries=[];
  for(let i=0;i<cardCount;i++){
    const card=cards.nth(i);
    const title=await card.locator('.index236-item-head h3, h1,h2,h3,h4,[data-title],.title').first().innerText().catch(()=>card.innerText());
    const id=await card.locator('[data-index236-action="open-task"][data-id]').first().getAttribute('data-id').catch(()=>null);
    const context=await card.locator('.index236-item-head p').first().innerText().catch(()=>'');
    entries.push({
      title:String(title||'').trim().split('\n')[0].trim(),
      id:String(id||'').trim(),
      context:String(context||'').trim()
    });
  }
  for(const item of entries){
    expect(item.title,'Ghost-Aufgabe mit generischem Titel gefunden').not.toMatch(/^(?:Aufgabe|Task)$/i);
    expect(item.id,'Aufgabe ohne stabile eindeutige ID gefunden').not.toBe('');
  }

  const centerText=await center.innerText();
  const bodyText=await page.locator('body').innerText();
  const countMarker=page.locator('[data-index236-notification-count], #index236NotificationCount, .index236-notification-count').first();
  const dataCount=await countMarker.getAttribute('data-index236-notification-count').catch(()=>null);
  const fallbackCount=await countMarker.getAttribute('data-count').catch(()=>null);
  const markerText=await countMarker.innerText().catch(()=>'');
  const metric=/^\d+$/.test(String(dataCount||''))?Number(dataCount):
    /^\d+$/.test(String(fallbackCount||''))?Number(fallbackCount):
    numberFrom(markerText)??numberFrom(centerText)??numberFrom(bodyText);
  expect(metric,'Metrik "Offene Aufgaben" fehlt').not.toBeNull();
  expect(cardCount,'Gerenderte Aufgabenmenge weicht vom Zähler ab').toBe(metric);

  // Wiederkehrende Aufgaben besitzen absichtlich denselben Titel an unterschiedlichen Tagen.
  // Eine fachliche Dublette benötigt die gleiche Aufgabe (ID) oder den gleichen Titel
  // UND denselben Termin, Verantwortlichen und Sendungsbezug.
  const normalize=x=>String(x||'').toLocaleLowerCase('de-DE').replace(/\s+/g,' ').trim();
  const ids=entries.map(x=>x.id);
  const identities=entries.map(x=>normalize(x.title)+'|'+normalize(x.context));
  expect(new Set(ids).size,'Die gleiche Aufgaben-ID wird mehrfach im Benachrichtigungscenter angezeigt').toBe(ids.length);
  expect(new Set(identities).size,'Doppelte fachlich identische Benachrichtigungen (Titel + Fälligkeit + Zuordnung) gefunden').toBe(identities.length);

  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  await assertRuntimeClean(runtime,testInfo);
});
