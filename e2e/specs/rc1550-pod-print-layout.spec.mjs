import {test,expect} from '@playwright/test';
import {appEntry,waitReady,attachRuntimeGuards,assertRuntimeClean} from '../helpers/exporthub-browser.mjs';

test('RC1555: POD-Abholfelder ersetzen auch verschachtelte Altwerte und bleiben kompakt',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','POD-Drucklayout wird einmal im echten Chromium geprüft.');
  test.setTimeout(45_000);
  const guard=attachRuntimeGuards(page,testInfo);

  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await page.emulateMedia({media:'print'});

  const result=await page.evaluate(()=>{
    const api=window.ExportHUBRC1305LoadingListPrint;
    if(!api||typeof api.enhance!=='function')throw new Error('RC1555 Ladelisten-Runtime fehlt');

    const card=(label,oldValue='ALTWERT',extra='')=>'<div class="rc390-card" style="box-sizing:border-box;min-height:26mm;padding:2mm;border:1px solid #cbd5e1">'+
      '<div class="rc390-label">'+label+'</div><div class="legacy-shell"><div class="rc390-txt">'+oldValue+extra+'</div></div></div>';
    const oldSignature='<img data-rc1555-legacy-signature="1" alt="alte Signatur" style="display:block;width:100%;height:120mm" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl9sAAAAASUVORK5CYII=">';
    const raw='<section class="rc390-page rc390-load" style="box-sizing:border-box;width:194mm;min-height:120mm;margin:0;padding:8mm;overflow:visible">'+
      '<div data-rc1555-production-pickup-grid="1" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,1fr);height:150mm;align-items:stretch;gap:2mm">'+
      card('Unterschrift Fahrer','ALTE UNTERSCHRIFT',oldSignature)+
      card('Fahrername','ALTER FAHRER')+
      card('Datum / Uhrzeit','ALTES DATUM')+
      card('Kennzeichen','ALTES KENNZEICHEN')+
      card('Verlader','ALTER VERLADER')+
      card('Europaletten Ausgang','Ausgang: 99 Europaletten<br><strong>Eingang/Rückgabe: 88</strong>')+
      '</div></section>';

    const shipment={
      reference:'POD555',
      status:'Abgeholt',
      palletOut:3,
      signatureData:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl9sAAAAASUVORK5CYII=',
      __rc1543PalletBalanceSnapshot:{key:'customer:test',type:'customer',name:'Testkunde',balance:12},
      pickupHistory:[{
        complete:true,
        driverName:'Max Fahrer',
        licensePlate:'KLE-POD555',
        loaderName:'Test Verlader',
        confirmedAt:'2026-10-16T12:00:00.000Z',
        returnedEuroPallets:1
      }]
    };

    document.body.innerHTML=api.enhance(raw,shipment,true);
    const root=document.querySelector('.rc390-load');
    if(!root)throw new Error('RC1555 Ladeliste wurde nicht gerendert');
    const signature=root.querySelector('.rc1503-signature-value');
    const signatureImage=root.querySelector('.rc1503-signature-value .rc1305-signature-image');
    const pallet=root.querySelector('[data-rc1543-pallet-single-value="1"]');
    const fields=Array.from(root.querySelectorAll('[data-rc1503-pickup-field]'));
    const pickupGrid=root.querySelector('[data-rc1555-production-pickup-grid]');
    const visibleLegacy=Array.from(root.querySelectorAll('[data-rc1503-pickup-field] .rc390-txt,[data-rc1503-pickup-field] .rc352-txt')).filter(node=>{
      const style=getComputedStyle(node),rect=node.getBoundingClientRect();
      return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;
    });
    const legacySignature=root.querySelector('[data-rc1555-legacy-signature]');
    const legacySignatureVisible=!!(legacySignature&&getComputedStyle(legacySignature).display!=='none'&&legacySignature.getBoundingClientRect().height>0);
    const values=fields.map(card=>card.querySelector('[data-rc1503-pickup-value]')).filter(Boolean);
    const overflows=values.filter(value=>{
      const vr=value.getBoundingClientRect(),cr=value.closest('[data-rc1503-pickup-field]').getBoundingClientRect();
      return vr.right>cr.right+1||vr.bottom>cr.bottom+1||vr.left<cr.left-1||vr.top<cr.top-1;
    }).length;
    let overlap=false;
    for(let i=0;i<values.length;i++)for(let j=i+1;j<values.length;j++){
      const a=values[i].getBoundingClientRect(),b=values[j].getBoundingClientRect();
      const x=Math.min(a.right,b.right)-Math.max(a.left,b.left),y=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
      if(x>1&&y>1)overlap=true;
    }
    const fieldHeights=fields.map(card=>card.getBoundingClientRect().height);
    const sr=signature&&signature.getBoundingClientRect(),ir=signatureImage&&signatureImage.getBoundingClientRect();
    return{
      pickupFieldCount:fields.length,
      visibleLegacyCount:visibleLegacy.length,
      legacySignatureVisible,
      overflows,
      overlap,
      maxFieldHeight:Math.max(0,...fieldHeights),
      pickupGridHeight:pickupGrid&&pickupGrid.getBoundingClientRect().height||0,
      compactGridMarker:pickupGrid&&pickupGrid.getAttribute('data-rc1555-compact-pickup-grid'),
      signatureHeight:sr&&sr.height||0,
      signatureImageHeight:ir&&ir.height||0,
      palletMarker:!!pallet,
      palletValueCount:pallet?pallet.querySelectorAll('[data-rc1503-pickup-value]').length:0,
      palletText:pallet?String(pallet.innerText||pallet.textContent||'').trim():'',
      bodyText:String(document.body.innerText||'')
    };
  });

  expect(result.pickupFieldCount,'Alle sechs Abholfelder müssen erhalten bleiben').toBe(6);
  expect(result.visibleLegacyCount,'Auch verschachtelte alte Pickup-Werte müssen vollständig verschwinden').toBe(0);
  expect(result.legacySignatureVisible,'Das alte große Signaturbild darf nicht mehr layoutwirksam sein').toBe(false);
  expect(result.compactGridMarker,'Der gemeinsame Pickup-Grid muss als kompakt normalisiert werden').toBe('1');
  expect(result.maxFieldHeight,'Kein Abholfeld darf die Ladeliste wie im Produktionsfehler übermäßig strecken').toBeLessThanOrEqual(100);
  expect(result.pickupGridHeight,'Die zwei Pickup-Zeilen müssen kompakt bleiben').toBeLessThanOrEqual(210);
  expect(result.overflows,'Pickup-Werte dürfen ihre Karten nicht überragen').toBe(0);
  expect(result.overlap,'Pickup-Werte dürfen sich nicht gegenseitig überlappen').toBe(false);
  expect(result.signatureHeight,'Fahrerunterschrift darf maximal 16mm hoch sein').toBeLessThanOrEqual(62);
  expect(result.signatureHeight).toBeGreaterThan(0);
  expect(result.signatureImageHeight,'Signaturbild darf maximal 15mm hoch sein').toBeLessThanOrEqual(58);
  expect(result.palletMarker,'Palettenkonto muss als normalisierter Einzelwert markiert sein').toBe(true);
  expect(result.palletValueCount,'Palettenkonto darf nur einen dynamischen Wert enthalten').toBe(1);
  expect(result.palletText).not.toMatch(/Ausgang:\s*99|Eingang\/Rückgabe:\s*88/i);
  expect(result.bodyText).not.toMatch(/ALTE UNTERSCHRIFT|ALTER FAHRER|ALTES DATUM|ALTES KENNZEICHEN|ALTER VERLADER/i);

  await assertRuntimeClean(guard,testInfo);
});