import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const api=fs.readFileSync('api/customer-avis/index.js','utf8');
const page=fs.readFileSync('customer-avis.html','utf8');

test('RC1276: Sendungs-Bemerkung wird im AVIS-Payload freigegeben',()=>{
  assert.match(api,/remark:text\(sh\.remark\|\|sh\.remarks\|\|sh\.bemerkung\|\|sh\.comments\|\|sh\.comment\|\|sh\.note\|\|sh\.notes\|\|sh\.shipmentRemark\)/);
  for(const field of ['remark','remarks','bemerkung','comments','comment','note','notes','shipmentRemark']){
    assert.match(api,new RegExp("'"+field+"'"),field+' fehlt im Draft-Vertrag');
  }
});

test('RC1276: AVIS zeigt die Bemerkung sichtbar und escaped in offenem sowie geschlossenem Zustand',()=>{
  assert.match(page,/function remarkHtml\(value\)/);
  assert.match(page,/data-avis-remark="1"/);
  assert.match(page,/esc\(value\)/);
  assert.match(page,/shipment-remark/);
  const uses=(page.match(/remarkHtml\(data\.remark\)/g)||[]).length;
  assert.equal(uses,2,'Bemerkung muss vor und nach der Abholung sichtbar bleiben');
});
