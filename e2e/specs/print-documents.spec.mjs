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

async function selectLoadingListShipment(page,query,expected){
  const search=page.getByRole('searchbox',{name:'Ladeliste suchen'}).first();
  await expect(search).toBeVisible({timeout:10_000});
  const nativeSelect=page.getByRole('combobox',{name:'Sendung auswählen'}).first();
  await expect(nativeSelect).toBeHidden({timeout:10_000});
  await search.fill(query);
  const result=page.locator('[data-rc1283-result]').filter({hasText:expected}).first();
  await expect(result).toBeVisible({timeout:10_000});
  await result.click();
  await expect(page.locator('[data-rc1283-selected]')).toContainText(expected,{timeout:10_000});
  for(const action of ['open','print','download']){
    const button=page.locator('[data-rc1283-action="'+action+'"]');
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
  }
  return search;
}

test('RC1283 P2: Ladelistensuche findet Referenz, Kunde, Anhang und Bemerkung',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Ladelisten-Suche wird einmal im echten Browser geprüft.');
  const guard=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'documents',['Ladeliste & CMR','Dokumente & CMR','Dokumente','CMR'],/Ladeliste|CMR|Dokument/i,{allowProgrammaticFallback:true});
  const search=page.getByRole('searchbox',{name:'Ladeliste suchen'}).first();
  await expect(search).toBeVisible({timeout:10_000});
  await expect(page.getByRole('combobox',{name:'Sendung auswählen'}).first()).toBeHidden();
  for(const query of ['DEMO02','Benelux','Fake_Lieferschein_DEMO02.pdf','RC1203 Demo-Bemerkung']){
    await search.fill(query);
    await expect(page.locator('[data-rc1283-result]').filter({hasText:/DEMO02|Benelux/i}).first(),query+' findet DEMO02 nicht').toBeVisible({timeout:10_000});
  }
  await selectLoadingListShipment(page,'DEMO02',/DEMO02|Benelux/i);
  await assertNoHorizontalOverflow(page);
  await assertRuntimeClean(guard,testInfo);
});

