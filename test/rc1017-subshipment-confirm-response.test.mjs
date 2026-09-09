import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('api/pickup-confirm-v2/index.js','utf8');

test('RC1017 Pickup: bestätigte Teilsendung meldet nicht fälschlich die ganze Hauptsendung als Abgeholt',()=>{
  assert.match(source,/shipmentStatus:complete\?\(rec\.subShipmentId\?'Teilsendung abgeholt':'Abgeholt'\):'Teilweise abgeholt'/);
});
