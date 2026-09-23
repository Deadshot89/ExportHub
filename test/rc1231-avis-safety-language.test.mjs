import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync('customer-avis.html','utf8');
const runtime=fs.readFileSync('assets/rc1018-public-language.js','utf8');
const mailFlow=fs.readFileSync('assets/rc1015-lieferavis-mail-flow.js','utf8');

test('RC1231: AVIS Sicherheitsblock ist vollständig DE/EN übersetzt',()=>{
  assert.match(runtime,/⚠ Sicherheitsvorschriften für die Abholung':'⚠ Safety requirements for pickup/);
  assert.match(runtime,/Zutritt zum Gelände nur mit Sicherheitsschuhen\.':'• Access to the premises is permitted only with safety shoes\./);
  assert.match(runtime,/Das Tragen einer Sicherheitsweste ist verpflichtend\.':'• A high-visibility safety vest must be worn\./);
  assert.match(runtime,/Die Sendungsreferenz \/ Referenznummer muss bei der Abholung angegeben werden\.':'• The shipment reference \/ reference number must be provided at pickup\./);
  assert.match(runtime,/Bei der Abholung ist die Referenznummer':'• The reference number/);
  assert.match(runtime,/anzugeben\.':'must be provided at pickup\.'/);
});

test('RC1231: englische Mail-/Avis-Sprache wird im Link an die AVIS-Seite weitergegeben',()=>{
  assert.match(mailFlow,/searchParams\.set\('lang',lang==='en'\?'en':'de'\)/);
  assert.match(page,/rc1018-public-language\.js\?v=1231/);
  assert.match(runtime,/searchParams\.get\('lang'\)/);
});

test('RC1231: Referenznummer bleibt dynamisch und wird nicht hart codiert',()=>{
  assert.match(page,/Bei der Abholung ist die Referenznummer <b>'\+esc\(data\.reference\|\|'–'\)\+'<\/b> anzugeben\./);
});
