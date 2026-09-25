import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');

test('RC1105: zentrale History erkennt die wichtigsten Druck- und PDF-Dokumenttypen',()=>{
  for(const marker of ['ABD','CMR','shipmentHistory.document.deliveryNote','shipmentHistory.document.coverSheet','shipmentHistory.document.stowagePlan','shipmentHistory.document.loadingList','shipmentHistory.document.totalPrint','L1 QR','L2']){
    assert.ok(source.includes(marker),marker+' fehlt in der Druck-History');
  }
});
