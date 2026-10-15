import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8')}
function write(path,value){fs.writeFileSync(path,value)}
function replaceOnce(source,before,after,label){
  const count=source.split(before).length-1;
  if(count!==1)throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(before,after);
}

// Product fix: pallet balance replacement must not depend on pickup-summary existence.
{
  const path='assets/document-print-name.js';
  let source=read(path);
  const start=source.indexOf('function restorePickupFields(html,sh){');
  const end=source.indexOf('\nfunction install(){',start);
  if(start<0||end<0)throw new Error('RC1543 restorePickupFields block not found');
  const replacement=`function restorePickupFields(html,sh){
 if(!d||!d.createElement||typeof html!=='string')return html;
 try{
  var tpl=d.createElement('template');tpl.innerHTML=html;var scope=tpl.content&&tpl.content.querySelectorAll?tpl.content:null;if(!scope)return html;
  var roots=Array.from(scope.querySelectorAll('.rc390-load,.rc352-load'));
  if(!roots.length){var fallback=scope.querySelector('.rc390-page,.rc352-page');if(fallback)roots=[fallback]}
  if(!roots.length)return html;
  ensureImage4Style();
  var last=lastPickup(sh||{}),missing=notRecorded(),palletAccount=palletBalanceForShipment(sh||{});
  var driver=value(sh,last,['driverName','pickupDriverName','fahrerName'])||missing;
  var plate=value(sh,last,['licensePlate','pickupLicensePlate','vehicleRegistration','vehiclePlate','kennzeichen'])||missing;
  var loader=value(sh,last,['loaderName','pickupLoaderName','loadedBy','warehouseLoader','loader','verlader'])||missing;
  var confirmed=value(sh,last,['confirmedAt','pickupConfirmedAt','pickedUpAt','actualPickupAt']);
  var signature=safeSignatureSource(value(sh,last,['driverSignature','signature','signatureData','driverSignatureUrl','pickupDriverSignatureUrl']));
  var signatureStored=!!(signature||value(sh,last,['signatureBlobName','signatureStoredAt'])||last&&last.signatureStored===true||sh&&sh.signatureAvailable===true);
  roots.forEach(function(root){
   var palletCard=findCard(root,/europaletten.*ausgang|euro\\s*pallet|palettenkonto/i);
   putPalletBalance(palletCard,palletAccount);
   root.setAttribute('data-rc1543-pallet-balance','1');
   var summary=root.querySelector('[data-rc1305-pickup-summary]');
   if(!summary)return;
   summary.innerHTML='';summary.setAttribute('aria-hidden','true');summary.setAttribute('data-rc1503-legacy-summary-hidden','1');summary.style.setProperty('display','none','important');
   Array.from(root.querySelectorAll('[data-rc1305-replaced-pickup-field]')).forEach(function(card){card.style.removeProperty('display');card.removeAttribute('data-rc1305-replaced-pickup-field')});
   putSignature(findCard(root,/unterschrift.*fahrer|fahrer.*unterschrift|driver.*signature|signature/i),signature,signatureStored);
   putValue(findCard(root,/^fahrername$|^fahrer$|driver\\s*name/i),driver,'rc1305-meta-driver');
   putValue(findCard(root,/datum\\s*\\/\\s*uhrzeit|date\\s*\\/\\s*time/i),formatDate(confirmed),'rc1503-pickup-date');
   putValue(findCard(root,/kennzeichen|license\\s*plate|vehicle\\s*registration/i),plate,'rc1305-meta-plate');
   putValue(findCard(root,/^verlader$|^loader$/i),loader,'rc1305-meta-loader');
   root.setAttribute('data-rc1503-image4-pickup-layout','1');
  });
  return tpl.innerHTML
 }catch(e){try{console.warn('RC1543 Ladelisten-Palettenkontostand',e)}catch(_){}return html}
}`;
  source=source.slice(0,start)+replacement+source.slice(end);
  write(path,source);
}

// Browser fixture: current balance must exist before selecting a shipment because selection prepares the print cache.
{
  const path='e2e/specs/print-documents.spec.mjs';
  let source=read(path);
  const old=`  await selectLoadingListShipment(page,'DEMO01',/DEMO01|Nord/i);\n  await expect(page.locator('#content')).toContainText(/DEMO01/,{timeout:10_000});\n\n  await page.evaluate(()=>{\n    window.__RC1543_ORIGINAL_PALLET_LEDGER__=window.ExportHUBPalletLedger;\n    window.ExportHUBPalletLedger=Object.freeze({\n      balanceFor:key=>({key:String(key||''),type:'customer',name:'Nord',balance:7}),\n      accounts:()=>[]\n    });\n  });`;
  const next=`  await page.evaluate(()=>{\n    window.__RC1543_ORIGINAL_PALLET_LEDGER__=window.ExportHUBPalletLedger;\n    window.ExportHUBPalletLedger=Object.freeze({\n      balanceFor:key=>({key:String(key||''),type:'customer',name:'Nord',balance:7}),\n      accounts:()=>[]\n    });\n  });\n  expect(await page.evaluate(()=>window.ExportHUBPalletLedger&&window.ExportHUBPalletLedger.balanceFor('customer:probe')?.balance)).toBe(7);\n\n  await selectLoadingListShipment(page,'DEMO01',/DEMO01|Nord/i);\n  await expect(page.locator('#content')).toContainText(/DEMO01/,{timeout:10_000});\n  expect(await page.evaluate(()=>window.ExportHUBPalletLedger&&window.ExportHUBPalletLedger.balanceFor('customer:probe')?.balance)).toBe(7);`;
  source=replaceOnce(source,old,next,'RC1543 browser fixture order');
  write(path,source);
}

// Focused contract: pre-pickup loading lists must also pass through pallet-balance replacement.
{
  const path='test/rc1543-loading-list-pallet-balance.test.mjs';
  let source=read(path);
  if(!source.includes("test('RC1543: Palettenkontostand wird auch vor der Abholung unabhängig vom Pickup-Summary ersetzt'")){
    source += `\n\ntest('RC1543: Palettenkontostand wird auch vor der Abholung unabhängig vom Pickup-Summary ersetzt',()=>{\n  assert.doesNotMatch(source,/if\\(!summary\\)return html/,'Palettenkontostand darf nicht vom Pickup-Summary abhängen');\n  assert.match(source,/querySelectorAll\\('\\.rc390-load,\\.rc352-load'\\)/,'alle Ladelisten müssen den Kontostand erhalten');\n  assert.match(source,/roots\\.forEach\\(function\\(root\\)/,'Kontostand muss je Ladeliste ersetzt werden');\n});\n`;
  }
  write(path,source);
}

console.log('RC1543 pre-pickup pallet balance integration fixed.');
