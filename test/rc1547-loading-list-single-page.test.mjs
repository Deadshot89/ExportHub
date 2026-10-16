import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');

test('RC1547: Ladeliste besitzt einen echten Ein-Seiten-Fit statt Inhalte abzuschneiden',()=>{
  assert.match(source,/function rc1547FitLoadingList\(/,'dynamischer Ein-Seiten-Fit fehlt');
  assert.match(source,/data-rc1547-single-page/,'Ein-Seiten-Marker fehlt');
  assert.match(source,/scrollHeight/,'Fit muss die tatsächlich benötigte Inhaltshöhe messen');
  assert.match(source,/clientHeight|getBoundingClientRect/,'Fit muss die verfügbare A4-Höhe messen');
  assert.match(source,/style\.setProperty\('zoom'/,'Ladeliste muss proportional skaliert werden, wenn Inhalt wächst');
  assert.match(source,/beforeprint/,'Fit muss unmittelbar vor dem Browserdruck erneut berechnet werden');
});

test('RC1547: zusätzliche Positionen und Anhänge bleiben vollständig sichtbar',()=>{
  assert.match(source,/querySelectorAll\('tbody tr'/,'Verpackungspositionen müssen bei der Dichte berücksichtigt werden');
  assert.match(source,/data-rc1293-packing-slip/,'Anhänge müssen im selben Fit berücksichtigt werden');
  assert.doesNotMatch(source,/data-rc1547-single-page[^\n]{0,200}display\s*:\s*none/i,'Ein-Seiten-Fit darf Inhalte nicht ausblenden');
  assert.doesNotMatch(source,/data-rc1547-single-page[^\n]{0,200}overflow\s*:\s*hidden/i,'Ein-Seiten-Fit darf überstehende Daten nicht einfach abschneiden');
});
