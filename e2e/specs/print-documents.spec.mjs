import {test,expect} from '@playwright/test';
import {
  appEntry,
  waitReady,
  openExportHubView,
  assertNoSourceLeak,
  assertNoHorizontalOverflow,
  attachRuntimeGuards,
  assertRuntimeClean
} from '../helpers/exporthub-browser.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('RC1190 P2: Gesamtdruck erzeugt im echten Browser einen nicht-leeren vollständigen Dokumentkontext',async({page,context},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Gesamtdruck-Abnahme läuft einmal auf dem Laptop-Profil.');
  test.setTimeout(60_000);

  await context.addInitScript(()=>{
    window.__RC1190_PRINT_CAPTURE__=null;
    const capture=()=>{
      try{
        window.__RC1190_PRINT_CAPTURE__={
          title:String(document.title||''),
          text:String(document.body&&document.body.innerText||''),
          html:String(document.documentElement&&document.documentElement.outerHTML||'')
        };
      }catch(_){}
    };
    try{
      Object.defineProperty(window,'print',{configurable:true,writable:true,value:capture});
    }catch(_){
      try{window.print=capture}catch(__){}
    }
  });

  const guards=[attachRuntimeGuards(page,testInfo)];
  context.on('page',popup=>guards.push(attachRuntimeGuards(popup,testInfo)));

  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'documents',['Ladeliste & CMR','Dokumente & CMR','Dokumente','CMR'],/Ladeliste|CMR|Dokument/i,{allowProgrammaticFallback:true});

  const shipmentSelect=page.getByRole('combobox',{name:'Sendung auswählen'}).first();
  await expect(shipmentSelect).toBeVisible({timeout:10_000});
  const optionLabels=await shipmentSelect.locator('option').allTextContents();
  const benelux=optionLabels.find(label=>/DEMO02|Benelux/i.test(label));
  expect(benelux,'Fake-Benelux-Sendung DEMO02 fehlt im lokalen Demo-Artefakt').toBeTruthy();
  await shipmentSelect.selectOption({label:benelux});
  await expect(page.locator('#content')).toContainText(/DEMO02/,{timeout:10_000});
  await expect(page.locator('#content')).toContainText(/Benelux|Niederlande|NL/i,{timeout:10_000});

  const remarkApplied=await page.evaluate(()=>{
    const s=typeof window.__EXPORTHUB_GET_STATE__==='function'?(window.__EXPORTHUB_GET_STATE__()||{}):{};
    const list=[s.shipment,s.currentShipment,s.selectedShipment,...(Array.isArray(s.shipments)?s.shipments:[])].filter(Boolean);
    let changed=0;
    for(const sh of list){
      const ref=String(sh.ref||sh.reference||sh.shipmentRef||'').trim().toUpperCase();
      if(ref==='DEMO02'){sh.comments='RC1203 TEST BEMERKUNG – sichtbar auf dem Deckblatt';changed++}
    }
    return changed;
  });
  expect(remarkApplied,'DEMO02 konnte für die Deckblatt-Bemerkungsprüfung nicht gefunden werden').toBeGreaterThan(0);

  let printButton=page.locator('[data-index352-action="print-all"]').first();
  if(!(await printButton.count())||!(await printButton.isVisible().catch(()=>false))){
    printButton=page.locator('button,a,[role="button"]').filter({hasText:/Gesamtausgabe\s*drucken|Gesamtdruck/i}).first();
  }
  await expect(printButton,'Gesamtdruck-Aktion ist aus der UI nicht erreichbar').toBeVisible({timeout:10_000});

  await printButton.click({timeout:10_000});

  let capture=null;
  await expect.poll(async()=>{
    for(const p of context.pages()){
      for(const frame of p.frames()){
        const value=await frame.evaluate(()=>window.__RC1190_PRINT_CAPTURE__||null).catch(()=>null);
        if(value&&String(value.html||'').length>500){
          capture=value;
          return String(value.html||'').length;
        }
      }
    }
    await sleep(100);
    return 0;
  },{timeout:20_000,message:'Gesamtdruck hat keinen druckbaren Dokumentkontext erzeugt'}).toBeGreaterThan(500);

  expect(capture).toBeTruthy();
  expect(capture.html.length).toBeGreaterThan(1000);
  expect(capture.text).toContain('DEMO02');
  expect(capture.html).toMatch(/\brc390-cover\b/i);
  expect(capture.html).toMatch(/data-rc1203-cover-enhanced="1"/i);
  expect(capture.html).toMatch(/border:\s*12mm\s+solid\s+(?:rgb\(11,\s*31,\s*68\)|#0b1f44)/i);
  expect(capture.html).toMatch(/data-rc1203-cover-remark="1"/i);
  expect(capture.text).toContain('Bemerkung');
  expect(capture.text).toContain('RC1203 TEST BEMERKUNG');
  expect(capture.text).toMatch(/Ladeliste/i);
  expect(capture.text).toMatch(/CMR/i);
  expect(capture.text).toMatch(/Warenbeschreibung/i);

  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  for(const guard of guards)await assertRuntimeClean(guard,testInfo);
});
