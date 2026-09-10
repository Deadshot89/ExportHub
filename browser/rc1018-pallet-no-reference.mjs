import {chromium} from 'playwright';

const BASE=process.env.RC1018_BROWSER_URL||'http://127.0.0.1:4173/demo.html';
function assert(ok,message){if(!ok)throw new Error(message);}
const pause=ms=>new Promise(r=>setTimeout(r,ms));

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
const page=await context.newPage();
const dialogs=[];
page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
try{
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.__EXPORTHUB_READY__?.ready===true,{timeout:20000});
  const opened=await page.evaluate(()=>{try{window.setView('pallet');return true}catch(_){return false}});
  assert(opened,'Palettenkonto konnte nicht geöffnet werden.');
  await page.waitForSelector('#rc542PalCount',{state:'visible',timeout:10000});

  const partySelected=await page.evaluate(()=>{
    const s=typeof window.__EXPORTHUB_GET_STATE__==='function'?window.__EXPORTHUB_GET_STATE__():window.ExportHUBClean?.state||window.appState||{};
    if(s.rc542PalletParty)return true;
    const candidate=Array.from(document.querySelectorAll('[onclick]')).find(el=>/rc542.*(?:party|konto|select)/i.test(el.getAttribute('onclick')||''));
    if(candidate){candidate.click();return true}
    return false;
  });
  assert(partySelected,'Kein Palettenkonto/Partner für den Browsertest auswählbar.');
  await pause(250);

  const initial=await page.evaluate(()=>{
    const s=typeof window.__EXPORTHUB_GET_STATE__==='function'?window.__EXPORTHUB_GET_STATE__():window.ExportHUBClean?.state||window.appState||{};
    return Array.isArray(s.palletAccount)?s.palletAccount.length:0;
  });

  await page.locator('#rc542PalRef').fill('');
  await page.locator('#rc542PalCount').fill('2');
  dialogs.length=0;
  await page.getByRole('button',{name:'Buchung speichern',exact:true}).click();
  await pause(700);
  const afterIn=await page.evaluate(()=>{
    const s=typeof window.__EXPORTHUB_GET_STATE__==='function'?window.__EXPORTHUB_GET_STATE__():window.ExportHUBClean?.state||window.appState||{};
    return Array.isArray(s.palletAccount)?s.palletAccount.length:0;
  });
  assert(!dialogs.some(m=>/referenz/i.test(m)),`Eingang verlangt weiterhin Referenz: ${dialogs.join(' | ')}`);
  assert(afterIn===initial+1,`Eingang ohne Referenz wurde nicht gebucht (${initial} -> ${afterIn}); Dialoge: ${dialogs.join(' | ')}`);

  await page.locator('#rc542PalOut').click();
  await page.locator('#rc542PalRef').fill('');
  await page.locator('#rc542PalCount').fill('1');
  dialogs.length=0;
  await page.getByRole('button',{name:'Buchung speichern',exact:true}).click();
  await pause(700);
  const afterOut=await page.evaluate(()=>{
    const s=typeof window.__EXPORTHUB_GET_STATE__==='function'?window.__EXPORTHUB_GET_STATE__():window.ExportHUBClean?.state||window.appState||{};
    return Array.isArray(s.palletAccount)?s.palletAccount.length:0;
  });
  assert(!dialogs.some(m=>/referenz/i.test(m)),`Ausgang verlangt weiterhin Referenz: ${dialogs.join(' | ')}`);
  assert(afterOut===afterIn+1,`Ausgang ohne Referenz wurde nicht gebucht (${afterIn} -> ${afterOut}); Dialoge: ${dialogs.join(' | ')}`);
  console.log(`Palettenkonto Browservertrag grün: Eingang und Ausgang ohne Referenz gebucht (${initial} -> ${afterOut}).`);
} finally {
  await context.close();
  await browser.close();
}