test('RC1190 P2: Gesamtdruck erzeugt im echten Browser einen nicht-leeren vollständigen Dokumentkontext',async({page,context},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Gesamtdruck-Abnahme läuft einmal auf dem Laptop-Profil.');
  test.setTimeout(60_000);

  await context.addInitScript(()=>{
    window.__RC1190_PRINT_CAPTURE__=null;
    const capture=()=>{
      try{
        const cover=document.querySelector('.rc390-cover,.rc352-cover');
        const cs=cover?getComputedStyle(cover):null;
        const reference=cover&&cover.querySelector('.rc390-cover-ref,[data-rc1203-reference-highlight]');
        const recipient=cover&&cover.querySelector('.rc1203-cover-recipient,[data-rc1203-recipient-highlight]');
        const rs=reference?getComputedStyle(reference):null;
        const rcs=recipient?getComputedStyle(recipient):null;
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
          coverTheme:cover?String(cover.getAttribute('data-rc1281-customer-theme')||''):null,
          referenceStyle:rs?{backgroundColor:rs.backgroundColor,color:rs.color,borderColor:rs.borderTopColor}:null,
          recipientStyle:rcs?{backgroundColor:rcs.backgroundColor,color:rcs.color,borderColor:rcs.borderTopColor}:null,
          packingSlipGrid:(()=>{
            const grid=document.querySelector('[data-rc1293-packing-slip-grid]');
            const slips=grid?Array.from(grid.querySelectorAll('[data-rc1293-packing-slip]')):[];
            const rowTops=[...new Set(slips.map(node=>Math.round(node.getBoundingClientRect().top)))];
            const gs=grid?getComputedStyle(grid):null;
            return{
              count:slips.length,
              rowCount:rowTops.length,
              display:gs&&gs.display,
              scrollWidth:grid?Number(grid.scrollWidth||0):0,
              clientWidth:grid?Number(grid.clientWidth||0):0,
              items:slips.map(node=>{const r=node.getBoundingClientRect();return{text:String(node.textContent||'').trim(),left:r.left,right:r.right,top:r.top,bottom:r.bottom}})
            };
          })(),
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

  await selectLoadingListShipment(page,'DEMO02',/DEMO02|Benelux/i);
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
  expect(capture.coverStyle.backgroundColor).toBe('rgb(255, 255, 255)');
  expect(capture.coverStyle.backgroundImage).toBe('none');
  expect(parseFloat(capture.coverStyle.borderTopWidth)).toBeGreaterThanOrEqual(18);
  expect(parseFloat(capture.coverStyle.borderTopWidth)).toBeLessThanOrEqual(20);
  for(const side of ['borderRightWidth','borderBottomWidth','borderLeftWidth']){
    expect(parseFloat(capture.coverStyle[side])).toBeGreaterThanOrEqual(10);
    expect(parseFloat(capture.coverStyle[side])).toBeLessThanOrEqual(12);
  }
  expect(capture.coverStyle.borderColor).toBe('rgb(51, 65, 85)');
  expect(capture.coverStyle.outlineStyle).toBe('none');
  expect(capture.coverTheme).toBe('customer');
  expect(capture.referenceStyle).toBeTruthy();
  expect(capture.referenceStyle.backgroundColor).toBe('rgb(37, 99, 235)');
  expect(capture.referenceStyle.color).toBe('rgb(255, 255, 255)');
  expect(capture.recipientStyle).toBeTruthy();
  expect(capture.recipientStyle.backgroundColor).toBe('rgb(219, 234, 254)');
  expect(capture.text).toMatch(/Erstellt am:\s*\d{2}\.\d{2}\.\d{4}/);
  expect(capture.html).toMatch(/data-rc1281-created-date="1"/i);
  expect(capture.html).toMatch(/data-rc1203-cover-remark="1"/i);
  expect(capture.text).toContain('Bemerkung');
  expect(capture.text).toContain('RC1203 Demo-Bemerkung');
  expect(capture.packingSlipGrid).toBeTruthy();
  expect(capture.packingSlipGrid.display).toBe('grid');
  expect(capture.packingSlipGrid.count).toBe(7);
  expect(capture.packingSlipGrid.rowCount).toBeGreaterThanOrEqual(2);
  expect(capture.packingSlipGrid.clientWidth<=0||capture.packingSlipGrid.scrollWidth<=capture.packingSlipGrid.clientWidth+2,'Lieferschein-Raster läuft horizontal über').toBe(true);
  expect(capture.packingSlipGrid.items.some(item=>/LS_47110007\.pdf/.test(item.text))).toBe(true);
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


test('RC1281 P2: Essentra-Deckblatt ist weiß mit gelber Referenz und hellgelbem Empfänger',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Essentra-Deckblatt-Farbregel wird einmal im echten Browser geprüft.');
  test.setTimeout(45_000);
  const guard=attachRuntimeGuards(page,testInfo);

  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'documents',['Ladeliste & CMR','Dokumente & CMR','Dokumente','CMR'],/Ladeliste|CMR|Dokument/i,{allowProgrammaticFallback:true});

  await selectLoadingListShipment(page,'DEMO03',/DEMO03|Essentra|Fake Export/i);

  const coverTab=page.locator('[data-index352-doc="cover"]').first();
  await expect(coverTab).toBeVisible({timeout:10_000});
  await coverTab.click();

  const style=await page.locator('#rc565Cover').evaluate(cover=>{
    const reference=cover.querySelector('.rc390-cover-ref,[data-rc1203-reference-highlight]');
    const recipient=cover.querySelector('.rc1203-cover-recipient,[data-rc1203-recipient-highlight]');
    const cs=getComputedStyle(cover),rs=reference?getComputedStyle(reference):null,rcs=recipient?getComputedStyle(recipient):null;
    return{
      theme:String(cover.getAttribute('data-rc1281-customer-theme')||''),
      backgroundColor:cs.backgroundColor,
      referenceBackground:rs&&rs.backgroundColor,
      referenceColor:rs&&rs.color,
      recipientBackground:rcs&&rcs.backgroundColor,
      recipientColor:rcs&&rcs.color,
      text:String(cover.innerText||''),
      created:!!cover.querySelector('[data-rc1281-created-date="1"]')
    };
  });

  expect(style.theme).toBe('essentra');
  expect(style.backgroundColor).toBe('rgb(255, 255, 255)');
  expect(style.referenceBackground).toBe('rgb(250, 204, 21)');
  expect(style.referenceColor).toBe('rgb(17, 24, 39)');
  expect(style.recipientBackground).toBe('rgb(254, 249, 195)');
  expect(style.created).toBe(true);
  expect(style.text).toMatch(/Erstellt am:\s*\d{2}\.\d{2}\.\d{4}/);

  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  await assertRuntimeClean(guard,testInfo);
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

  await selectLoadingListShipment(page,'DEMO01',/DEMO01|Nord/i);
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

