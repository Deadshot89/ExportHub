import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('TESTVERSION.html','utf8');
const needle = "{name:'E3',ldm:0.06,l:43,w:31,h:31}";

test('Diagnose: PACK-Nutzung der aktiven Colli-Logik', () => {
  const e3 = html.lastIndexOf(needle);
  assert.ok(e3 >= 0, 'Aktive E3-Definition wurde nicht gefunden');
  const scriptStart = html.lastIndexOf('<script id="exporthub-rc373-shipment-controller">', e3);
  const scriptEnd = html.indexOf('</script>', e3);
  assert.ok(scriptStart >= 0 && scriptEnd > scriptStart, 'Aktiver Shipment-Controller konnte nicht abgegrenzt werden');
  const controller = html.slice(scriptStart, scriptEnd);

  const refs = [...controller.matchAll(/\bPACK\b/g)];
  console.log(`PACK_REFS=${refs.length}`);
  refs.forEach((m, i) => {
    const a = Math.max(0, m.index - 900);
    const b = Math.min(controller.length, m.index + 1600);
    console.log(`PACK_REF_${i + 1}@${m.index}: ${controller.slice(a,b).replace(/\s+/g,' ')}`);
  });
});
