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
  const selectedFiles=page.locator('[data-rc1305-selected-files]').first();
  await expect(selectedFiles,'RC1305 Dateidetail fehlt nach Trefferauswahl').toBeVisible();
  await expect(selectedFiles).toContainText('Fake_Lieferschein_DEMO02.pdf');
  const compactMeta=page.locator('[data-rc1283-result]').filter({hasText:/DEMO02|Benelux/i}).first().locator('.rc1283-result-meta');
  await expect(compactMeta,'RC1305 Suchergebnis-Metadaten fehlen').not.toContainText(/\.pdf/i);
  const workspace=await page.locator('#rc1283LoadListSearch').evaluate(el=>{const r=el.getBoundingClientRect(),content=document.querySelector('#content'),c=content&&content.getBoundingClientRect();return{width:r.width,contentWidth:c&&c.width||0,overflow:Number(el.scrollWidth||0)-Number(el.clientWidth||0),gridColumn:getComputedStyle(el).gridColumn}});
  expect(workspace.overflow,'RC1305 Sucharbeitsfläche läuft horizontal über').toBeLessThanOrEqual(2);
  expect(workspace.contentWidth<=0||workspace.width/workspace.contentWidth>=0.7,'RC1305 Sucharbeitsfläche bleibt in der schmalen Seitenspalte').toBe(true);
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
          quickPrintQr:(()=>{
            const qr=document.querySelector('[data-rc1315-print-qr]');
            const coverQr=cover&&cover.querySelector('.rc390-cover-qr,.rc352-cover-qr');
            const refBox=document.querySelector('.rc390-ref,.rc352-ref,[data-rc1281-reference]');
            const code=qr&&qr.querySelector('.rc1315-print-qr-code');
            const qs=code?getComputedStyle(code):null,qrRect=qr&&qr.getBoundingClientRect(),baseRect=coverQr&&coverQr.getBoundingClientRect();
            return{
              count:document.querySelectorAll('[data-rc1315-print-qr]').length,
              insideCover:!!(qr&&cover&&cover.contains(qr)),
              directCoverChild:!!(qr&&cover&&qr.parentElement===cover),
              insideReference:!!(qr&&refBox&&refBox.contains(qr)),
              topRightMarker:!!(cover&&cover.getAttribute('data-rc1360-print-qr-top-right')==='1'),
              width:qs&&qs.width,
              height:qs&&qs.height,
              boxWidth:qrRect&&qrRect.width
            };
          })(),
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
  expect(capture.quickPrintQr).toBeTruthy();
  expect(parseFloat(capture.quickPrintQr.width)).toBeLessThanOrEqual(31);
  expect(parseFloat(capture.quickPrintQr.height)).toBeLessThanOrEqual(31);
  expect(capture.quickPrintQr.count,'Druck-QR darf im Gesamtdruck nur einmal vorkommen').toBe(1);
  expect(capture.quickPrintQr.insideCover,'Druck-QR muss auf dem Deckblatt sitzen').toBe(true);
  expect(capture.quickPrintQr.directCoverChild,'Druck-QR darf nicht im großen Location-/Abhol-QR-Container stecken').toBe(true);
  expect(capture.quickPrintQr.boxWidth).toBeLessThanOrEqual(85);
  expect(capture.quickPrintQr.insideReference,'Druck-QR darf nicht im Referenzfeld sitzen').toBe(false);
  expect(capture.quickPrintQr.topRightMarker,'Deckblatt muss die RC1360-Position oben rechts markieren').toBe(true);
  expect(capture.text).toMatch(/Erstellt am:\s*\d{2}\.\d{2}\.\d{4}/);
  expect(capture.html).toMatch(/data-rc1281-created-date="1"/i);
  expect(capture.html).toMatch(/data-rc1203-cover-remark="1"/i);
  expect(capture.html).toMatch(/data-rc1305-loading-list="1"/i);
  expect(capture.html).toMatch(/data-rc1305-document-grid="1"/i);
  expect(capture.text).toContain('Bemerkung');
  expect(capture.text).toContain('RC1203 Demo-Bemerkung');
  expect(capture.packingSlipGrid).toBeTruthy();
  expect(capture.packingSlipGrid.display).toBe('grid');
  expect(capture.packingSlipGrid.count).toBe(7);
  expect(new Set(capture.packingSlipGrid.items.map(item=>item.text)).size,'Lieferscheine werden im Deckblatt doppelt dargestellt').toBe(7);
  expect(capture.packingSlipGrid.rowCount).toBeGreaterThanOrEqual(2);
  const slipWidths=capture.packingSlipGrid.items.map(item=>item.right-item.left);
  expect(Math.max(...slipWidths)-Math.min(...slipWidths),'Lieferschein-Kacheln müssen gleichmäßig kompakt bleiben').toBeLessThanOrEqual(3);
  expect(capture.packingSlipGrid.items.every(item=>(item.text.match(/\.pdf/gi)||[]).length<=1),'Zusammengeklebte PDF-Dateinamen dürfen nicht als eine Kachel erscheinen').toBe(true);
  expect(capture.packingSlipGrid.clientWidth<=0||capture.packingSlipGrid.scrollWidth<=capture.packingSlipGrid.clientWidth+2,'Lieferschein-Raster läuft horizontal über').toBe(true);
  expect(capture.packingSlipGrid.items.some(item=>/LS_47110007\.pdf/.test(item.text))).toBe(true);
  expect(capture.text).toMatch(/Ladeliste/i);
  expect(capture.text).toMatch(/(?:Ladeliste\s*1|\bL1\b)/i);
  expect(capture.text).toMatch(/CMR/i);
  expect(capture.load1Count).toBe(1);
  expect(capture.load2Count).toBe(0);
  expect(capture.cmrCount).toBe(3);
  expect(capture.cmrLabels).toHaveLength(3);
  expect(capture.cmrLabels[0]).toMatch(/CMR\s*1\s*\/\s*3/i);
  expect(capture.cmrLabels[1]).toMatch(/CMR\s*2\s*\/\s*3/i);
  expect(capture.cmrLabels[2]).toMatch(/CMR\s*3\s*\/\s*3/i);
  expect(capture.text).toMatch(/Warenbeschreibung/i);
  expect(capture.printDocuments.length).toBe(5);
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


