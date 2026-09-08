import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('TESTVERSION.html','utf8');
const needle = "{name:'E3',ldm:0.06,l:43,w:31,h:31}";

test('Diagnose: aktive E3-Übernahmelogik lokalisieren', () => {
  const e3 = html.lastIndexOf(needle);
  assert.ok(e3 >= 0, 'Aktive E3-Definition wurde nicht gefunden');
  const scriptStart = html.lastIndexOf('<script id="exporthub-rc373-shipment-controller">', e3);
  const scriptEnd = html.indexOf('</script>', e3);
  assert.ok(scriptStart >= 0 && scriptEnd > scriptStart, 'Aktiver Shipment-Controller konnte nicht abgegrenzt werden');
  const controller = html.slice(scriptStart, scriptEnd);
  console.log(`ACTIVE_E3_INDEX=${e3}`);

  let packRef = 0;
  for (const m of controller.matchAll(/\bPACK\b/g)) {
    packRef += 1;
    const a = Math.max(0,m.index-500), b = Math.min(controller.length,m.index+1200);
    console.log(`PACK_REF_${packRef}@${m.index}: ` + controller.slice(a,b).replace(/\s+/g,' '));
  }
  console.log(`PACK_REFS=${packRef}`);

  const interestingFunctions = [...controller.matchAll(/function\s+([A-Za-z0-9_$]+)\s*\(([^)]*)\)\{/g)]
    .map(m => ({name:m[1],args:m[2],index:m.index}))
    .filter(x => /row|colli|pack|type|ldm|dim|field|select/i.test(x.name));
  console.log('INTERESTING_FUNCTIONS=' + interestingFunctions.map(x => `${x.name}(${x.args})@${x.index}`).join(' | '));

  for (const fn of interestingFunctions) {
    const a = Math.max(0,fn.index-120), b = Math.min(controller.length,fn.index+1800);
    console.log(`FN_${fn.name}: ` + controller.slice(a,b).replace(/\s+/g,' '));
  }
});
