import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const runtime=fs.readFileSync('assets/rc1203-deckblatt-print.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const browser=fs.readFileSync('e2e/specs/print-documents.spec.mjs','utf8');
const demo=fs.readFileSync('assets/exporthub-demo-bootstrap.js','utf8');

test('RC1281: rc390-Deckblattdruck ist weiß, reduziert und drucksicher',()=>{
  assert.match(runtime,/\.rc390-cover,\.rc352-cover/);
  assert.match(runtime,/border='3mm solid #334155'/);
  assert.match(runtime,/borderTopWidth='5mm'/);
  assert.match(runtime,/outline='0'/);
  assert.match(runtime,/background='#ffffff'/);
  assert.match(runtime,/webkitPrintColorAdjust='exact'/);
  assert.match(runtime,/printColorAdjust='exact'/);
  assert.match(runtime,/data-rc1203-cover-enhanced/);
});

test('RC1203: Bemerkung aus Sendungsdaten wird immer als eigener Deckblattblock ausgegeben',()=>{
  assert.match(runtime,/sh\.remark,sh\.remarks,sh\.bemerkung,sh\.comments/);
  assert.match(runtime,/data-rc1203-cover-remark/);
  assert.match(runtime,/title\.textContent='Bemerkung'/);
  assert.match(runtime,/body\.textContent=value/);
  assert.match(runtime,/data-rc896-field="remark"/);
  assert.match(runtime,/data-rc1203-remark-value/);
});

test('RC1281: Referenz und Empfänger folgen der Essentra-/Kunden-Farbregel',()=>{
  assert.match(runtime,/function isEssentraShipment\(sh\)/);
  assert.match(runtime,/refBg:'#facc15'/);
  assert.match(runtime,/recipientBg:'#fef9c3'/);
  assert.match(runtime,/refBg:'#2563eb'/);
  assert.match(runtime,/recipientBg:'#dbeafe'/);
  assert.match(runtime,/data-rc1281-customer-theme/);
  assert.match(runtime,/data-rc1203-recipient-highlight/);
  assert.match(runtime,/data-rc1203-reference-highlight/);
});

test('RC1281: Erstellungsdatum stammt aus dem gespeicherten Sendungszeitpunkt und erzeugt keinen Renderloop',()=>{
  assert.match(runtime,/sh\.createdAt,sh\.createdDateTime,sh\.createdOn,sh\.createdDate,sh\.created/);
  assert.match(runtime,/Sendung erstellt/);
  assert.match(runtime,/data-rc1281-created-date/);
  assert.match(runtime,/data-rc1281-created-value/);
  assert.match(runtime,/stored===value/);
  assert.match(runtime,/Sendungsdaten\/i\.test\(current\).*Erstellt am\|Sendung erstellt/);
  assert.match(build,/created=dateDe\(sh&&\(sh\.createdAt\|\|sh\.createdDateTime\|\|sh\.createdOn\|\|sh\.createdDate\|\|sh\.created\)\)/);
});

test('RC1205: genau eine zusätzliche Deckblatt-Aktion bleibt übrig',()=>{
  assert.match(runtime,/Nur Deckblatt drucken/);
  assert.doesNotMatch(runtime,/Nur CMR drucken/);
  assert.match(runtime,/return d\.querySelector\('#rc363BlockActions'\)/);
  assert.match(runtime,/removeLegacyExtraButtons/);
  assert.doesNotMatch(runtime,/function documentsViewVisible\(\)/);
});

test('RC1203: echter coverHtml-Renderer trägt Farbe und Bemerkung direkt in den Druckframe',()=>{
  assert.match(build,/function patchRc1203ActualDeckblatt\(html,file\)/);
  assert.match(build,/data-rc1203-cover-enhanced="1"/);
  assert.match(build,/data-rc1203-cover-remark="1"/);
  assert.match(build,/data-rc1203-reference-highlight="1"/);
  assert.match(build,/border:3mm solid #334155!important/);
  assert.match(build,/border-top-width:5mm!important/);
  assert.match(build,/background:#fff!important/);
  assert.match(build,/data-rc1281-customer-theme/);
  assert.match(build,/data-rc1281-created-date="1"/);
  assert.match(build,/Erstellt am:/);
  assert.match(build,/#facc15/);
  assert.match(build,/#2563eb/);
  assert.match(build,/#fef9c3/);
  assert.match(build,/#dbeafe/);
  assert.match(build,/sh\.remark\|\|sh\.remarks\|\|sh\.bemerkung\|\|sh\.comments/);
});

test('RC1203: Runtime wird in Produktion TESTSERVICE und Demo gebaut',()=>{
  assert.match(build,/assets\/rc1203-deckblatt-print\.js\?v=1281/);
  assert.match(build,/'assets\/rc1203-deckblatt-print\.js'/);
  assert.match(build,/deckblattHighVisibility:'RC1281 white cover/);
  assert.match(build,/coverRemark:'RC1281 compact remark block above QR without overlap'/);
  assert.match(build,/coverOnlyPrint:'RC1205 single Nur Deckblatt drucken action inside Speichern & Ausgabe'/);
  assert.doesNotMatch(build,/cmrOnlyPrint:/);
});

test('RC1203: Browser-Gate prüft echte Druckausgabe statt nur Quelltext',()=>{
  assert.match(browser,/data-rc1203-cover-enhanced/);
  assert.match(browser,/data-rc1203-cover-remark/);
  assert.match(browser,/RC1203 Demo-Bemerkung/);
  assert.match(demo,/comments:'RC1203 Demo-Bemerkung:/);
  assert.match(browser,/coverStyle:cs/);
  assert.match(browser,/backgroundColor:cs\.backgroundColor/);
  assert.match(browser,/backgroundImage:cs\.backgroundImage/);
  assert.match(browser,/expect\(capture\.coverStyle\.backgroundColor\)\.toBe\('rgb\(255, 255, 255\)'\)/);
  assert.match(browser,/expect\(capture\.coverStyle\.backgroundImage\)\.toBe\('none'\)/);
});


test('RC1281: Essentra-Browserabnahme nutzt feste Demo-Daten ohne State-Mutation',()=>{
  assert.match(demo,/DEMO03[\s\S]*Essentra Components Sweden AB/);
  assert.match(browser,/DEMO03\|Essentra\|Fake Export/);
  assert.doesNotMatch(browser,/__EXPORTHUB_GET_STATE__/);
  assert.match(browser,/referenceBackground/);
  assert.match(browser,/recipientBackground/);
});


test('RC1281: geänderte Runtime und Browserprüfung sind syntaktisch gültig',()=>{
  for(const file of ['assets/rc1203-deckblatt-print.js','e2e/specs/print-documents.spec.mjs','.github/rc1112/build-three-env.mjs']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});


test('RC1204: Bemerkung bleibt kompakt und QR-Bereich erhält Abstand',()=>{
  assert.match(runtime,/maxHeight='28mm'/);
  assert.match(runtime,/margin-bottom:5mm/);
  assert.match(runtime,/\.rc390-cover-qr\{margin-top:5mm!important;position:relative!important;clear:both!important\}/);
  assert.doesNotMatch(runtime,/linear-gradient\(180deg,#93c5fd/);
  assert.doesNotMatch(runtime,/12mm solid #0b1f44/);
});
