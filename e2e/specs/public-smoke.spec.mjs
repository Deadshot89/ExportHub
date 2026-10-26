import {test,expect} from '@playwright/test';
import {
  assertNoSourceLeak,
  attachRuntimeGuards,
  assertRuntimeClean
} from '../helpers/exporthub-browser.mjs';
import {
  packStationTokenFromFixture,
  runPackNotificationLiveFlow
} from '../helpers/pack-notification-live.mjs';

const publicPages=[
  ['/pickup.html','Pickup'],
  ['/customer-avis.html','Lieferavis'],
  ['/location.html','Location']
];

async function installStaticApiFallback(page,{invalidAvis=false}={}){
  if(process.env.EXPORTHUB_E2E_STATIC!=='1')return;
  await page.route('**/api/**',async route=>{
    const url=route.request().url();
    const isAvis=/\/api\/customer-avis/i.test(url);
    const status=invalidAvis&&isAvis?404:200;
    await route.fulfill({
      status,
      contentType:'application/json',
      body:JSON.stringify(status===404?{error:'INVALID_TOKEN'}:{ok:true,items:[],documents:[]})
    });
  });
}

for(const [path,label] of publicPages){
  test(`RC1124 public: ${label} lädt read-only ohne Quellcode-Leak`,async({page},testInfo)=>{
    const runtime=attachRuntimeGuards(page,testInfo);
    await installStaticApiFallback(page);
    await page.goto(path,{waitUntil:'domcontentloaded'});
    await expect(page.locator('body')).toBeVisible();
    await expect.poll(()=>page.locator('body').innerText(),{timeout:10_000}).not.toBe('');
    await assertNoSourceLeak(page);
    await assertRuntimeClean(runtime,testInfo);
  });
}

test('RC1124 public: ungültiger Lieferavis-Token endet kontrolliert',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await installStaticApiFallback(page,{invalidAvis:true});
  const environment=process.env.EXPORTHUB_E2E_PUBLIC_ENV||'testservice';
  await page.goto('/customer-avis.html?token=__rc1124_invalid__&environment='+encodeURIComponent(environment)+'&lang=de',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toBeVisible();
  await expect.poll(()=>page.locator('body').innerText(),{timeout:15_000}).toMatch(/ungültig|invalid|abgelaufen|nicht gefunden|nicht verfügbar|nicht freigegeben|Zugriff|Token|Fehler/i);
  await assertNoSourceLeak(page);
  await assertRuntimeClean(runtime,testInfo);
});

