import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/rc1081-audit-history.js','utf8');

test('RC1101: Aktionsfilter unterscheidet konkrete Sendungsaktionen mit gleichem Subtyp',()=>{
  assert.match(source,/function actionKey\(e\)\{[\s\S]*shipmentLegacyCode\(raw\)/);
  assert.match(source,/canonical=special\|\|low\(raw\|\|subtypeTechnical\(e\)\)/);
  assert.match(source,/label:actionTitle\(e\),area:typeLabel\(e\.type\)/);
});

test('RC1101: Mailtyp wird in den Historiendetails sichtbar',()=>{
  assert.match(source,/if\(x\.mailType\)parts\.push\(field\('mail',q\(x\.mailType\)\)\)/);
  assert.match(source,/history\.field\./);
});
