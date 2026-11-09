import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workspace=fs.readFileSync('assets/rc1940-documents-workspace.js','utf8');
const invoice=fs.readFileSync('assets/rc1549-abd-proforma.js','utf8');
const delivery=fs.readFileSync('assets/rc1790-delivery-note.js','utf8');
const menu=fs.readFileSync('assets/rc1579-menu-redesign.js','utf8');
const integration=fs.readFileSync('.github/rc1549/integrate-abd-proforma.mjs','utf8');
const exportApi=fs.readFileSync('api/abd-analysis-export/index.js','utf8');

test('RC1940: independent in-app document workspace with its own navigation and both editors',()=>{
 assert.match(workspace,/data-exporthub-documents-nav/);
 assert.match(workspace,/data-index321-view','documents'/);
 assert.match(workspace,/d\.body\.setAttribute\('data-exporthub-view','documents'\)/);
 assert.match(workspace,/host\.replaceChildren\(page\)/);
 assert.match(workspace,/ExportHUBRC1549Proforma\.mount\(\)/);
 assert.match(workspace,/ExportHUBRC1790DeliveryNote\.mount\(\)/);
 assert.match(workspace,/data-rc1790-tab/);
 assert.match(menu,/views:\['shipment','abd','documents','shipmentoverview'/);
 assert.match(menu,/ICONS\.documents=ICONS\.abd/);
});

test('RC1940: six languages and responsive layouts are available',()=>{
 for(const lang of ['de','en','pl','es','fr','it'])assert.match(workspace,new RegExp('\\b'+lang+':\\{menu:'));
 for(const value of ['@media(max-width:600px)','rc1940Documents','rc1940-head'])assert.ok(workspace.includes(value));
});

test('RC1940: permissions mirror ABD; the nav addon is accepted without menu rebuild',()=>{
 assert.match(workspace,/function permitted\(\)/);
 assert.match(workspace,/!b\.hidden&&b\.getAttribute\('aria-hidden'\)!=='true'/);
 assert.match(integration,/\[data-exporthub-documents-nav\]/);
 assert.match(integration,/DOCUMENT_TAG/);
 assert.match(integration,/assets\/rc1940-documents-workspace\.js/);
 assert.match(integration,/const ENTRIES=\['index\.html','TESTVERSION\.html','demo\.html'\]/);
});

test('RC1940: invoice/proforma and delivery-note generation no longer mount under ABD',()=>{
 assert.match(invoice,/#rc1940Documents \[data-rc1940-document-editor\]/);
 assert.match(delivery,/#rc1940Documents \[data-rc1940-document-editor\]/);
 assert.doesNotMatch(invoice,/function invoicePanel\(\)\{var h=host\(\)/);
 assert.doesNotMatch(delivery,/function host\(\)\{var h=root\.document&&root\.document\.getElementById\('rc1294AbdAnalysis'\)/);
 assert.match(invoice,/ExportHUBDocuments1940/);
 assert.match(invoice,/var snapshot=api&&typeof api\.snapshot==='function'\?api\.snapshot\(i\):null;/);
 assert.match(invoice,/data-rc1549-import/);
});

test('RC1940: existing authenticated PDF generation stays unchanged',()=>{
 assert.match(invoice,/format:'proforma'/);
 assert.match(invoice,/format:'lieferschein'/);
 assert.match(delivery,/api\.createDeliveryNote\(data\)/);
 assert.match(exportApi,/auth\.validateSession\(req\)/);
});