test('RC1555 production smoke: verschachtelte POD-Abholkarten zeigen nur die neuen Werte',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','RC1555 POD-Liveprüfung läuft einmal im Laptop-Profil.');
  const runtime=attachRuntimeGuards(page,testInfo);
  await installStaticApiFallback(page);
  await page.goto('/',{waitUntil:'load'});
  await page.waitForFunction(()=>window.ExportHUBRC1305LoadingListPrint&&typeof window.ExportHUBRC1305LoadingListPrint.enhance==='function',null,{timeout:15_000});
  await page.emulateMedia({media:'print'});

  const layout=await page.evaluate(async()=>{
    const api=window.ExportHUBRC1305LoadingListPrint;
    const card=(label,oldValue,legacyHeight='0')=>
      '<div class="rc390-card" data-rc1555-live-card="1" style="box-sizing:border-box;min-height:26mm;padding:2mm;border:1px solid #cbd5e1">'+
        '<div class="rc390-field-head"><div class="rc390-label">'+label+'</div></div>'+
        '<div class="rc390-txt"><span>Alter Hilfetext</span><div style="min-height:'+legacyHeight+'">'+oldValue+'</div></div>'+
      '</div>';
    const raw='<section class="rc390-page rc390-load rc576-load1" style="width:194mm;min-height:120mm;padding:8mm">'+
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2mm">'+
        card('Unterschrift Fahrer','ALTE UNTERSCHRIFT','52mm')+
        card('Fahrername','ALTER FAHRER')+
        card('Datum / Uhrzeit','ALTES DATUM')+
        card('Kennzeichen','ALTES KENNZEICHEN')+
        card('Verlader','ALTER VERLADER')+
        card('Europaletten Ausgang','Ausgang: 99 Europaletten')+
      '</div><div data-rc1305-pickup-summary>ALTER ERSATZBLOCK</div></section>';
    const shipment={
      reference:'RC1555-LIVE',status:'Abgeholt',palletOut:3,
      signatureData:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl9sAAAAASUVORK5CYII=',
      pickupHistory:[{complete:true,driverName:'Max Fahrer',licensePlate:'KLE-RC1555',loaderName:'Live Verlader',confirmedAt:'2026-10-16T12:00:00.000Z'}]
    };
    // Render the synthetic shipment in the same print document hierarchy as
    // the real UI. A bare rc390-load under <body> is hidden by print-scoped rules
    // and can report a 0px signature even when the print renderer works.
    const enhanced=api.enhance(raw,shipment,true);
    document.body.classList.remove('print-docs-only');
    document.body.classList.add('print-rc390');
    // Match documentHtml()/hubHtml(): the stage contains the document view.
    // Assigning .rc390-docview to the stage itself bypasses production selectors
    // and can hide the entire print tree in the full main-release build.
    document.body.innerHTML='<div id="app" class="app"><main class="main"><div id="content">'+
      '<div id="rc576DocumentHub"><div id="rc576DocumentStage" data-doc="load1">'+
      '<div class="rc390-docview" data-rc601-doc="load1" data-rc616-doc="load1">'+
      '<div class="rc390-bundle">'+enhanced+'</div></div></div></div></div></main></div>';
    // Layout erst nach dem Paint-Zyklus prüfen: CSS, Fonts und die Druck-Ansicht
    // müssen vollständig berechnet sein. Fehlende Sichtbarkeit bleibt ein Fehler.
    await document.fonts.ready;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const root=document.querySelector('#rc576DocumentStage .rc390-bundle > .rc390-load');
    if(!root)throw new Error('RC1555: Druck-Ladeliste fehlt nach Enhance');
    const fields=Array.from(root.querySelectorAll('[data-rc1503-pickup-field]'));
    const visibleLegacy=Array.from(root.querySelectorAll('[data-rc1555-live-card="1"] .rc390-txt,[data-rc1555-live-card="1"] .rc352-txt')).filter(node=>getComputedStyle(node).display!=='none');
    const signature=root.querySelector('.rc1503-signature-value');
    const image=root.querySelector('.rc1503-signature-value .rc1305-signature-image');
    const cards=Array.from(root.querySelectorAll('[data-rc1555-live-card="1"]'));
    return {
      fieldCount:fields.length,
      printStage:root.closest('#rc576DocumentStage')?.getAttribute('data-doc')||'',
      printStageDisplay:getComputedStyle(document.querySelector('#rc576DocumentStage')).display,
      printViewDisplay:getComputedStyle(document.querySelector('#rc576DocumentStage > .rc390-docview')).display,
      printPageDisplay:getComputedStyle(root).display,
      printPageHeight:root.getBoundingClientRect().height,
      printAncestorDiagnostics:(()=>{
        const ancestors=[];
        for(let node=root;node&&ancestors.length<8;node=node.parentElement){
          const style=getComputedStyle(node),rect=node.getBoundingClientRect();
          ancestors.push({
            node:node.tagName.toLowerCase()+(node.id?'#'+node.id:'')+(node.className&&typeof node.className==='string'?'.'+node.className.trim().split(/\s+/).join('.'):''), 
            display:style.display,visibility:style.visibility,position:style.position,
            minHeight:style.minHeight,height:style.height,zoom:style.zoom,
            transform:style.transform,contentVisibility:style.contentVisibility,
            rectHeight:rect.height,clientHeight:node.clientHeight
          });
        }
        return {ancestors,bodyClasses:document.body.className,htmlClasses:document.documentElement.className,htmlFlags:Array.from(document.documentElement.attributes).filter(attr=>attr.name.startsWith('data-')).map(attr=>[attr.name,attr.value])};
      })(),
      outerCards:fields.every(field=>field.matches('.rc390-card,.rc352-card')),
      visibleLegacy:visibleLegacy.length,
      signaturePresent:!!signature,
      signatureDisplay:signature?getComputedStyle(signature).display:'',
      signatureParentDisplay:signature?getComputedStyle(signature.parentElement).display:'',
      signatureHeight:signature?signature.getBoundingClientRect().height:0,
      imageHeight:image?image.getBoundingClientRect().height:0,
      maxCardHeight:Math.max(...cards.map(card=>card.getBoundingClientRect().height)),
      bodyText:String(document.body.innerText||'')
    };
  });

  expect(layout.fieldCount).toBe(6);
  expect(layout.printStage,'Ladeliste muss im echten Dokumentstage als aktiv markiert sein').toBe('load1');
  expect(layout.printStageDisplay,'Äußerer Dokumentstage darf nicht unsichtbar sein').not.toBe('none');
  expect(layout.printViewDisplay,'Innere Dokumentansicht darf nicht unsichtbar sein').not.toBe('none');
  expect(layout.printPageDisplay,'Aktive Ladeliste darf im Druck nicht ausgeblendet sein').not.toBe('none');
  expect(layout.printPageHeight,'Aktive Ladeliste muss eine sichtbare Höhe besitzen; Layout-Diagnose: '+JSON.stringify(layout.printAncestorDiagnostics)).toBeGreaterThan(0);
  expect(layout.outerCards).toBe(true);
  expect(layout.visibleLegacy).toBe(0);
  expect(layout.signaturePresent,'Fahrerunterschrift muss nach Enhance im kanonischen Abholfeld existieren').toBe(true);
  expect(layout.signatureDisplay,'Signaturwert darf im Printmodus nicht display:none sein').not.toBe('none');
  expect(layout.signatureParentDisplay,'Unterschriftskarte darf im Printmodus nicht display:none sein').not.toBe('none');
  expect(layout.signatureHeight).toBeGreaterThan(0);
  expect(layout.signatureHeight).toBeLessThanOrEqual(62);
  expect(layout.imageHeight).toBeLessThanOrEqual(58);
  expect(layout.maxCardHeight).toBeLessThanOrEqual(120);
  expect(layout.bodyText).not.toMatch(/ALTE UNTERSCHRIFT|ALTER FAHRER|ALTES DATUM|ALTES KENNZEICHEN|ALTER VERLADER|ALTER ERSATZBLOCK|Alter Hilfetext|Ausgang:\s*99/i);
  // RC1592: Die separate Abholkontrolle darf nur bei tatsächlich vorhandenem
  // Overlay den Rest der Druckseite ausblenden; Ladelisten bleiben sonst sichtbar.
  // Die Abholkontrolle ist im echten Produkt bedarfsweise geladen.
  // Ihr separater Druckmodus wird erst geprüft, wenn die echte Runtime
  // ihre Print-CSS-Regeln installiert hat.
  if(!await page.evaluate(()=>!!window.ExportHUBRC1546PickupControl)){
    await page.addScriptTag({url:'/assets/rc1546-pickup-control.js'});
  }
  await page.evaluate(()=>window.ExportHUBRC1546PickupControl.render());
  await expect.poll(()=>page.evaluate(()=>!!document.getElementById('exporthub-rc1546-style'))).toBe(true);
  // RC1592: Nach Laden der echten Abholkontroll-CSS normale Druckansicht prüfen.
  const normalPrint=await page.evaluate(()=>{
    const stage=document.getElementById('rc576DocumentStage');
    const signature=stage?.querySelector('.rc1503-signature-value');
    return{
      overlayCount:document.querySelectorAll('body > .rc1546-overlay').length,
      stageDisplay:stage?getComputedStyle(stage).display:'missing',
      stageHeight:stage?stage.getBoundingClientRect().height:0,
      signatureHeight:signature?signature.getBoundingClientRect().height:0
    };
  });
  expect(normalPrint.overlayCount,'Ohne geöffnete Abholkontrolle darf kein Druck-Overlay existieren').toBe(0);
  expect(normalPrint.stageDisplay,'Geladene Kontroll-CSS darf Ladelisten nicht verstecken').not.toBe('none');
  expect(normalPrint.stageHeight,'Ladeliste muss mit geladener Kontroll-CSS sichtbar bleiben').toBeGreaterThan(0);
  expect(normalPrint.signatureHeight,'POD-Unterschrift muss mit geladener Kontroll-CSS sichtbar bleiben').toBeGreaterThan(0);
  const overlayPrint=await page.evaluate(()=>{
    const overlay=document.createElement('div');
    overlay.className='rc1546-overlay';
    overlay.innerHTML='<section class="rc1546-dialog">RC1592 Druckkontrolle</section>';
    document.body.appendChild(overlay);
    const stage=document.getElementById('rc576DocumentStage');
    // Der echte Dokumentstage liegt verschachtelt unter #app. Die Print-CSS
    // versteckt den direkten body-Kindcontainer, nicht den Stage-Knoten selbst.
    let pageRoot=stage;
    while(pageRoot?.parentElement && pageRoot.parentElement!==document.body){
      pageRoot=pageRoot.parentElement;
    }
    return{
      pageRootIsBodyChild:pageRoot?.parentElement===document.body,
      pageRootDisplay:pageRoot?getComputedStyle(pageRoot).display:'missing',
      stageHeight:stage?stage.getBoundingClientRect().height:-1,
      overlayDisplay:getComputedStyle(overlay).display,
      overlayHeight:overlay.getBoundingClientRect().height
    };
  });
  expect(overlayPrint.pageRootIsBodyChild,'Die Print-Sperre muss am direkten body-Kindcontainer geprüft werden').toBe(true);
  expect(overlayPrint.pageRootDisplay,'Mit aktivem Kontroll-Overlay muss der echte Dokumentcontainer verborgen sein').toBe('none');
  expect(overlayPrint.stageHeight,'Die verschachtelte Ladeliste darf während der separaten Kontrollansicht keine Druckfläche belegen').toBe(0);
  expect(overlayPrint.overlayDisplay,'Abhol-Overlay selbst muss druckbar bleiben').not.toBe('none');
  expect(overlayPrint.overlayHeight,'Das allein druckbare Kontroll-Overlay muss eine positive Druckhöhe haben').toBeGreaterThan(0);
  const restoredPrint=await page.evaluate(()=>{
    document.querySelector('body > .rc1546-overlay')?.remove();
    const stage=document.getElementById('rc576DocumentStage');
    return{
      stageDisplay:stage?getComputedStyle(stage).display:'missing',
      stageHeight:stage?stage.getBoundingClientRect().height:0
    };
  });
  expect(restoredPrint.stageDisplay,'Nach Schließen der Abholkontrolle muss die Ladeliste wieder erscheinen').not.toBe('none');
  expect(restoredPrint.stageHeight,'Nach Schließen der Abholkontrolle muss die Druckhöhe zurückkehren').toBeGreaterThan(0);

  await assertRuntimeClean(runtime,testInfo);
});

