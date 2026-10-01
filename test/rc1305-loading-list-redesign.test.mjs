import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const search=fs.readFileSync('assets/rc1283-loading-list-search.js','utf8');
const print=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const FLOW=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

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

test('RC1363: Lieferscheine und Bemerkung werden drucksicher kompakt untereinander dargestellt',()=>{
  assert.match(print,/data-rc1305-document-grid/);
  assert.match(print,/display:flex!important/); assert.match(print,/flex-direction:column!important/); assert.doesNotMatch(print,/grid-auto-flow:column/); assert.doesNotMatch(print,/docColumns=Math\.max\(1,Math\.ceil\(docCount\/15\)\)/); assert.match(print,/font-size:6\.2pt!important/); assert.match(print,/data-rc1326-font-reduced/); assert.match(print,/shrinkInlineFonts\(root,1\)/);
  assert.match(print,/word-break:break-word/); assert.match(print,/overflow-wrap:anywhere/); assert.ok(print.includes('function splitPdfNames(')); assert.ok(print.includes("var grid=body||d.createElement('div')")); assert.ok(print.includes('grid.style.cssText'));
  assert.match(print,/data-rc1305-remark/);
  assert.match(print,/loadingListPrint\.noRemark/);
  assert.match(print,/page-break-inside:avoid/);
  assert.match(print,/loadingListPrint\.palletMovement/);
});

test('RC1368: Drei-Umgebungen-Build liefert die aktuelle Ladelisten-Druckruntime aus',()=>{
  assert.match(build,/function patchRc1305LoadingListPresentation\(html,file\)/);
  assert.match(build,/assets\/rc1305-loading-list-print\.js\?v=1376/);
  assert.match(build,/assets\/rc1315-loading-list-quick-print\.js\?v=1322/);
  assert.match(build,/assets\/rc1283-loading-list-search\.js\?v=1305/);
  assert.match(build,/'assets\/rc1305-loading-list-print\.js'/);
  assert.match(build,/patchRc1305LoadingListPresentation\(html,file\)/);
  assert.match(build,/loadingListPrintRedesign:'RC1376/); assert.match(print,/data-rc1363-document-density/);
});

test('RC1374: Production- und Live-Gate prüfen dieselbe aktuelle Ladelisten-Druckruntime wie der Build',()=>{
  assert.match(FLOW,/RC1376 Produktions-Drucklayout live verifizieren/);
  assert.match(build,/assets\/rc1305-loading-list-print\.js\?v=1376/);
  assert.match(FLOW,/assets\/rc1305-loading-list-print\.js\?v=1376/);
  assert.match(FLOW,/display:flex!important/);
  assert.match(FLOW,/flex-direction:column!important/);
  assert.match(FLOW,/important\(code,'width','12mm'\)/);
  assert.match(FLOW,/important\(svg,'width','12mm'\)/);
  assert.doesNotMatch(FLOW,/assets\/rc1305-loading-list-print\.js\?v=1362/);
  assert.doesNotMatch(FLOW,/docColumns=Math\.max\(1,Math\.ceil\(docCount\/15\)\)/);
});

test('RC1305: geänderte JavaScript-Dateien sind syntaktisch gültig',()=>{
  for(const file of ['assets/rc1283-loading-list-search.js','assets/rc1305-loading-list-print.js','.github/rc1112/build-three-env.mjs']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});


test('RC1364: Lieferscheinrahmen bleiben inhaltsbreit und Empfänger wird kundentypabhängig hervorgehoben',()=>{
  assert.match(print,/data-rc1364-recipient-kind/);
  assert.match(print,/isEssentraRecipient/);
  assert.match(print,/display:inline-flex!important/);
  assert.match(print,/width:fit-content!important/);
  assert.match(print,/data-rc1364-recipient-kind="essentra"/);
  assert.match(print,/data-rc1364-recipient-kind="customer"/);
  assert.ok(print.includes("empf[aä]nger(?:\\s*\\/\\s*kunde)?"));
});


test('RC1376: Druck-QR bleibt 12mm gross',()=>{
  assert.match(print,/version:'RC1376'/);
  assert.match(print,/important\(code,'width','12mm'\)/);
  assert.match(print,/important\(svg,'width','12mm'\)/);
  assert.match(print,/shape-rendering="crispEdges"/);
});


test('RC1376: Build lädt die aktuelle Druckruntime cache-sicher',()=>{
  assert.match(FLOW,/assets\/rc1305-loading-list-print\.js\?v=1376/);
  assert.doesNotMatch(FLOW,/assets\/rc1305-loading-list-print\.js\?v=1363/);
  assert.match(build,/loadingListPrintRedesign:'RC1376/);
});


test('RC1372: blaue Lieferscheinrahmen bleiben inhaltsbreit und Dateischrift ist 1pt groesser',()=>{
  assert.match(print,/align-items:flex-start!important;gap:/);
  assert.match(print,/align-self:flex-start!important;flex:0 1 auto!important;width:fit-content!important/);
  assert.doesNotMatch(print,/gap:'\+metrics\.gap\+'!important;align-items:stretch!important/);
  assert.match(print,/font:'6\.2pt'/);
  assert.match(print,/font:'5\.6pt'/);
  assert.match(print,/font:'5\.2pt'/);
  assert.match(print,/padding:\.25mm \.35mm!important/);
});


test('RC1374: Marken-Domain-DNS kann keinen erfolgreichen Produktions-Deploy mehr blockieren',()=>{
  assert.match(FLOW,/RC1374 ExportHUB360 Marken-Domain prüfen/);
  assert.match(FLOW,/continue-on-error: true/);
  const prodStart=FLOW.indexOf('RC1376 Produktions-Drucklayout live verifizieren');
  const brandedStart=FLOW.indexOf('RC1374 ExportHUB360 Marken-Domain prüfen');
  assert.ok(prodStart>=0&&brandedStart>prodStart,'RC1374 Live-Gates fehlen oder sind falsch sortiert');
  const prodBlock=FLOW.slice(prodStart,brandedStart);
  assert.doesNotMatch(prodBlock,/branded='https:\/\/exporthub360\.com'/);
  assert.doesNotMatch(prodBlock,/brandedAvis/);
  const brandedBlock=FLOW.slice(brandedStart,FLOW.indexOf('Live RC1071 Sendungshistorie prüfen',brandedStart));
  assert.match(brandedBlock,/exporthub360\.com/);
  assert.match(brandedBlock,/::warning::RC1374 ExportHUB360 Marken-Domain/);
});


test('RC1376: Deckblatt verwendet denselben Empfaenger-Fix wie die Ladeliste',()=>{
  assert.match(print,/function enhanceCover\(html,sh\)/);
  assert.match(print,/enhanceRecipient\(root,sh\|\|\{\}\);enhanceDocuments\(root,sh\|\|\{\}\)/);
  assert.match(print,/version:'RC1376'/);
});
