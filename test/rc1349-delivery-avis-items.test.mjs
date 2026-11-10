import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const items=require('../api/shared/delivery-avis-items.js');
const sha='a'.repeat(64);

test('RC1349: beschriftete Kunden-PO, Kundenartikel und gelieferte Menge werden nur als Entwurf gelesen',()=>{
 const text='Lieferschein\nSendungsreferenz ABC123\nKundenbestellnummer: PO-450001\nKundenartikelnummer: C-1841 | Gelieferte Menge: 2.500 Stk.\nKundenartikelnummer: C-1842 | Gelieferte Menge: 1.200 Stk.';
 const result=items.parseDeliveryText(text);
 assert.equal(result.status,'review_required');
 assert.equal(result.manualReviewRequired,true);
 assert.deepEqual(result.rows.map(r=>[r.customerOrderNumber,r.customerItemNumber,r.deliveredQuantity,r.quantityUnit]),
 [['PO-450001','C-1841','2.500','Stk'],['PO-450001','C-1842','1.200','Stk']]);
});

test('RC1349: mehrere Kundenbestellungen in eindeutig beschrifteter Tabelle bleiben getrennt',()=>{
 const text='Kundenbestellnummer    Kundenartikelnummer    Gelieferte Menge    Einheit\nPO-11    C-17    32,5    kg\nPO-12    C-18    8    Stk.';
 const rows=items.parseDeliveryText(text).rows;
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(r=>[r.customerOrderNumber,r.customerItemNumber,r.deliveredQuantity,r.quantityUnit]),
 [['PO-11','C-17','32,5','kg'],['PO-12','C-18','8','Stk.']]);
});

test('RC1349: interne Artikelnr. und Bestellmenge dürfen nicht zur Liefermenge werden',()=>{
 const text='Bestellnummer: PO-123\nInterne Artikelnummer: INT-900\nBestellte Menge: 500 Stk.\nKundenartikelnummer: C-100';
 const result=items.parseDeliveryText(text);
 assert.equal(result.rows.length,0);
 assert.equal(result.status,'manual_review_required');
});

test('RC1349: Tabellenüberschrift wird niemals als echte Bestellnummer interpretiert',()=>{
 const text='Kundenbestellnummer    Kundenartikelnummer    Gelieferte Menge\nC-101    900 Stk.';
 assert.equal(items.parseDeliveryText(text).rows.length,0);
});

test('RC1349: bei mehreren globalen Bestellnummern wird keine Artikelposition erraten',()=>{
 const text='Kundenbestellnummer: PO-001\nKundenbestellnummer: PO-002\nKundenartikelnummer: A-01 Gelieferte Menge: 40 Stk.';
 assert.equal(items.parseDeliveryText(text).rows.length,0);
});

test('RC1349: nur vollständig validierte, bestätigte und als sauber geprüfte Datensätze werden öffentlich',()=>{
 const good={status:'approved',current:true,scanStatus:'clean',sha256:sha,rows:[{customerOrderNumber:'PO-001',customerItemNumber:'C-18',deliveredQuantity:'40',quantityUnit:'Stk.'}]};
 const bad=[{...good,status:'review_required'},{...good,scanStatus:'pending'},{...good,current:false},{...good,sha256:'bad'},{...good,rows:[{...good.rows[0],deliveredQuantity:'unbekannt'}]}];
 assert.deepEqual(items.verifiedPublicRows([...bad,good]),good.rows);
 assert.throws(()=>items.safeReviewRows([{customerOrderNumber:'PO-001',customerItemNumber:'C-18',deliveredQuantity:'50'}]),/Einheit/);
 assert.throws(()=>items.safeReviewRows([{customerOrderNumber:'PO-001',customerItemNumber:'C-18',deliveredQuantity:'<script>',quantityUnit:'Stk.'}]));
});

test('RC1349: Review ist personalisiert und Portal zeigt keine ungeprüften Rohtexte',()=>{
 const api=fs.readFileSync('api/reference-files/index.js','utf8'),
  store=fs.readFileSync('api/shared/delivery-avis-items-store.js','utf8'),
  publicApi=fs.readFileSync('api/customer-avis/index.js','utf8'),
  publicHtml=fs.readFileSync('customer-avis.html','utf8'),
  internalUi=fs.readFileSync('assets/shipment-document-upload.js','utf8');
 assert.match(api,/authStore\.hasAnyEditRight\(internal\.user\)/);
 assert.match(api,/action==='approve-delivery-items'/);
 assert.match(store,/scan\.status!=='clean'/);
 assert.match(store,/if\(parser\.fingerprint\(original\.buffer\)!==hash\)/);
 assert.match(store,/function publicRows/);
 assert.match(publicApi,/withApprovedDeliveryItems/);
 assert.match(publicHtml,/deliveryItemsHtml\(data\.deliveryItems\)/);
 assert.match(internalUi,/Lieferschein-Artikel prüfen/);
 assert.doesNotMatch(publicApi,/parseDeliveryText\(/);
});
