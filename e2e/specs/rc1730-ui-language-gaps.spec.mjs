import {test,expect} from '@playwright/test';
import {appEntry,waitReady} from '../helpers/exporthub-browser.mjs';

// RC1730 (Prüfung 30.10.2026): every visible German UI label must change when English is chosen.
// The page is read in German, then in English; a text that stays exactly the same is a language gap –
// it is missing in assets/i18n/*.json (add it to all six packs, a number as legacyPattern.* with {{count}}).
// Content areas (release notes, SOP texts, Academy, task names, history, archive) and the diagnostics log
// are left out on purpose: they are data, not interface.
const VIEWS=['dashboard','tasks','packnotifications','pickupcalendar','notifications','shipment','abd','shipmentoverview','shipmentsearch','cmr','warehouse','customerfolder','pallet','shippingcosts','customs','ideas','reports','release','rights','teamfile','privacy','settings'];

// identical in English on purpose (brand, product names, technical terms, ids)
const SAME_IN_ENGLISH=new Set(['ExportHUB','Dashboard','Administration','Backup','Import','Status','Name','(Optional)','optional','Route','Zone','Tests','Reports','Academy','Audit','Logout','Browser','Sales','Management','Administrator','Update ExportHUB','ABD:','DOM & Fast-View','no-referrer / noindex','ABCD123456','0000','📊 Dashboard']);
// demo data, people, ids, file names, numbers with units; dates are formatted separately (not by the packs)
const DEMO_PEOPLE=new Set(['Demo Administrator','Sevastian Marcu','Daniel Ollmann']);
const isData=text=>DEMO_PEOPLE.has(text)||/DEMO\d|Fake|example\.invalid|demo[.-]|\.pdf$|^\/|^Code \d+$|^Lane \d+$|^Fuel [\d.,]+ %$|^[a-z]+$|^[A-Z]\d{3,} · [A-Z]{2}$|^[\d\s.,:%€+–-]+(kg|cm|m)?$|^EURO Pal$|^[A-Z0-9]{2,4}$|^(?=.*\d)[A-Z0-9]{5,8}$|^(Mo|Di|Mi|Do|Fr|Sa|So)\., \d/.test(text);

function collect(page){
  return page.evaluate(()=>{
    const out=new Set();
    const visible=el=>el&&el.offsetParent!==null&&!el.closest('[data-i18n-ignore],textarea,script,style,code,pre,option');
    for(const root of document.querySelectorAll('.sidebar,.topbar,#content')){
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()){
        const node=walker.currentNode,text=node.nodeValue.replace(/\s+/g,' ').trim();
        if(text.length<2||!/[a-zäöüß]{2}/i.test(text)||!visible(node.parentElement))continue;
        out.add(text);
      }
      for(const el of root.querySelectorAll('[placeholder]'))if(visible(el)&&el.placeholder.trim())out.add(el.placeholder.trim());
    }
    return [...out];
  });
}
async function open(page,view){
  await page.evaluate(view=>window.setView(view),view);
  await page.waitForTimeout(700);
}
async function switchLanguage(page,lang){
  await page.selectOption('#languageSelect',lang);
  await expect.poll(()=>page.evaluate(()=>window.ExportHUBI18n.language()),{timeout:10_000}).toBe(lang);
}

test('RC1730: sichtbare Bedienelemente haben in Englisch keine deutschen Reste',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Sprachlücken werden einmal im echten Chromium geprüft.');
  test.setTimeout(240_000);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await switchLanguage(page,'de');

  const german={};
  for(const view of VIEWS){await open(page,view);german[view]=await collect(page)}

  await switchLanguage(page,'en');
  const gaps={};
  for(const view of VIEWS){
    await open(page,view);
    const source=german[view].filter(text=>!SAME_IN_ENGLISH.has(text)&&!isData(text));
    // server-loaded parts (e.g. loader PINs) are translated once they arrive
    let left=[];
    await expect.poll(async()=>{const now=new Set(await collect(page));left=source.filter(text=>now.has(text));return left.length},{timeout:4_000}).toBe(0).catch(()=>{});
    if(left.length)gaps[view]=left;
  }
  if(Object.keys(gaps).length)await testInfo.attach('sprachluecken.json',{body:JSON.stringify(gaps,null,1),contentType:'application/json'});
  expect(gaps,'Deutsche Texte ohne Übersetzung – in assets/i18n/*.json ergänzen').toEqual({});
});
