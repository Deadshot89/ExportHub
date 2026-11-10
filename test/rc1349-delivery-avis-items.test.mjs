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

test('RC1349: reales DNC-Spaltenlayout (anonymisierte Werte): Qty Shipped statt Qty Ordered',()=>{
 const dnc=[
 'Delivery Note',
 'Delivery Note number                                                                     DNC3019228592',
 'Essentra Order Number                                                                    SO301900050195',
 'Customer Order Number                                                                    5530000099          Beispielfirma',
 'Customer Code                                                                            3019100000',
 'Customer Part                        Essentra Part',
 '                                                   Item Description          Unit of Measure       Qty Ordered          Qty Shipped',
 'Number                               Number',
 '9000000059                           10013106                        LCKNG SUPP NAT STNDFF H 9.5MM       EA       50.000,00           30.000,00',
 '                                      LCBS-8-6-19',
 'ContainerID: 3002-000266972',
 'Essentra Components Terms and Conditions of Sale'
 ].join('\n');
 const result=items.parseDeliveryText(dnc);
 assert.equal(result.status,'review_required');
 assert.deepEqual(result.rows.map(r=>[r.customerOrderNumber,r.customerItemNumber,r.deliveredQuantity,r.quantityUnit]),
  [['5530000099','9000000059','30.000,00','EA']]);
 assert.notEqual(result.rows[0].customerItemNumber,'10013106');
 assert.notEqual(result.rows[0].deliveredQuantity,'50.000,00');
});

test('RC1349: pdf-parse Tabspalten beim DNC sind gültig, mehrere Kunden-POs dagegen gesperrt',()=>{
 const common=['Delivery Note','Customer Part    Essentra Part   Unit of Measure    Qty Ordered    Qty Shipped'];
 const rows=['9000000059\t10013106\tLCKNG SUPP NAT STNDFF\tEA\t50.000,00\t30.000,00'];
 const one=items.parseDeliveryText(['Customer Order Number\t5530000099',...common,...rows].join('\n'));
 assert.deepEqual(one.rows.map(x=>[x.customerOrderNumber,x.customerItemNumber,x.deliveredQuantity]),
  [['5530000099','9000000059','30.000,00']]);
 const ambiguity=items.parseDeliveryText(['Customer Order Number\t5530000099',
 'Customer Order Number\t5530000100',...common,...rows].join('\n'));
 assert.equal(ambiguity.rows.length,0);
});

test('RC1349: vertauschte Qty- und Artikelspalten im DNC werden nicht geraten',()=>{
 const text=['Delivery Note','Customer Order Number\t5530000099',
 'Essentra Part     Customer Part     Unit of Measure     Qty Shipped     Qty Ordered',
 '10013106\t9000000059\tBeschreibung\tEA\t50.000,00\t30.000,00'].join('\n');
 assert.equal(items.parseDeliveryText(text).rows.length,0);
});
 
test('RC1349: DNC darf Spaltenverlust im PDF-Text nicht erraten',()=>{
 const unsorted=[
 'Delivery Note',
 'Delivery Note number',
 'Essentra Order Number',
 'Customer Order Number',
 'Customer Code',
 'DNC3019228592',
 'SO301900050195',
 '5530000099',
 '3019100000',
 'Qty Shipped',
 'Unit of Measure',
 'Qty Ordered',
 'Essentra Part',
 'Number',
 'Customer Part',
 'Number',
 'Item Description',
 '10013106',
 '9000000059',
 'EA',
 '50.000,00',
 '30.000,00',
 'LCBS-8-6-19'
 ].join('\n');
 const result=items.parseDeliveryText(unsorted);
 assert.equal(result.rows.length,0);
 assert.equal(result.status,'manual_review_required');
});

test('RC1349: falsch zugeordnete Menge und fehlende Kunden-PO in DNC bleiben ohne Freigabe',()=>{
 const noPo=['Delivery Note','Customer Order Number','Customer Part   Essentra Part',
 'Unit of Measure     Qty Ordered       Qty Shipped',
 '9000000059     10013106    Beispielteil     EA     80    30'].join('\n');
 assert.equal(items.parseDeliveryText(noPo).rows.length,0);
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
 assert.match(internalUi,/t\('reviewButton'\)/);
 const i18n=fs.readFileSync('assets/i18n/shipment-document-upload.js','utf8');
 for(const lang of ['de','en','pl','es','fr','it'])assert.match(i18n,new RegExp(' '+lang+':\\{[^\\n]*reviewButton:'));
 assert.doesNotMatch(internalUi,/Lieferschein-Artikel prüfen/);
 assert.doesNotMatch(publicApi,/parseDeliveryText\(/);
});
