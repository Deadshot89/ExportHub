import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync('customer-avis.html','utf8');

test('RC1226: AVIS zeigt Sicherheitsvorschriften bereits vor der Referenzfreigabe',()=>{
  const gate=page.match(/function showGate\(message\)[\s\S]{0,7000}?authorize\)}/);
  assert.ok(gate,'showGate fehlt');
  assert.match(gate[0],/Sicherheitsschuhe/);
  assert.match(gate[0],/Sicherheitsweste/);
  assert.match(gate[0],/Referenznummer.*Abholung|Abholung.*Referenznummer/);
});

test('RC1226: AVIS zeigt Sicherheitsvorschriften auch im geöffneten Sendungsportal',()=>{
  assert.match(page,/Sicherheitsvorschriften für die Abholung/);
  assert.match(page,/Zutritt zum Gelände nur mit Sicherheitsschuhen/);
  assert.match(page,/Tragen einer Sicherheitsweste ist verpflichtend/);
  assert.match(page,/Bei der Abholung ist die Referenznummer <b>'\+esc\(data\.reference\|\|'–'\)\+'<\/b> anzugeben/);
});

test('RC1226: Pflicht-Hinweis ist deutlich hervorgehoben',()=>{
  assert.match(page,/\.site-rules\{/);
  assert.match(page,/border:2px solid #f59e0b/);
  assert.match(page,/background:#fff7ed/);
});