test('Packmeldung: Lieferschein erscheint trotz haengender optionaler PDF-Erkennung',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','unabhaengiger Upload-Browsercheck auf Laptop');
  // A static fixture is intentional: it never writes pack tasks or user data.
  // The normalizer is deliberately stalled to verify that a real FileReader
  // upload can reach the document list without waiting indefinitely.
  await page.route('**/assets/document-reference-normalizer.js*',route=>route.fulfill({
    status:200,contentType:'application/javascript',
    body:'window.ExportHubDocumentReferenceNormalizer={normalizePdfFile:()=>new Promise(()=>{})};'
  }));
  await page.route('**/api/pack-notification?action=*',route=>{
    const action=new URL(route.request().url()).searchParams.get('action');
    const payload=action==='session'
      ?{ok:true,sessionId:'550e8400-e29b-41d4-a716-446655440000',stationName:'E2E Packstation'}
      :action==='packaging-list'?{ok:true,packaging:[]}
      :action==='draft-list'?{ok:true,drafts:[]}
      :{ok:false,code:'PACK_E2E_UNEXPECTED_ACTION'};
    return route.fulfill({status:payload.ok?200:400,contentType:'application/json',body:JSON.stringify(payload)});
  });
  await page.goto('/assets/pack.html?token=E2E-PACK-UPLOAD',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#packNewShipment')).toBeVisible();
  await page.locator('#packNewShipment').click();
  const filename='SIDE250071282.pdf';
  const chooserPromise=page.waitForEvent('filechooser');
  await page.locator('label[for="packDocuments"]').click();
  const chooser=await chooserPromise;
  await chooser.setFiles({
    name:filename,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\\n1 0 obj<<>>endobj\\n%%EOF','utf8')
  });
  await expect(page.locator('#packDocumentList')).toContainText(filename,{timeout:8000});
  await expect(page.locator('#packError')).toBeHidden();
  await expect(page.locator('#packDocuments')).toHaveValue('');
});

test('RC1499: echter QR-Packmeldungsfluss blockiert Production bei TESTSERVICE-Regression',async({browser},testInfo)=>{
  test.setTimeout(180_000);
  test.skip(process.env.EXPORTHUB_E2E_LIVE!=='1'||process.env.EXPORTHUB_E2E_MUTATION!=='1','RC1499 läuft nur im mutierenden TESTSERVICE-Gate.');
  test.skip(testInfo.project.name!=='laptop','RC1499 läuft genau einmal auf dem Laptop-Profil.');
  const token=packStationTokenFromFixture();
  expect(token,'Temporärer RC1499 Packtisch-Token fehlt').toMatch(/^E2E-PACK-/);
  await runPackNotificationLiveFlow(browser,testInfo,token);
});
