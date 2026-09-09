import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js = fs.readFileSync('assets/abholkalender.js','utf8');
const css = fs.readFileSync('assets/abholkalender.css','utf8');

test('RC1017 Kalender: fixe Abholungen sind grün und Sendungen blau',()=>{
  assert.match(css,/\.pickup-item-fix\s*\{[^}]*background:[^;}]*(?:34,197,94|22,163,74|#(?:16a34a|22c55e))/i);
  assert.match(css,/\.pickup-item-shipment\s*\{[^}]*background:[^;}]*(?:37,99,235|59,130,246|#(?:2563eb|3b82f6))/i);
});

test('RC1017 Kalender: Sendungskarte nennt den Kunden explizit',()=>{
  assert.match(js,/recipientCustomerName/);
  assert.match(js,/Kunde:\s*<strong>/);
});
