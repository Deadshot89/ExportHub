import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {parse}=require('../api/shared/avis-delivery-quantity.js');
const base='Delivery Note\nDNC000123456\nPart Number  Description  Qty Shipped  Unit\nA10299 Black cap M6 125 EA\n10291603 OCT FOOT D36MM M6 50 PCS\nTotal 175';
test('AVIS: extracts individual delivered quantities from clearly labelled DNC lines',()=>{
 const out=parse(base,'DNC000123456.pdf');
 assert.equal(out.status,'parsed');
 assert.equal(out.documentReference,'DNC000123456');
 assert.deepEqual(out.positions.map(p=>[p.article,p.quantity,p.unit]),[['A10299',125,'EA'],['10291603',50,'PCS']]);
});
test('AVIS: invoice mentioning a DNC is NEVER used for delivered quantity',()=>{
 const invoice='Invoice\nInvoice Number SIDE000012345\nPacking slip No.: DNC000123456\nPart Number Description Qty Shipped Unit\n10291603 SAMPLE PART 2950 EA';
 assert.equal(parse(invoice,'DNC000123456.pdf').status,'unavailable');
});
test('AVIS: Colli and gross weight are not quantity sources',()=>{
 const out=parse('Delivery Note\nDNC000123456\nColli: 4\nWeight: 280 kg','DNC000123456.pdf');
 assert.equal(out.status,'unavailable');assert.deepEqual(out.positions,[]);
});
test('AVIS: only one DNC is permitted in source text',()=>{
 const out=parse(base+'\nDNC000654321','DNC000123456.pdf');
 assert.equal(out.reason,'ambiguous-reference');
});
test('AVIS: ambiguous numeral, unlabelled values and non-positive quantities are not guessed',()=>{
 assert.equal(parse('Delivery Note\nDNC000123456\n10291603 CAP 125 EA').status,'unavailable');
 assert.equal(parse('Delivery Note\nDNC000123456\nPart Number Qty Shipped\n10291603 CAP 1,000 EA').status,'unavailable');
 assert.equal(parse('Delivery Note\nDNC000123456\nPart Number Qty Shipped\n10291603 CAP 0 EA').status,'unavailable');
});

test('AVIS: server-side PDF renamer selects unique SIDE invoice instead of referenced DNC',()=>{
 const refs=require('../api/shared/pdf-document-reference.js');
 const text='Invoice Number SIDE000012345\nPacking slip No.: DNC000123456\nQty Shipped 25';
 const result=refs.normalizedPdfName('DNC000123456.pdf',text);
 assert.equal(result.name,'SIDE000012345.pdf');
 assert.equal(result.reference,'SIDE000012345');
 assert.equal(result.reason,'side');
});
test('AVIS: DNC remains a delivery note if SIDE is only an incidental related document',()=>{
 const refs=require('../api/shared/pdf-document-reference.js');
 assert.equal(refs.normalizedPdfName('scanner.pdf','Delivery Note DNC000123456 SIDE000012345').name,'DNC000123456.pdf');
});
