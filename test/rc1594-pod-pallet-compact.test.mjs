import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../api/shared/pod-archive.js',import.meta.url),'utf8');
const helperStart=source.indexOf('function palletBalanceText(record) {');
const helperEnd=source.indexOf('\nasync function createPodPdf(',helperStart);
const pdfBlock=source.slice(helperEnd,source.indexOf('async function readAutomaticPodBuffer(',helperEnd));
assert.ok(helperStart>=0&&helperEnd>helperStart,'POD pallet formatter source was not found');

function helpers(){
  const runtime={store:{pickupHistory:r=>Array.isArray(r&&r.pickupHistory)?r.pickupHistory:[]}};
  vm.runInNewContext(
    "function text(v){return String(v == null ? '' : v).replace(/\\s+/g,' ').trim()}\n"+
    source.slice(helperStart,helperEnd)+
    "\nglobalThis.palletFormat={balance:palletBalanceText,returned:palletReturnText};",
    runtime,{filename:'pod-pallet-formatter.js'}
  );
  return runtime.palletFormat;
}

test('RC1594: automated POD prints the same signed EUR-pallet balance as the loading list, not shipment palletOut',()=>{
  const f=helpers();
  assert.equal(f.balance({palletAccountSnapshot:{balance:7},palletOut:2}),'+7 EP');
  assert.equal(f.balance({palletAccountSnapshot:{balance:-4},palletOut:12}),'-4 EP');
  assert.equal(f.balance({palletAccountSnapshot:{balance:0},palletOut:5}),'0 EP');
  assert.equal(f.balance({palletOut:9}),'-','unknown balance must not be mistaken for pallet movements');
});

test('RC1594: signed POD return shows confirmed positive EUR pallets or a manual blank, never an invented zero',()=>{
  const f=helpers();
  assert.equal(f.returned({pickupHistory:[{returnedEuroPallets:3}]}),'3 EP');
  assert.equal(f.returned({pickupHistory:[{returnedEuroPallets:0}]}),'');
  assert.equal(f.returned({returnedEuroPallets:2}),'2 EP');
  assert.equal(f.returned({returnedEuroPallets:-2}),'');
  assert.equal(f.returned({palletOut:5}),'');
});

test('RC1594: automated signed POD has both compact rows inside the existing pallet tile',()=>{
  assert.match(pdfBlock,/PALETTENKONTO \/ EUR PALLETS/);
  assert.match(pdfBlock,/Aktueller Stand \/ Balance/);
  assert.match(pdfBlock,/Eingang \/ Return/);
  assert.match(pdfBlock,/palletBalanceText\(record\)/);
  assert.match(pdfBlock,/palletReturnText\(record\)/);
  assert.match(pdfBlock,/page\.drawLine\(\{start:\{x:palletX\+cellW-48/,'blank return line must be printable');
  assert.doesNotMatch(pdfBlock,/card\('Europaletten-Kontostand'/);
  assert.match(source,/const POD_PDF_LAYOUT_VERSION = 'RC1594-SIGNED-LOADING-LIST-V3'/);
});
