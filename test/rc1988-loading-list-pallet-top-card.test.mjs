import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/document-print-name.js','utf8');
function api(){
  const context={console,__EXPORTHUB_GET_STATE__:()=>({customers:[]})};
  vm.runInNewContext(source,context,{filename:'assets/document-print-name.js'});
  return context.ExportHUBDocumentPrintNames;
}
function plain(value){return JSON.parse(JSON.stringify(value))}

test('RC1988: only shipments containing Euro pallets receive the new header card',()=>{
 const p=api();
 assert.equal(p.rc1988HasEuroPallets({rows:[{type:'Europalette',count:2}]}),true);
 assert.equal(p.rc1988HasEuroPallets({packages:[{type:'EUR Palette',qty:1}]}),true);
 assert.equal(p.rc1988HasEuroPallets({palletOut:3}),true);
 assert.equal(p.rc1988HasEuroPallets({colli:[{type:'Europalette',anzahl:4}]}),true);
 assert.equal(p.rc1988HasEuroPallets({collis:[{type:'EUR Palette',quantity:1}]}),true);
 assert.equal(p.rc1988HasEuroPallets({shipmentRows:[{packagingType:'Europalette',qty:3}]}),true);
 assert.equal(p.rc1988HasEuroPallets({items:[{type:'Europalette',count:1}]}),true);
 // Loading list uses the longest saved package array, not an outdated shorter array.
 assert.equal(p.rc1988HasEuroPallets({rows:[{type:'Europalette',count:1}],colli:[{type:'Karton',count:1},{type:'Karton',count:1}]}),false);
 assert.equal(p.rc1988HasEuroPallets({rows:[{type:'Karton',count:1}],colli:[{type:'Europalette',count:2},{type:'Karton',count:1}]}),true);
 assert.equal(p.rc1988HasEuroPallets({colli:[{type:'Europalette'}]}),false);

 assert.equal(p.rc1988HasEuroPallets({rows:[{type:'Karton',count:5}]}),false);
 assert.equal(p.rc1988HasEuroPallets({rows:[{type:'Europalette',count:0}]}),false);
 assert.equal(p.rc1988HasEuroPallets({}),false);
});
test('RC1988: visible header balance follows ledger sign, never this shipment palletOut',()=>{
 const p=api(),sh={rows:[{type:'Europalette',count:2}],palletOut:2};
 assert.deepEqual(plain(p.rc1988PalletTopCardData(sh,{balance:12})),{amount:'12 Europaletten',beneficiary:'Zu Gunsten Essentra'});
 assert.deepEqual(plain(p.rc1988PalletTopCardData(sh,{balance:-8,name:'Kunde B'})),{amount:'8 Europaletten',beneficiary:'Zu Gunsten Kunden'});
 assert.deepEqual(plain(p.rc1988PalletTopCardData(sh,{balance:0})),{amount:'0 Europaletten',beneficiary:'Konto ausgeglichen'});
 assert.deepEqual(plain(p.rc1988PalletTopCardData(sh,null)),{amount:'–',beneficiary:'Kontostand nicht verfügbar'});
 assert.deepEqual(plain(p.rc1988PalletTopCardData(sh,{balance:NaN})),{amount:'–',beneficiary:'Kontostand nicht verfügbar'});
 assert.deepEqual(plain(p.rc1988PalletTopCardData(sh,{balance:null})),{amount:'–',beneficiary:'Kontostand nicht verfügbar'});
 assert.deepEqual(plain(p.rc1988PalletTopCardData(sh,{balance:''})),{amount:'–',beneficiary:'Kontostand nicht verfügbar'});
 assert.equal(p.rc1988PalletTopCardData({rows:[{type:'Karton',count:2}]},{balance:12}),null);
});
test('RC1988: third header card is wired before pickup summary, with no new ledger writes',()=>{
 assert.match(source,/roots\.forEach\(function\(root\)\{rc1988InsertTopPalletCard\(root,sh,palletAccount\)/);
 assert.match(source,/data-rc1988-pallet-top-card/);
 assert.match(source,/data-rc1988-pallet-balance/);
 assert.match(source,/data-rc1988-pallet-beneficiary/);
 assert.ok(source.includes("repeat(3,minmax(0,1fr))"));
 const block=source.slice(source.indexOf('function rc1988InsertTopPalletCard('),source.indexOf('function restorePickupFields('));
 assert.doesNotMatch(block,/\.save\(|\.write\(/);
});
