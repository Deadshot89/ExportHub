import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');
const countId=(id)=>(html.match(new RegExp(`id=["']${id}["']`,'g'))||[]).length;

test('RC997 Sendung: kanonische Kernbereiche sind jeweils genau einmal vorhanden',()=>{
  for(const id of ['rc363BlockCustomer','rc363BlockShipment','rc363BlockColli','rc363BlockDocuments','rc363BlockStow','rc363BlockMail']){
    assert.equal(countId(id),1,`${id} ist nicht eindeutig`);
  }
});

test('RC997 Sendung: aktive Colli-, Mail- und Stauplan-Funktionen bleiben ausführbar verankert',()=>{
  assert.match(html,/function\s+canonicalColliCard\s*\(/);
  assert.match(html,/function\s+canonicalMail\s*\(/);
  assert.match(html,/function\s+printStow\s*\(/);
});

test('RC997 Sendung: neue Colli-Zeilen werden nur angehängt statt vorhandene Eingaben neu aufzubauen',()=>{
  const add=html.match(/function addRow\(\)\{([\s\S]*?)\}function removeRow/);
  assert.ok(add,'addRow fehlt');
  assert.match(add[1],/appendChild\(ownedRow\(index,r\)\)/);
  assert.doesNotMatch(add[1],/innerHTML\s*=|replaceChildren\(|replaceWith\(/);
});

test('RC997 Sendung: Langtext-Autogrow und kompakte Colli-Geometrie bleiben aktiv',()=>{
  assert.match(html,/rc973-autogrow-long-text/);
  assert.match(html,/rc980-colli-row-stability/);
  assert.match(html,/--rc971-control-h\s*:\s*42px/i);
});

test('RC997 Sendung: Kundenbestätigung bleibt Avis-only und QR bleibt im PDF ausgeschlossen',()=>{
  assert.match(html,/RC995_CUSTOMER_CONFIRMATION_AVIS_ONLY/);
  assert.doesNotMatch(html,/data-rc995-customer-confirm-main/);
  assert.match(html,/RC995_PDF_NO_QR|rc995PdfMode/);
});

test('RC997 Sendung: zentrale Status- und Versandmarker bleiben vorhanden',()=>{
  assert.match(html,/Wartet auf ABD/i);
  assert.match(html,/Abgeholt/i);
  assert.match(html,/POD vorhanden/i);
  assert.match(html,/CMR/i);
  assert.match(html,/Ladeliste/i);
});
