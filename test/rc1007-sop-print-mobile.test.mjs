import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('assets/sop/rc1007-sop.css','utf8');
const ui=fs.readFileSync('assets/sop/rc1007-sop-ui.js','utf8');

test('SOP-Druck blendet Bedienung aus und hält Dokumentblöcke zusammen',()=>{
  assert.match(css,/@media\s+print/);
  assert.match(css,/\.rc1007-sop-doc-actions[^}]*display\s*:\s*none/s);
  assert.match(css,/break-inside\s*:\s*avoid/);
});

test('SOP bleibt auf schmalen Displays einspaltig lesbar',()=>{
  assert.match(css,/@media\s*\(max-width\s*:\s*760px\)/);
  assert.match(css,/\.rc1007-sop-filters\s*\{[^}]*grid-template-columns\s*:\s*1fr/s);
});

test('Fehlende SOP-Bilder werden durch sichtbaren Hinweis ersetzt',()=>{
  assert.match(ui,/function\s+handleImageError\s*\(/);
  assert.match(ui,/Bild konnte nicht geladen werden/);
  assert.match(ui,/addEventListener\(['"]error['"]/);
});
