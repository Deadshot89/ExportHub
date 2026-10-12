import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const api=fs.readFileSync('api/abd-analysis/index.js','utf8');
const client=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');

test('RC1499 invoice intake advertises PDF JPG JPEG PNG XLSX CSV',()=>{
 assert.match(client,/accept="[^"]*\.pdf/i);
 assert.match(client,/accept="[^"]*\.xlsx/i);
 assert.match(client,/accept="[^"]*\.csv/i);
 assert.match(client,/accept="[^"]*\.jpg/i);
 assert.match(client,/accept="[^"]*\.jpeg/i);
 assert.match(client,/accept="[^"]*\.png/i);
});

test('RC1499 server accepts only validated image extensions and MIME/signatures',()=>{
 assert.match(api,/pdf\|xlsx\|csv\|jpg\|jpeg\|png/);
 assert.match(api,/image\/jpeg/);
 assert.match(api,/image\/png/);
 assert.match(api,/0xff/);
 assert.match(api,/0x89/);
 assert.match(api,/abd-document-intelligence/);
});

test('RC1499 scanned PDFs use OCR fallback only after the existing PDF security path',()=>{
 const validateAt=api.indexOf('validatePdfUpload');
 const ocrAt=api.indexOf('analyzeInvoiceBuffer');
 assert.ok(validateAt>=0,'PDF upload validation missing');
 assert.ok(ocrAt>validateAt,'OCR must not bypass existing PDF upload validation');
 assert.match(api,/Microsoft Defender for Storage/);
});
