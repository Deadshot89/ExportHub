import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const compat=fs.readFileSync('assets/rc1063-abd-blob-viewer-compat.js','utf8');
const history=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const audit=fs.readFileSync('assets/rc1081-audit-history.js','utf8');
const historyDe=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));

test('RC1151: Sendungsansicht behandelt Rechnung Lieferschein ABD POD und weitere Dateien einheitlich',()=>{
  for(const marker of ['invoiceFiles','deliveryFiles','deliveryNotesFiles','lieferscheine','abdFiles','podFiles','generatedDocuments','attachments']){
    assert.match(compat,new RegExp(marker),marker+' fehlt in der Dokument-Sammlung');
  }
  assert.match(compat,/data-rc1151-document-row/,'ergänzte Dokumentzeilen fehlen');
  assert.match(compat,/exporthub:document-action/,'Dokumentaktionen werden nicht an die History gemeldet');
  assert.match(compat,/action:download\?'download':'open'/,'Öffnen und Download müssen getrennt gemeldet werden');
});

test('RC1151: Sendungshistorie ist eine klare Tabelle mit drei Spalten',()=>{
  assert.match(history,/<table class="rc1071-history-table">/);
  assert.match(history,/shipmentHistory\.column\.action/);
  assert.match(history,/shipmentHistory\.column\.user/);
  assert.match(history,/shipmentHistory\.column\.time/);
  assert.equal(historyDe['shipmentHistory.column.action'],'Arbeitsschritt');
});

test('RC1151: Dokument-Download ist ein eigener nachvollziehbarer Arbeitsschritt',()=>{
  assert.match(history,/type:'document-download'/);
  assert.match(history,/shipmentHistory\.action\.documentDownloaded/);
  assert.match(history,/exporthub:document-action/);
});

test('RC1151: ABD-Anfrage wird nicht durch Nachbartexte als Druckvorgang protokolliert',()=>{
  assert.match(history,/shipmentHistory\.action\.abdRequestCreated/);
  assert.match(history,/shipmentHistory\.action\.abdEmailOpened/);
  assert.match(history,/actionText=low\(text\)/);
  assert.match(history,/knownDoc&&\/druck\|print\|gesamtausgabe\/\.test\(actionText\)/);
});

test('RC1151: aktualisierte History und Dokumentansicht werden cache-sicher ausgeliefert',()=>{
  assert.match(build,/rc1071-shipment-history\.js\?v=1178/);
  assert.match(build,/rc1063-abd-blob-viewer-compat\.js\?v=1248/);
});


test('RC1151: globale History verwendet dieselben klaren Dokument- und ABD-Bezeichnungen',()=>{
  assert.match(audit,/function shipmentActionTitle/);
  assert.match(audit,/shipmentLegacyCode[\s\S]*abdRequestCreated/);
  assert.match(audit,/shipmentLegacyCode[\s\S]*abdEmailOpened/);
  assert.match(audit,/'document-download':'history\.shipment\.document-download'/);
});
