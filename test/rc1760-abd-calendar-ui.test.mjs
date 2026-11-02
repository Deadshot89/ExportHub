import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const calendarCss=fs.readFileSync('assets/abholkalender.css','utf8');
const layoutCss=fs.readFileSync('assets/rc1560-full-width.css','utf8');
const invoiceRuntime=fs.readFileSync('assets/rc1549-abd-proforma.js','utf8');

test("RC1760: today's fixed and shipment sections do not reserve unequal columns",()=>{
  assert.match(calendarCss,/RC1760 – Abholkalender/);
  assert.match(calendarCss,/\.pickup-today-grid\s*\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
  assert.match(calendarCss,/\.pickup-today-grid\s*>\s*\.pickup-source\s*\{[\s\S]*?repeat\(3,minmax\(0,1fr\)\)/);
});

test('RC1760: pickup status semantics and print styling are kept',()=>{
  assert.match(calendarCss,/\.pickup-item\.is-done/);
  assert.match(calendarCss,/\.pickup-item\.is-partial/);
  assert.match(calendarCss,/@media print\s*\{/);
  assert.match(calendarCss,/@media screen and \(max-width:600px\)/);
});

test('RC1760: ABD editor and saved request cards are readable and responsive',()=>{
  assert.match(layoutCss,/#content #rc626Abd \.rc626-list/);
  assert.match(layoutCss,/#content #rc1549AbdManual \.rc1549-head/);
  assert.match(layoutCss,/#content #rc1549AbdManual \.rc1549-scroll table/);
  assert.match(layoutCss,/@media screen and \(max-width:680px\)/);
});

test('RC1760: saved ABD search is view-only and reuses existing item actions',()=>{
  assert.match(invoiceRuntime,/function enhanceSavedAbdLayout\(\)/);
  assert.match(invoiceRuntime,/history\.classList\.add\('rc1760-abd-history'\)/);
  assert.match(invoiceRuntime,/history\.querySelectorAll\('\.rc626-list > \.rc626-item'\)/);
  assert.match(invoiceRuntime,/card\.hidden=/);
  assert.match(invoiceRuntime,/input\.addEventListener\('input',filter\)/);
  assert.match(invoiceRuntime,/mountManual\(\);enhanceSavedAbdLayout\(\);enhanceUploaded\(\)/);
  assert.doesNotMatch(invoiceRuntime,/function enhanceSavedAbdLayout\(\)\{[\s\S]*?(?:queueSave|flushSave|fetch\(|deleteAbd|saveAbd)\(/);
});

test('RC1760: saved ABD search and result count use localized strings in all six languages',()=>{
  for(const lang of ['de','en','pl','es','fr','it']){
    assert.match(invoiceRuntime,new RegExp('\\b'+lang+':\\{savedAbdSearchLabel:'));
  }
  assert.match(invoiceRuntime,/input\.placeholder=t\('savedAbdSearchPlaceholder'\)/);
  assert.match(invoiceRuntime,/input\.setAttribute\('aria-label',t\('savedAbdSearchAria'\)\)/);
  assert.match(invoiceRuntime,/count\.textContent=cards\.length\?t\('savedAbdSearchCount'\)/);
});
