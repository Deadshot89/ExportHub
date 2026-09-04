import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');

function count(rx){return (html.match(rx)||[]).length;}

test('RC997 Sendung: kanonische Kernbereichs-Marker bleiben vorhanden ohne neue RC997-Duplikate',()=>{
  for(const marker of ['rc363BlockCustomer','rc363BlockShipment','rc363BlockColli','rc363BlockDocuments','rc363BlockStow','rc363BlockMail']){
    assert.match(html,new RegExp(marker),`${marker} fehlt vollständig`);
    assert.doesNotMatch(html,new RegExp(`rc997[^\n]{0,180}${marker}`,'i'),`${marker} darf nicht als paralleler RC997-Reparaturblock dupliziert werden`);
  }
});

test('RC997 Sendung: aktive Colli-, Mail- und Stauplan-Funktionen bleiben eindeutig ausführbar verankert',()=>{
  assert.equal(count(/function\s+canonicalColliCard\s*\(/g),1,'canonicalColliCard ist nicht eindeutig');
  assert.equal(count(/function\s+canonicalMail\s*\(/g),1,'canonicalMail ist nicht eindeutig');
  assert.equal(count(/function\s+printStow\s*\(/g),1,'printStow ist nicht eindeutig');
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
