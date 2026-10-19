import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const wrapper=fs.readFileSync('assets/document-print-name.js','utf8');
const restore=wrapper.slice(wrapper.indexOf('function restorePickupFields('),wrapper.indexOf('function install('));

test('RC1560: Abholfeld-Stil ist als eigene Funktion verfügbar und wird weiter im Hauptdokument installiert',()=>{
  assert.match(wrapper,/function image4Css\(\)\{return '/);
  assert.match(wrapper,/st\.id='exporthub-rc1503-loading-list-fields';st\.textContent=image4Css\(\)/);
});

test('RC1560: Unterschrift-Begrenzung wandert als Inline-Stil mit jeder Ladelisten-Seite in den PDF-/Druckrahmen',()=>{
  const embed=wrapper.slice(wrapper.indexOf('function embedPickupPrintStyle('),wrapper.indexOf('function putValue('));
  assert.ok(embed.length>0,'embedPickupPrintStyle fehlt');
  assert.match(embed,/setAttribute\('data-rc1560-pickup-print-style','1'\)/);
  assert.match(embed,/getElementById\('exporthub-rc1305-loading-list-style'\)/);
  assert.match(embed,/textContent=\(base&&base\.textContent\|\|''\)\+image4Css\(\)/);
  assert.match(embed,/root\.insertBefore\(st,root\.firstChild\)/,'Stil muss innerhalb der Seite liegen, damit clonePages ihn mitkopiert');
  assert.match(embed,/querySelectorAll\('\[data-rc1560-pickup-print-style\]'\)\)\.forEach\(function\(node\)\{node\.remove\(\)\}\)/,'Mehrfaches Enhance darf keine Stile stapeln');
  assert.match(restore,/root\.setAttribute\('data-rc1503-image4-pickup-layout','1'\);embedPickupPrintStyle\(root\)/);
});

test('RC1560: Browser-Regression läuft im POD-Workflow mit',()=>{
  const wf=fs.readFileSync('.github/workflows/rc1547-loading-list-single-page-verify.yml','utf8');
  assert.match(wf,/e2e\/specs\/rc1560-pod-pdf-signature\.spec\.mjs/);
  assert.match(wf,/test\/rc1560-pod-pdf-signature-frame\.test\.mjs/);
});
