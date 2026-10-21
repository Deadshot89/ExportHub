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
  assert.match(restore,/root\.setAttribute\('data-rc1503-image4-pickup-layout','1'\);[\s\S]*embedPickupPrintStyle\(root\)/,'Auch nach der RC1595 Layout-Stabilisierung muss der PDF-Rahmen den Stil übernehmen');
  assert.match(restore,/if\(!summary&&!wasCollected&&!\(confirmed&&signatureStored\)\)return/,'Unterschriebene historische PODs ohne Legacy-Zusammenfassung müssen trotzdem angepasst werden');
  assert.match(restore,/if\(summary\)\{summary\.innerHTML=''/,'Unterschriftlose Druckvorlagen behalten ihre originalen Unterschriftslinien');
});

test('RC1560: Palettenkonto steht im Europaletten-Feld unten rechts statt über dem Ladelisten-Kopf',()=>{
  const card=wrapper.slice(wrapper.indexOf('function palletCardFor('),wrapper.indexOf('function restorePickupFields('));
  assert.ok(card.length>0,'palletCardFor fehlt');
  assert.match(card,/querySelectorAll\('\.rc929-proof-pallet'\)/,'Das vorhandene Feld unten rechts muss bevorzugt werden');
  assert.match(card,/closest\('\.rc1095-pallet-account'\)/,'Der alte Kopf-Hinweis darf nicht als Palettenfeld gelten');
  assert.match(card,/querySelectorAll\('\.rc1095-pallet-account'\)\)\.forEach\(function\(node\)\{node\.remove\(\)\}\)/,'Der alte Kopf-Hinweis muss entfernt werden');
  assert.ok(restore.includes('var palletCard=palletCardFor(root);putPalletBalance(palletCard,palletAccount,sh)'));
  const put=wrapper.slice(wrapper.indexOf('function putPalletBalance('),wrapper.indexOf('function palletCardFor('));
  assert.ok(put.includes("label.textContent='Palettenkonto / EUR pallets'"));
  assert.ok(put.includes("row('Aktueller Stand / Balance'"));
  assert.ok(put.includes("row('Eingang / Return'"));
  assert.ok(!put.includes('small.textContent=movement'),'Keine alte Ausgang/Eingang-Bewegungszeile mehr');
  assert.match(wrapper,/rc1580-pallet-write/);
});

test('RC1560: Browser-Regression läuft im POD-Workflow mit',()=>{
  const wf=fs.readFileSync('.github/workflows/rc1547-loading-list-single-page-verify.yml','utf8');
  assert.match(wf,/e2e\/specs\/rc1560-pod-pdf-signature\.spec\.mjs/);
  assert.match(wf,/test\/rc1560-pod-pdf-signature-frame\.test\.mjs/);
});
