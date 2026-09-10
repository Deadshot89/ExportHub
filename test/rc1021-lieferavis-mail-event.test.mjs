import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/rc1015-lieferavis-mail-flow.js','utf8');

test('RC1021: jeder erfolgreiche Lieferavis-Statuswechsel meldet die Mailruntime',()=>{
  assert.match(source,/function rc1021NotifyAvisUpdated\(/,'Explizite Avis-Statusmeldung fehlt.');
  assert.match(source,/exporthub:customer-avis-updated/,'Der gemeinsame Avis-Update-Event fehlt.');
  const manual=source.slice(source.indexOf('async function rc1015Toggle(on)'),source.indexOf('async function rc1021AutoEnable'));
  assert.match(manual,/await base\.toggle\(on\)[\s\S]*rc1021NotifyAvisUpdated\(on/,'Manuelle Aktivierung/Deaktivierung aktualisiert die Mailruntime nicht.');
  const automatic=source.slice(source.indexOf('async function rc1021AutoEnable'),source.indexOf('function stripAvisBlocks'));
  assert.match(automatic,/await base\.toggle\(true\)[\s\S]*rc1021NotifyAvisUpdated\(true/,'Automatische Aktivierung aktualisiert die Mailruntime nicht.');
});
