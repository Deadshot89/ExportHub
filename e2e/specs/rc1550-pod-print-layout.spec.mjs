import {test,expect} from '@playwright/test';
import {appEntry,waitReady,attachRuntimeGuards,assertRuntimeClean} from '../helpers/exporthub-browser.mjs';

test('RC1550/RC1555: POD-Abholfelder überlappen nicht, zeigen keine Altwerte und bleiben kompakt',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','POD-Drucklayout wird einmal im echten Chromium geprüft.');
  test.setTimeout(45_000);
  const guard=attachRuntimeGuards(page,testInfo);

  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await page.emulateMedia({media:'print'});

  const result=await page.evaluate(()=>{
    const api=window.ExportHUBRC1305LoadingListPrint;
    if(!api||typeof api.enhance!=='function')throw new Error('RC1550 Ladelisten-Runtime fehlt');

    // RC1555 reproduziert die Produktionsstruktur aus dem gemeldeten POD:
    // Das Label sitzt in einem inneren *field*-Wrapper, der Altwert liegt als Geschwisterknoten
    // im eigentlichen rc390-card. Die alte cardFor()-Heuristik erwischt dadurch fälschlich den
    // inneren Wrapper und lässt Altwert/Altsignatur sichtbar stehen.
    const card=(label,oldValue='ALTWERT',legacyHeight='0')=>
      '<div class="rc390-card" data-rc1555-fixture-card="1" style="box-sizing:border-box;min-height:26mm;padding:2mm;border:1px solid #cbd5e1">'+
        '<div class="rc390-field-head"><div class="rc390-label">'+label+'</div></div>'+
        '<div class="rc390-txt"><div class="legacy-help">Alter Hilfetext</div><div class="legacy-value" style="min-height:'+legacyHeight+'">'+oldValue+'</div></div>'+
      '</div>';
    const raw='<section class="rc390-page rc390-load" style="box-sizing:border-box;width:194mm;min-height:120mm;margin:0;padding:8mm;overflow:visible">'+
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2mm;align-items:start">'+
      card('Unterschrift Fahrer','ALTE UNTERSCHRIFT','52mm')+
      card('Fahrername','ALTER FAHRER')+
      card('Datum / Uhrzeit','ALTES DATUM')+
      card('Kennzeichen','ALTES KENNZEICHEN')+
      card('Verlader','ALTER VERLADER')+
      card('Europaletten Ausgang','Ausgang: 99 Europaletten')+
      '</div><div data-rc1305-pickup-summary>ALTER ERSATZBLOCK</div></section>';

    const shipment={
      reference:'POD550',
      status:'Abgeholt',
      palletOut:3,
      signatureData:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl9sAAAAASUVORK5CYII=',
      pickupHistory:[{
        complete:true,
        driverName:'Max Fahrer',
        licensePlate:'KLE-POD550',
        loaderName:'Test Verlader',
        confirmedAt:'2026-10-16T12:00:00.000Z',
        returnedEuroPallets:1
      }]
    };

    document.body.innerHTML=api.enhance(raw,shipment,true);
    const root=document.querySelector('.rc390-load');
    if(!root)throw new Error('RC1550 Ladeliste wurde nicht gerendert');
    const signature=root.querySelector('.rc1503-signature-value');
    const signatureImage=root.querySelector('.rc1503-signature-value .rc1305-signature-image');
    const pallet=root.querySelector('[data-rc1543-pallet-single-value="1"]');
    const fields=Array.from(root.querySelectorAll('[data-rc1503-pickup-field]'));
    const fixtureCards=Array.from(root.querySelectorAll('[data-rc1555-fixture-card="1"]'));
    const visibleLegacy=Array.from(root.querySelectorAll('[data-rc1555-fixture-card="1"] .rc390-txt,[data-rc1555-fixture-card="1"] .rc352-txt')).filter(node=>getComputedStyle(node).display!=='none');
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
    const sr=signature&&signature.getBoundingClientRect(),ir=signatureImage&&signatureImage.getBoundingClientRect();
    const heights=fixtureCards.map(card=>card.getBoundingClientRect().height);
    return{
      pickupFieldCount:fields.length,
      pickupFieldsAreOuterCards:fields.every(field=>field.matches('.rc390-card,.rc352-card')),
      visibleLegacyCount:visibleLegacy.length,
      overflows,
      overlap,
      signatureHeight:sr&&sr.height||0,
      signatureImageHeight:ir&&ir.height||0,
      maxCardHeight:heights.length?Math.max(...heights):0,
      palletMarker:!!pallet,
      palletValueCount:pallet?pallet.querySelectorAll('[data-rc1503-pickup-value]').length:0,
      palletText:pallet?String(pallet.innerText||pallet.textContent||'').trim():'',
      bodyText:String(document.body.innerText||'')
    };
  });

  expect(result.pickupFieldCount,'Alle sechs Abholfelder müssen erhalten bleiben').toBe(6);
  expect(result.pickupFieldsAreOuterCards,'RC1555 muss den echten äußeren POD-Kartencontainer ersetzen, nicht den inneren Field-Header').toBe(true);
  expect(result.visibleLegacyCount,'Alte Pickup-Inhalte dürfen auch in verschachtelter Produktionsstruktur nicht sichtbar bleiben').toBe(0);
  expect(result.overflows,'Pickup-Werte dürfen ihre Karten nicht überragen').toBe(0);
  expect(result.overlap,'Pickup-Werte dürfen sich nicht gegenseitig überlappen').toBe(false);
  expect(result.signatureHeight,'Fahrerunterschrift darf maximal 16mm hoch sein').toBeLessThanOrEqual(62);
  expect(result.signatureHeight).toBeGreaterThan(0);
  expect(result.signatureImageHeight,'Signaturbild darf maximal 15mm hoch sein').toBeLessThanOrEqual(58);
  expect(result.maxCardHeight,'Die alte hohe Signaturfläche darf die komplette Pickup-Zeile nicht mehr aufziehen').toBeLessThanOrEqual(120);
  expect(result.palletMarker,'Palettenkonto muss als normalisierter Einzelwert markiert sein').toBe(true);
  expect(result.palletValueCount,'Palettenkonto darf nur einen dynamischen Wert enthalten').toBe(1);
  expect(result.palletText).not.toMatch(/Ausgang:\s*99/i);
  expect(result.bodyText).not.toMatch(/ALTE UNTERSCHRIFT|ALTER FAHRER|ALTES DATUM|ALTES KENNZEICHEN|ALTER VERLADER|ALTER ERSATZBLOCK|Alter Hilfetext/i);

  await assertRuntimeClean(guard,testInfo);
});