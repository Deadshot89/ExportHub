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
        const cover=document.querySelector('.rc390-cover,.rc352-cover');
        const cs=cover?getComputedStyle(cover):null;
        window.__RC1190_PRINT_CAPTURE__={
          title:String(document.title||''),
          text:String(document.body&&document.body.innerText||''),
          html:String(document.documentElement&&document.documentElement.outerHTML||''),
          coverStyle:cs?{
            backgroundColor:cs.backgroundColor,
            backgroundImage:cs.backgroundImage,
            borderTopWidth:cs.borderTopWidth,
            borderRightWidth:cs.borderRightWidth,
            borderBottomWidth:cs.borderBottomWidth,
            borderLeftWidth:cs.borderLeftWidth,
            borderColor:cs.borderTopColor,
            outlineStyle:cs.outlineStyle
          }:null,
          load1Count:document.querySelectorAll('.rc390-load.rc576-load1').length,
          load2Count:document.querySelectorAll('.rc390-load.rc576-load2').length,
          cmrCount:document.querySelectorAll('.rc390-cmr-wrap').length,
          cmrLabels:Array.from(document.querySelectorAll('.rc390-cmr-copy')).map(node=>String(node.textContent||'').trim()),
          printDocuments:Array.from(document.querySelectorAll('.rc390-page,.rc352-page,.rc390-cmr-wrap')).map(node=>({
            textLength:String(node.innerText||node.textContent||'').trim().length,
            scrollHeight:Number(node.scrollHeight||0),
            clientHeight:Number(node.clientHeight||0),
            scrollWidth:Number(node.scrollWidth||0),
            clientWidth:Number(node.clientWidth||0)
          }))
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
  expect(capture.coverStyle).toBeTruthy();
  expect(capture.coverStyle.backgroundColor).toBe('rgb(248, 250, 252)');
  expect(capture.coverStyle.backgroundImage).toBe('none');
  expect(parseFloat(capture.coverStyle.borderTopWidth)).toBeGreaterThanOrEqual(18);
  expect(parseFloat(capture.coverStyle.borderTopWidth)).toBeLessThanOrEqual(20);
  for(const side of ['borderRightWidth','borderBottomWidth','borderLeftWidth']){
    expect(parseFloat(capture.coverStyle[side])).toBeGreaterThanOrEqual(10);
    expect(parseFloat(capture.coverStyle[side])).toBeLessThanOrEqual(12);
  }
  expect(capture.coverStyle.borderColor).toBe('rgb(51, 65, 85)');
  expect(capture.coverStyle.outlineStyle).toBe('none');
  expect(capture.html).toMatch(/data-rc1203-cover-remark="1"/i);
  expect(capture.text).toContain('Bemerkung');
  expect(capture.text).toContain('RC1203 Demo-Bemerkung');
  expect(capture.text).toMatch(/Ladeliste/i);
  expect(capture.text).toMatch(/(?:Ladeliste\s*1|\bL1\b)/i);
  expect(capture.text).toMatch(/(?:Ladeliste\s*2|\bL2\b)/i);
  expect(capture.text).toMatch(/CMR/i);
  expect(capture.load1Count).toBe(1);
  expect(capture.load2Count).toBe(1);
  expect(capture.cmrCount).toBe(4);
  expect(capture.cmrLabels.join(' ')).toMatch(/CMR\s*4\s*\/\s*4/i);
  expect(capture.text).toMatch(/Warenbeschreibung/i);
  expect(capture.printDocuments.length).toBe(7);
  expect(capture.printDocuments.every(p=>p.textLength>40),'Gesamtdruck enthält ein leeres oder praktisch leeres Druckdokument').toBe(true);
  expect(capture.printDocuments.every(p=>p.clientHeight<=0||p.scrollHeight<=p.clientHeight+4),'Gesamtdruck enthält vertikal abgeschnittene Inhalte').toBe(true);
  expect(capture.printDocuments.every(p=>p.clientWidth<=0||p.scrollWidth<=p.clientWidth+4),'Gesamtdruck enthält horizontal abgeschnittene Inhalte').toBe(true);

  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  for(const guard of guards)await assertRuntimeClean(guard,testInfo);
});

test('RC1275 P1: Europaletten erscheinen im echten Ladelisten-Druck als Palettenkonto-Ausgang',async({page,context},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Palettenkonto-Druckabnahme läuft einmal auf dem Laptop-Profil.');
  test.setTimeout(60_000);

  await context.addInitScript(()=>{
    window.__RC1275_PALLET_PRINT_CAPTURE__=null;
    const capture=()=>{try{window.__RC1275_PALLET_PRINT_CAPTURE__={
      text:String(document.body&&document.body.innerText||''),
      html:String(document.documentElement&&document.documentElement.outerHTML||'')
    }}catch(_){}};
    try{Object.defineProperty(window,'print',{configurable:true,writable:true,value:capture})}catch(_){try{window.print=capture}catch(__){}}
  });

  const guard=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'documents',['Ladeliste & CMR','Dokumente & CMR','Dokumente','CMR'],/Ladeliste|CMR|Dokument/i,{allowProgrammaticFallback:true});

  const shipmentSelect=page.getByRole('combobox',{name:'Sendung auswählen'}).first();
  await expect(shipmentSelect).toBeVisible({timeout:10_000});
  const optionLabels=await shipmentSelect.locator('option').allTextContents();
  const palletShipment=optionLabels.find(label=>/DEMO01|Nord/i.test(label));
  expect(palletShipment,'Fake-Europaletten-Sendung DEMO01 fehlt im lokalen Demo-Artefakt').toBeTruthy();
  await shipmentSelect.selectOption({label:palletShipment});
  await expect(page.locator('#content')).toContainText(/DEMO01/,{timeout:10_000});

  let printButton=page.locator('[data-index352-action="print-all"]').first();
  if(!(await printButton.count())||!(await printButton.isVisible().catch(()=>false))){
    printButton=page.locator('button,a,[role="button"]').filter({hasText:/Gesamtausgabe\s*drucken|Gesamtdruck/i}).first();
  }
  await expect(printButton).toBeVisible({timeout:10_000});
  await printButton.click({timeout:10_000});

  let capture=null;
  await expect.poll(async()=>{
    for(const p of context.pages()){
      for(const frame of p.frames()){
        const value=await frame.evaluate(()=>window.__RC1275_PALLET_PRINT_CAPTURE__||null).catch(()=>null);
        if(value&&String(value.html||'').length>500){capture=value;return value.html.length}
      }
    }
    await sleep(100);
    return 0;
  },{timeout:20_000,message:'Palettenkonto-Druck hat keinen druckbaren Dokumentkontext erzeugt'}).toBeGreaterThan(500);

  expect(capture.text).toMatch(/Palettenkonto/i);
  expect(capture.text).toMatch(/Ausgang:\s*2\s*Europaletten/i);
  expect(capture.html).toMatch(/rc1095-pallet-account/i);
  await assertRuntimeClean(guard,testInfo);
});