test('RC1340 P1: echte Lieferschein-PDFs werden im Gesamtdruck exakt einmal gedruckt',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Lieferschein-Deduplizierung wird einmal im echten Browser geprüft.');
  test.setTimeout(30_000);
  const guard=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);

  const result=await page.evaluate(async()=>{
    const api=window.ExportHUBRC1340AttachmentPrint;
    if(!api||typeof api.printable!=='function'||typeof api.printShipment!=='function')throw new Error('RC1340 Lieferschein-Druck-API fehlt');
    const one='data:application/pdf;base64,JVBERi0xLjQKJSBB';
    const two='data:application/pdf;base64,JVBERi0xLjQKJSBC';
    const fileA={id:'LS-A',name:'LS_A.pdf',dataUrl:one,status:'active'};
    const fileADuplicate={id:'LS-A-COPY',name:'LS_A.pdf',dataUrl:one,status:'active'};
    const fileB={id:'LS-B',name:'LS_B.pdf',dataUrl:two,status:'active'};
    const shipment={
      deliveryFiles:[fileA,fileB,{id:'LS-OLD',name:'LS_ALT.pdf',dataUrl:'data:application/pdf;base64,JVBERi0xLjQKJSBD',status:'replaced'},{id:'LS-META',name:'LS_NUR_METADATA.pdf'}],
      files:[fileADuplicate],
      attachments:[fileB,{id:'TXT-1',name:'Hinweis.txt',dataUrl:'data:text/plain;base64,SGFsbG8='}]
    };
    const printable=api.printable(shipment).map(item=>({name:item.name,identity:item.identity}));
    const printed=[];
    window.__EXPORTHUB_CAPTURE_ATTACHMENT_PRINT__=meta=>{printed.push({name:String(meta.name||''),identity:String(meta.identity||''),index:Number(meta.index),total:Number(meta.total)})};
    const count=await api.printShipment(shipment);
    delete window.__EXPORTHUB_CAPTURE_ATTACHMENT_PRINT__;
    return{version:api.version,printable,printed,count};
  });

  expect(result.version).toBe('RC1340');
  expect(result.printable.map(x=>x.name)).toEqual(['LS_A.pdf','LS_B.pdf']);
  expect(new Set(result.printable.map(x=>x.identity)).size).toBe(2);
  expect(result.count).toBe(2);
  expect(result.printed).toHaveLength(2);
  expect(result.printed.map(x=>x.name)).toEqual(['LS_A.pdf','LS_B.pdf']);
  expect(result.printed.map(x=>x.index)).toEqual([0,1]);
  expect(result.printed.every(x=>x.total===2)).toBe(true);

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



