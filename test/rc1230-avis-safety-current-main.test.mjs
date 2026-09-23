import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync('customer-avis.html','utf8');

test('RC1230: AVIS zeigt Sicherheitsvorschriften vor der Referenzfreigabe',()=>{
  const gate=page.match(/function showGate\(message\)[\s\S]{0,7000}?authorize\)}/);
  assert.ok(gate,'showGate fehlt');
  assert.match(gate[0],/Sicherheitsschuhe/);
  assert.match(gate[0],/Sicherheitsweste/);
  assert.match(gate[0],/Referenznummer.*Abholung|Abholung.*Referenznummer/);
});

test('RC1230: AVIS zeigt Sicherheitsvorschriften im geöffneten Sendungsportal',()=>{
  assert.match(page,/Sicherheitsvorschriften für die Abholung/);
  assert.match(page,/Zutritt zum Gelände nur mit Sicherheitsschuhen/);
  assert.match(page,/Tragen einer Sicherheitsweste ist verpflichtend/);
  assert.match(page,/Bei der Abholung ist die Referenznummer <b>'\+esc\(data\.reference\|\|'–'\)\+'<\/b> anzugeben/);
});

test('RC1230: Pflicht-Hinweis bleibt deutlich hervorgehoben',()=>{
  assert.match(page,/\.site-rules\{/);
  assert.match(page,/border:2px solid #f59e0b/);
  assert.match(page,/background:#fff7ed/);
});

test('RC1230: aktuelle 2-Stunden-Slotlogik bleibt erhalten',()=>{
  assert.match(page,/2-Stunden-Zeitfenster/);
  assert.match(page,/maximal 3 Sendungen/);
  assert.match(page,/id="slotPicker"/);
});
