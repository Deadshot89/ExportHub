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
  const titles=[];
  for(let i=0;i<cardCount;i++){
    const card=cards.nth(i);
    const title=await card.locator('h1,h2,h3,h4,[data-title],.title').first().innerText().catch(()=>card.innerText());
    titles.push(String(title||'').trim().split('\n')[0].trim());
  }
  for(const title of titles){
    expect(title,'Ghost-Aufgabe mit generischem Titel gefunden').not.toMatch(/^(?:Aufgabe|Task)$/i);
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

  const normalized=titles.map(x=>x.toLocaleLowerCase('de-DE')).filter(Boolean);
  expect(new Set(normalized).size,'Doppelte fachlich identische Benachrichtigungen gefunden').toBe(normalized.length);

  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  await assertRuntimeClean(runtime,testInfo);
});