test('RC1315: ABD-Ladeliste hält beide Fahrerunterschriften kollisionsfrei auf einer A4-Seite',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','A4-Signaturlayout wird einmal im echten Chromium geprüft.');
  test.setTimeout(45_000);
  const guard=attachRuntimeGuards(page,testInfo);

  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await page.emulateMedia({media:'print'});

  const layout=await page.evaluate(()=>{
    const api=window.ExportHUBRC1305LoadingListPrint;
    if(!api||typeof api.enhance!=='function')throw new Error('RC1305 Ladelisten-Enhancer fehlt');
    const sig='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    const raw='<section class="rc390-page rc390-load">'+
      '<div data-rc1315-fixture-content="1"></div>'+
      '<div class="field"><strong>Unterschrift Fahrer</strong></div>'+
      '<div class="field"><strong>Fahrername</strong></div>'+
      '<div class="field"><strong>Datum / Uhrzeit</strong></div>'+
      '<div class="field"><strong>Kennzeichen</strong></div>'+
      '<div class="field"><strong>Verlader</strong></div>'+
      '<div class="field"><strong>Europaletten Ausgang</strong></div>'+
      '</section>';
    const shipment={
      reference:'ABD001',
      pickupComplete:true,
      status:'Abgeholt',
      abdPresent:true,
      driverName:'Max Mustermann',
      licensePlate:'KLE-AB 1234',
      loaderName:'Tobias',
      carrierName:'Beispiel Spedition GmbH',
      palletOut:4,
      returnedEuroPallets:2,
      driverSignature:sig,
      customsDocumentsSignature:sig,
      customsDocumentsSignatureStored:true,
      confirmedAt:'2026-09-28T08:30:00Z'
    };
    document.body.innerHTML=api.enhance(raw,shipment);
    const root=document.querySelector('[data-rc1305-loading-list]');
    const filler=root&&root.querySelector('[data-rc1315-fixture-content]');
    if(!root||!filler)throw new Error('RC1315 Druckfixture konnte nicht aufgebaut werden');
    root.style.setProperty('box-sizing','border-box','important');
    root.style.setProperty('width','194mm','important');
    root.style.setProperty('height','281mm','important');
    root.style.setProperty('max-height','281mm','important');
    root.style.setProperty('min-height','281mm','important');
    root.style.setProperty('margin','0','important');
    root.style.setProperty('padding','8mm','important');
    root.style.setProperty('display','block','important');
    root.style.setProperty('overflow','visible','important');
    filler.style.setProperty('height','215mm','important');
    filler.style.setProperty('margin','0','important');
    filler.style.setProperty('padding','0','important');

    const summary=root.querySelector('[data-rc1305-pickup-summary]');
    const primary=root.querySelector('.rc1305-signature-primary');
    const customs=root.querySelector('.rc1305-signature-customs');
    const images=Array.from(root.querySelectorAll('.rc1305-signature-image'));
    if(!summary||!primary||!customs||images.length!==2)throw new Error('Beide Signaturfelder wurden nicht gerendert');
    const rr=root.getBoundingClientRect(),sr=summary.getBoundingClientRect(),pr=primary.getBoundingClientRect(),cr=customs.getBoundingClientRect();
    const itemRects=Array.from(summary.querySelectorAll('.rc1305-pickup-item')).map(node=>node.getBoundingClientRect());
    let overlap=false;
    for(let i=0;i<itemRects.length;i++)for(let j=i+1;j<itemRects.length;j++){
      const a=itemRects[i],b=itemRects[j],x=Math.min(a.right,b.right)-Math.max(a.left,b.left),y=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
      if(x>1&&y>1){overlap=true}
    }
    const imagesInside=images.every(img=>{
      const ir=img.getBoundingClientRect(),parent=img.closest('.rc1305-pickup-signature').getBoundingClientRect();
      return ir.left>=parent.left-1&&ir.right<=parent.right+1&&ir.top>=parent.top-1&&ir.bottom<=parent.bottom+1;
    });
    return{
      scrollHeight:root.scrollHeight,
      clientHeight:root.clientHeight,
      summaryBottom:sr.bottom,
      rootBottom:rr.bottom,
      summaryHeight:sr.height,
      signatureCount:images.length,
      sameRow:Math.abs(pr.top-cr.top)<=2,
      sideBySide:pr.right<=cr.left+2,
      overlap,
      imagesInside
    };
  });

  expect(layout.signatureCount).toBe(2);
  expect(layout.sameRow,'Die beiden Fahrerunterschriften stehen nicht in derselben Zeile').toBe(true);
  expect(layout.sideBySide,'Die beiden Fahrerunterschriften überlappen horizontal').toBe(true);
  expect(layout.overlap,'Elemente des Abholnachweises überlappen sich').toBe(false);
  expect(layout.imagesInside,'Mindestens eine Unterschrift ragt aus ihrem Signaturfeld').toBe(true);
  expect(layout.summaryHeight,'Der Signatur-/Abholblock ist für A4 zu hoch').toBeLessThan(160);
  expect(layout.summaryBottom<=layout.rootBottom+2,'Der Signaturblock ragt aus der A4-Ladeliste heraus').toBe(true);
  expect(layout.scrollHeight<=layout.clientHeight+2,'Die ABD-Ladeliste würde auf eine zweite Seite überlaufen').toBe(true);

  await assertRuntimeClean(guard,testInfo);
});

