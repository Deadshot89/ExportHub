import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/document-print-name.js','utf8');
const context={};
vm.runInNewContext(source,context,{filename:'assets/document-print-name.js'});
const api=context.ExportHUBDocumentPrintNames;

test('RC1504: normale Lieferschein-PDFs behalten die Endung, DNC/SIDE nicht',()=>{
  assert.ok(api);
  assert.equal(api.printName('DNC3019222063.pdf'),'DNC3019222063');
  assert.equal(api.printName('SIDE250071282.pdf'),'SIDE250071282');
  assert.equal(api.printName('Lieferschein Kunde.pdf'),'Lieferschein Kunde.pdf');
});

test('RC1504: DNC-Nummer und gleichnamige PDF-Datei teilen denselben Deduplizierungs-Schluessel',()=>{
  assert.equal(typeof api.canonicalDeliveryKey,'function');
  assert.equal(api.canonicalDeliveryKey('DNC3019222063'),api.canonicalDeliveryKey('DNC3019222063.pdf'));
  assert.equal(api.canonicalDeliveryKey('/download/DNC3019222063.pdf?token=abc'),'dnc3019222063');
  assert.notEqual(api.canonicalDeliveryKey('Lieferschein A.pdf'),api.canonicalDeliveryKey('Lieferschein B.pdf'));
});

test('RC1504: Lieferscheine wechseln exakt ab sechs Eintraegen auf zwei Spalten',()=>{
  assert.equal(typeof api.documentColumnCount,'function');
  assert.equal(api.documentColumnCount(0),1);
  assert.equal(api.documentColumnCount(5),1);
  assert.equal(api.documentColumnCount(6),2);
  assert.equal(api.documentColumnCount(30),2);
});

test('RC1504: Druck-Wrapper normalisiert das Dokumentraster vor der Bild-4-Wiederherstellung',()=>{
  assert.match(source,/function normalizeDeliveryGrid\(html\)/);
  assert.match(source,/restorePickupFields\(normalizeDeliveryGrid\(base\.enhance\(html,safe,withQr\)\),safe\)/);
  assert.match(source,/data-rc1504-document-columns/);
});
