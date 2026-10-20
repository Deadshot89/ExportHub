import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');

test('RC1547: Ladeliste passt sich anhand von Positionen und Anhängen auf genau eine Seite an',()=>{
  assert.match(source,/function rc1547ApplySinglePageFit\(/,'dynamischer Ein-Seiten-Fit fehlt');
  assert.match(source,/data-rc1547-single-page/,'Ein-Seiten-Marker fehlt');
  assert.match(source,/querySelectorAll\('tbody tr'/,'Verpackungspositionen müssen bei der Skalierung berücksichtigt werden');
  assert.match(source,/querySelectorAll\('\[data-rc1293-packing-slip\]'/,'Anhänge müssen bei der Skalierung berücksichtigt werden');
  assert.match(source,/style\.setProperty\('zoom'/,'Ladeliste muss proportional skaliert werden, wenn Inhalt wächst');
  assert.match(source,/data-rc1547-fit-scale/,'angewendete Skalierung muss nachvollziehbar markiert werden');
});

test('RC1547: zusätzliche Daten werden nicht versteckt oder abgeschnitten',()=>{
  assert.doesNotMatch(source,/rc1547ApplySinglePageFit[\s\S]{0,1800}display\s*[:=]\s*['"]?none/i,'Ein-Seiten-Fit darf Positionen oder Anhänge nicht ausblenden');
  assert.doesNotMatch(source,/rc1547ApplySinglePageFit[\s\S]{0,1800}overflow\s*[:=]\s*['"]?hidden/i,'Ein-Seiten-Fit darf überstehende Daten nicht abschneiden');
  assert.match(source,/root\.setAttribute\('data-rc1547-position-count'/,'Positionsanzahl muss nachvollziehbar bleiben');
  assert.match(source,/root\.setAttribute\('data-rc1547-document-count'/,'Anhangsanzahl muss nachvollziehbar bleiben');
});