test('RC1315 P1: Druck-QR oder REF in Ladeliste startet den vollständigen Sendungsdruck',async({page,context},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','QR-/REF-Schnelldruck wird einmal im echten Browser geprüft.');
  test.setTimeout(60_000);

  await context.addInitScript(()=>{
    window.__RC1315_PRINT_CAPTURE__=null;
    const capture=()=>{try{
      window.__RC1315_PRINT_CAPTURE__={
        text:String(document.body&&document.body.innerText||''),
        html:String(document.documentElement&&document.documentElement.outerHTML||''),
        load1Count:document.querySelectorAll('.rc390-load.rc576-load1').length,
        load2Count:document.querySelectorAll('.rc390-load.rc576-load2').length,
        cmrCount:document.querySelectorAll('.rc390-cmr-wrap').length
      };
    }catch(_){}};
    try{Object.defineProperty(window,'print',{configurable:true,writable:true,value:capture})}
    catch(_){try{window.print=capture}catch(__){}}
  });

  const guards=[attachRuntimeGuards(page,testInfo)];
  context.on('page',popup=>guards.push(attachRuntimeGuards(popup,testInfo)));

  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'documents',['Ladeliste & CMR','Dokumente & CMR','Dokumente','CMR'],/Ladeliste|CMR|Dokument/i,{allowProgrammaticFallback:true});

  const quick=page.locator('[data-rc1315-input]').first();
  await expect(quick,'RC1315 QR-/REF-Eingabe fehlt').toBeVisible({timeout:10_000});
  await quick.fill('EHPRINT:DEMO02'); // echter QR-Scan muss ohne zusätzlichen Klick/Enter starten

  let capture=null;
  await expect.poll(async()=>{
    for(const p of context.pages()){
      for(const frame of p.frames()){
        const value=await frame.evaluate(()=>window.__RC1315_PRINT_CAPTURE__||null).catch(()=>null);
        if(value&&String(value.html||'').length>500){capture=value;return value.html.length}
      }
    }
    await sleep(100);
    return 0;
  },{timeout:20_000,message:'QR-Schnelldruck hat keinen vollständigen Druckkontext erzeugt'}).toBeGreaterThan(500);

  expect(capture.text).toContain('DEMO02');
  expect(capture.html).toContain('data-rc1315-print-qr="1"');
  expect(capture.html).toContain('data-rc1315-payload="EHPRINT:DEMO02"');
  expect(capture.load1Count).toBe(1);
  expect(capture.load2Count).toBe(0);
  expect(capture.cmrCount).toBe(3);

  const status=page.locator('[data-rc1315-status]').first();
  await expect(status).toContainText(/DEMO02/);

  for(const guard of guards)await assertRuntimeClean(guard,testInfo);
});
