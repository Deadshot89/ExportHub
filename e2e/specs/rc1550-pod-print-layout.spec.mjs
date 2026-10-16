import {test,expect} from '@playwright/test';
import {appEntry,waitReady,attachRuntimeGuards,assertRuntimeClean} from '../helpers/exporthub-browser.mjs';

test('RC1556: reale verschachtelte POD-Abholfelder bleiben kompakt und zeigen jeden Wert genau einmal',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','POD-Drucklayout wird einmal im echten Chromium geprüft.');
  test.setTimeout(45_000);
  const guard=attachRuntimeGuards(page,testInfo);

  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await page.emulateMedia({media:'print'});

  const result=await page.evaluate(async()=>{
    const api=window.ExportHUBRC1305LoadingListPrint;
    if(!api||typeof api.enhance!=='function')throw new Error('RC1556 Ladelisten-Runtime fehlt');

    const textCard=(label,oldValue)=>'<div class="rc390-card rc1556-card"><div class="rc390-label">'+label+'</div><div class="rc1556-body"><div class="rc1556-inner"><div class="rc390-txt">'+oldValue+'</div></div></div></div>';
    const signatureCard='<div class="rc390-card rc1556-card"><div class="rc390-label">Unterschrift Fahrer</div><div class="rc1556-body"><div class="rc1556-inner"><div class="rc390-txt"><img data-rc1556-legacy-signature src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" style="display:block;width:100%;height:68mm"></div></div></div></div>';
    const palletCard='<div class="rc390-card rc1556-card"><div class="rc390-label">Europaletten Ausgang</div><div class="rc1556-body"><div class="rc1556-inner"><div class="rc390-txt"><strong>Ausgang: 99 Europaletten</strong><div>Ausgang: 99</div><div>Eingang/Rückgabe: 77</div></div></div></div></div>';
    const raw='<style>.rc1556-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2mm;align-items:stretch}.rc1556-card{box-sizing:border-box;padding:2mm;border:1px solid #cbd5e1}.rc1556-body{min-width:0}</style>'+
      '<section class="rc390-page rc390-load" style="box-sizing:border-box;width:194mm;min-height:120mm;margin:0;padding:8mm;overflow:visible">'+
      '<div class="rc1556-grid">'+
      signatureCard+
      textCard('Fahrername','Balletanu')+
      textCard('Datum / Uhrzeit','25.09.2026 08:41')+
      textCard('Kennzeichen','KÜN R 764')+
      textCard('Verlader','Daniel Ollmann')+
      palletCard+
      '</div></section>';

    const shipment={
      reference:'Y826DM',
      status:'Abgeholt',
      palletOut:12,
      signatureData:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iNDAiPjxwYXRoIGQ9Ik01IDI4IEMyNSA1IDQwIDM1IDYwIDEyIFM5NSAzMCAxMTUgOCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIzIi8+PC9zdmc+',
      pickupHistory:[{
        complete:true,
        driverName:'Balletanu',
        licensePlate:'KÜN R 764',
        loaderName:'Daniel Ollmann',
        confirmedAt:'2026-09-25T08:41:00.000Z',
        returnedEuroPallets:0
      }]
    };

    document.body.innerHTML=api.enhance(raw,shipment,true);
    const root=document.querySelector('.rc390-load');
    if(!root)throw new Error('RC1556 Ladeliste wurde nicht gerendert');
    const signature=root.querySelector('.rc1503-signature-value');
    const signatureImage=root.querySelector('.rc1503-signature-value .rc1305-signature-image');
    if(signatureImage){
      try{
        if(typeof signatureImage.decode==='function'){
          await Promise.race([
            signatureImage.decode(),
            new Promise(resolve=>setTimeout(resolve,1200))
          ]);
        }else if(!signatureImage.complete){
          await Promise.race([
            new Promise(resolve=>{
              signatureImage.addEventListener('load',resolve,{once:true});
              signatureImage.addEventListener('error',resolve,{once:true});
            }),
            new Promise(resolve=>setTimeout(resolve,1200))
          ]);
        }
      }catch(_){}
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    }
    const signatureCardNode=signature&&signature.closest('[data-rc1503-pickup-field]');
    const pallet=root.querySelector('[data-rc1543-pallet-single-value="1"]');
    const fields=Array.from(root.querySelectorAll('[data-rc1503-pickup-field]'));
    const legacyNodes=Array.from(root.querySelectorAll('[data-rc1503-pickup-field] .rc390-txt,[data-rc1503-pickup-field] .rc352-txt'));
    const visibleLegacy=legacyNodes.filter(node=>{
      const style=getComputedStyle(node),rect=node.getBoundingClientRect();
      return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;
    });
    const values=fields.map(card=>Array.from(card.querySelectorAll('[data-rc1503-pickup-value]')).filter(node=>node.closest('[data-rc1503-pickup-field]')===card));
    const overflows=values.flat().filter(value=>{
      const vr=value.getBoundingClientRect(),cr=value.closest('[data-rc1503-pickup-field]').getBoundingClientRect();
      return vr.right>cr.right+1||vr.bottom>cr.bottom+1||vr.left<cr.left-1||vr.top<cr.top-1;
    }).length;
    let overlap=false;
    const dynamicValues=values.flat();
    for(let i=0;i<dynamicValues.length;i++)for(let j=i+1;j<dynamicValues.length;j++){
      const a=dynamicValues[i].getBoundingClientRect(),b=dynamicValues[j].getBoundingClientRect();
      const x=Math.min(a.right,b.right)-Math.max(a.left,b.left),y=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
      if(x>1&&y>1)overlap=true;
    }
    const sr=signature&&signature.getBoundingClientRect(),ir=signatureImage&&signatureImage.getBoundingClientRect(),scr=signatureCardNode&&signatureCardNode.getBoundingClientRect();
    const heights=fields.map(card=>card.getBoundingClientRect().height);
    const bodyText=String(document.body.innerText||'');
    const occurrences=(needle)=>bodyText.split(needle).length-1;
    return{
      pickupFieldCount:fields.length,
      visibleLegacyCount:visibleLegacy.length,
      legacyTexts:visibleLegacy.map(node=>String(node.innerText||node.textContent||'').trim()),
      directValueCounts:values.map(list=>list.length),
      overflows,
      overlap,
      signatureHeight:sr&&sr.height||0,
      signatureImageHeight:ir&&ir.height||0,
      signatureCardHeight:scr&&scr.height||0,
      maxPickupCardHeight:heights.length?Math.max(...heights):0,
      minPickupCardHeight:heights.length?Math.min(...heights):0,
      palletMarker:!!pallet,
      palletValueCount:pallet?pallet.querySelectorAll('[data-rc1503-pickup-value]').length:0,
      palletText:pallet?String(pallet.innerText||pallet.textContent||'').trim():'',
      bodyText,
      driverOccurrences:occurrences('Balletanu'),
      plateOccurrences:occurrences('KÜN R 764'),
      loaderOccurrences:occurrences('Daniel Ollmann')
    };
  });

  expect(result.pickupFieldCount,'Alle sechs Abholfelder müssen erhalten bleiben').toBe(6);
  expect(result.visibleLegacyCount,'Auch verschachtelte alte Pickup-Werte müssen vollständig verschwinden').toBe(0);
  expect(result.directValueCounts,'Jedes Abholfeld darf genau einen kanonischen dynamischen Wert enthalten').toEqual([1,1,1,1,1,1]);
  expect(result.overflows,'Pickup-Werte dürfen ihre Karten nicht überragen').toBe(0);
  expect(result.overlap,'Pickup-Werte dürfen sich nicht gegenseitig überlappen').toBe(false);
  expect(result.signatureHeight,'Fahrerunterschrift darf maximal 16mm hoch sein').toBeLessThanOrEqual(62);
  expect(result.signatureHeight).toBeGreaterThan(0);
  expect(result.signatureImageHeight,'Signaturbild darf maximal 15mm hoch sein').toBeLessThanOrEqual(58);
  expect(result.signatureImageHeight,'Signaturbild muss sichtbar bleiben').toBeGreaterThan(0);
  expect(result.signatureCardHeight,'Das äußere Unterschriftsfeld darf nicht mehr wie im Produktionsfehler aufgezogen werden').toBeLessThanOrEqual(92);
  expect(result.maxPickupCardHeight,'Kein Abholfeld darf durch versteckte Altinhalte riesig werden').toBeLessThanOrEqual(92);
  expect(result.maxPickupCardHeight-result.minPickupCardHeight,'Abholfelder derselben Grid-Zeilen sollen kompakt bleiben').toBeLessThanOrEqual(16);
  expect(result.palletMarker,'Palettenkonto muss als normalisierter Einzelwert markiert sein').toBe(true);
  expect(result.palletValueCount,'Palettenkonto darf nur einen dynamischen Wert enthalten').toBe(1);
  expect(result.palletText).not.toMatch(/Ausgang:\s*99|Eingang\/Rückgabe:\s*77/i);
  expect(result.driverOccurrences,'Fahrername darf nicht doppelt sichtbar sein').toBe(1);
  expect(result.plateOccurrences,'Kennzeichen darf nicht doppelt sichtbar sein').toBe(1);
  expect(result.loaderOccurrences,'Verlader darf nicht doppelt sichtbar sein').toBe(1);
  expect(result.bodyText).not.toMatch(/ALTE UNTERSCHRIFT|ALTER FAHRER|ALTES DATUM|ALTES KENNZEICHEN|ALTER VERLADER/i);

  await assertRuntimeClean(guard,testInfo);
});