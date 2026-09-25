import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const validator=require('../api/shared/customer-avis-document-content.js');

const shipment={
  reference:'ABC123',
  customerNumber:'4711',
  salesOrder:'SO-9001',
  customerReference:'PO-7788',
  customerName:'Muster Kunde GmbH'
};

test('RC1129: exakte Sendungsreferenz plus passende Dokumentart wird freigegeben',()=>{
  const out=validator.evaluateExtractedText(
    'CMR International Consignment Note\nShipment reference ABC123\nMuster Kunde GmbH\nSO-9001',
    shipment,
    'cmr'
  );
  assert.equal(out.ok,true);
  assert.equal(out.code,'PDF_CONTENT_VALID');
  assert.ok(out.matched.includes('shipment-reference'));
});

test('RC1129: zwei starke Alternativmerkmale reichen auch ohne sichtbare Hauptreferenz',()=>{
  const out=validator.evaluateExtractedText(
    'Delivery Note\nCustomer 4711\nSales Order SO-9001\nMuster Kunde GmbH\nGoods delivered',
    shipment,
    'delivery_note'
  );
  assert.equal(out.ok,true);
  assert.equal(out.documentType,'delivery_note');
  assert.ok(out.matched.includes('customer-number'));
  assert.ok(out.matched.includes('sales-order'));
});

test('RC1129: fremde Sendung wird trotz plausiblem PDF nicht gespeichert',()=>{
  const out=validator.evaluateExtractedText(
    'Packing List\nShipment reference XYZ999\nCustomer 9999\nSales Order SO-1111\nOther Customer Ltd',
    shipment,
    'packing_list'
  );
  assert.equal(out.ok,false);
  assert.equal(out.code,'PDF_SHIPMENT_MISMATCH');
  assert.equal(out.messageKey,'api.avis.shipmentMismatch');
});

test('RC1129: falsche Dokumentart wird blockiert',()=>{
  const out=validator.evaluateExtractedText(
    'Commercial Invoice\nShipment ABC123\nCustomer 4711\nInvoice No 12345',
    shipment,
    'cmr'
  );
  assert.equal(out.ok,false);
  assert.equal(out.code,'PDF_DOCUMENT_TYPE_MISMATCH');
});

test('RC1129: nicht maschinenlesbare PDFs werden fail-closed blockiert',()=>{
  const out=validator.evaluateExtractedText('ABC123',shipment,'other');
  assert.equal(out.ok,false);
  assert.equal(out.code,'PDF_TEXT_UNREADABLE');
});

test('RC1129: unbekannte Dokumentarten werden serverseitig abgelehnt',()=>{
  assert.throws(()=>validator.documentType('exe'),e=>e.code==='PDF_DOCUMENT_TYPE_INVALID'&&e.status===400);
});

test('RC1129: API deklariert pdf-parse als Textanalyse-Runtime',()=>{
  const pkg=JSON.parse(fs.readFileSync('api/package.json','utf8'));
  assert.equal(pkg.dependencies['pdf-parse'],'2.4.5');
  const api=fs.readFileSync('api/customer-avis/index.js','utf8');
  assert.match(api,/customer-avis-document-content/);
  assert.match(api,/validateShipmentDocument/);
  assert.match(api,/businessValidation/);
  const promoteStart=api.indexOf('async function promoteCleanCustomerPdf');
  const promoteEnd=api.indexOf('async function blockCustomerPdf',promoteStart);
  const promote=api.slice(promoteStart,promoteEnd);
  assert.ok(promoteStart>=0&&promoteEnd>promoteStart,'Promotion-Funktion fehlt');
  assert.ok(promote.indexOf('validateShipmentDocument')>=0,'Fachprüfung fehlt in der Promotion');
  assert.ok(promote.indexOf('validateShipmentDocument')<promote.indexOf('finalBlobName'),'Finaler Dokumentpfad darf erst nach der Fachprüfung entstehen');
  const content=fs.readFileSync('api/shared/customer-avis-document-content.js','utf8');
  assert.match(content,/PDF_CONTENT_VALID/);
});
