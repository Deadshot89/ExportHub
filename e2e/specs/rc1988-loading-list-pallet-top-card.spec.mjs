import {test,expect} from '@playwright/test';
import {appEntry,waitReady} from '../helpers/exporthub-browser.mjs';

test('RC1988: Palettenkonto appears as third top loading-list card with current ledger balance',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Print layout is verified on the laptop profile.');
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await page.emulateMedia({media:'print'});
  const result=await page.evaluate(()=>{
    const api=window.ExportHUBDocumentPrintNames;
    if(!api||typeof api.restorePickupFields!=='function')throw new Error('Missing RC1543 print helper');
    const originalLedger=window.ExportHUBPalletLedger;
    const rows='<div class="rc390-card"><div class="rc390-label">Warenbeschreibung</div><div class="rc390-txt">Kunststoffteile</div></div>'+
      '<div class="rc390-card"><div class="rc390-label">Transport</div><div class="rc390-txt">LKW</div></div>';
    const html='<section class="rc390-load"><div class="rc390-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr))">'+rows+'</div></section>';
    function check(sh){
      const holder=document.createElement('div');
      holder.innerHTML=api.restorePickupFields(html,sh);
      const cards=Array.from(holder.querySelectorAll('.rc390-grid > .rc390-card'));
      const top=holder.querySelector('[data-rc1988-pallet-top-card]');
      const grid=holder.querySelector('.rc390-grid');
      return{
        count:cards.length,thirdIsPallet:cards[2]===top,
        amount:top?.querySelector('[data-rc1988-pallet-balance]')?.textContent||'',
        beneficiary:top?.querySelector('[data-rc1988-pallet-beneficiary]')?.textContent||'',
        columns:grid?.style.getPropertyValue('grid-template-columns')||'',
        label:top?.querySelector('.rc390-label')?.textContent||''
      };
    }
    try{
      window.ExportHUBPalletLedger=null;
      const shipment={id:'RC1988-TEST',rows:[{type:'Europalette',count:2}],palletOut:2};
      const positive=check({...shipment,__rc1543PalletBalanceSnapshot:{balance:12}});
      const negative=check({...shipment,__rc1543PalletBalanceSnapshot:{balance:-8}});
      const zero=check({...shipment,__rc1543PalletBalanceSnapshot:{balance:0}});
      const missing=check(shipment);
      const cartons=check({id:'RC1988-NO-EUR',rows:[{type:'Karton',count:3}],__rc1543PalletBalanceSnapshot:{balance:12}});
      return{positive,negative,zero,missing,cartons};
    }finally{window.ExportHUBPalletLedger=originalLedger}
  });
  expect(result.positive.count).toBe(3);
  expect(result.positive.thirdIsPallet).toBe(true);
  expect(result.positive.columns).toContain('repeat(3');
  expect(result.positive.label).toBe('Palettenkonto');
  expect(result.positive.amount).toBe('12 Europaletten');
  expect(result.positive.beneficiary).toBe('Zu Gunsten Essentra');
  expect(result.negative.beneficiary).toBe('Zu Gunsten Kunden');
  expect(result.negative.amount).toBe('8 Europaletten');
  expect(result.zero.amount).toBe('0 Europaletten');
  expect(result.zero.beneficiary).toBe('Konto ausgeglichen');
  expect(result.missing.beneficiary).toBe('Kontostand nicht verfügbar');
  expect(result.cartons.count).toBe(2);
});
