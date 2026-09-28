import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const search=fs.readFileSync('assets/rc1283-loading-list-search.js','utf8');
const print=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1305: Ladelistensuche wird aus der schmalen Seitenzelle in eine volle Arbeitsfläche gehoben',()=>{
  assert.match(search,/function promotePanel\(panel,host,select\)/);
  assert.match(search,/rc1283-workspace-host/);
  assert.match(search,/gridColumn='1 \/ -1'/);
  assert.match(search,/data-rc1305-search-workspace/);
  assert.match(search,/data-rc1305-loading-list-intro/);
});

test('RC1305: Treffer zeigen kompakte Metadaten statt aller PDF-Dateinamen in einer Zeile',()=>{
  const start=search.indexOf('function resultMeta(row){');
  const end=search.indexOf('function style(){',start);
  assert.ok(start>=0&&end>start,'resultMeta konnte nicht isoliert werden');
  const block=search.slice(start,end);
  assert.match(block,/documentLabel\(Number\(row\.documentCount\)\|\|0\)/);
  assert.doesNotMatch(block,/row\.documents/);
  assert.match(search,/data-rc1305-selected-files/);
  assert.match(search,/rc1305-selected-file-grid/);
  assert.match(search,/overflow-wrap:anywhere/);
});

test('RC1305: Ladeliste ersetzt abgeholte Leerformulare durch gespeicherte Abholdaten',()=>{
  assert.match(print,/function pickupSummary\(root,sh\)/);
  assert.match(print,/pickupHistory/);
  for(const field of ['driverName','licensePlate','loaderName','confirmedAt','signatureBlobName','returnedEuroPallets']){
    assert.ok(print.includes(field),field+' fehlt im Abholnachweis');
  }
  assert.match(print,/data-rc1305-pickup-summary/);
  assert.match(print,/loadingListPrint\.pickedUp/);
  assert.match(print,/loadingListPrint\.notRecorded/);
  assert.match(print,/if\(!isPicked\(sh,last\)\)return false/,'offene Sendungen dürfen ihre Unterschriftsfelder nicht verlieren');
  assert.match(print,/function ensureCustomsSignatureField\(root,sh\)/);
  assert.match(print,/data-rc1327-customs-signature-field/);
  assert.match(print,/Zolldokumente erhalten/);
});

test('RC1305: Lieferscheine und Bemerkung werden drucksicher kompakt dargestellt',()=>{
  assert.match(print,/data-rc1305-document-grid/);
  assert.match(print,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/); assert.match(print,/font-size:5.8pt!important/); assert.match(print,/data-rc1326-font-reduced/); assert.match(print,/shrinkInlineFonts\(root,1\)/);
  assert.match(print,/word-break:break-word/);
  assert.match(print,/data-rc1305-remark/);
  assert.match(print,/loadingListPrint\.noRemark/);
  assert.match(print,/page-break-inside:avoid/);
  assert.match(print,/loadingListPrint\.palletMovement/);
});

test('RC1305: Drei-Umgebungen-Build liefert beide Ladelisten-Runtimes aus',()=>{
  assert.match(build,/function patchRc1305LoadingListPresentation\(html,file\)/);
  assert.match(build,/assets\/rc1305-loading-list-print\.js\?v=1326/);
  assert.match(build,/assets\/rc1315-loading-list-quick-print\.js\?v=1322/);
  assert.match(build,/assets\/rc1283-loading-list-search\.js\?v=1305/);
  assert.match(build,/'assets\/rc1305-loading-list-print\.js'/);
  assert.match(build,/patchRc1305LoadingListPresentation\(html,file\)/);
  assert.match(build,/loadingListPrintRedesign:'RC1305/);
});

test('RC1305: geänderte JavaScript-Dateien sind syntaktisch gültig',()=>{
  for(const file of ['assets/rc1283-loading-list-search.js','assets/rc1305-loading-list-print.js','.github/rc1112/build-three-env.mjs']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});
