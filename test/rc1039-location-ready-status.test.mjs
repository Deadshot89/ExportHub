import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('api/location-booking/index.js','utf8');

test('RC1039: Bereit zur/für Abholung wird als lagerbereit erkannt',()=>{
  assert.match(src,/function\s+pickupReadyStatus\s*\(/);
  assert.ok(src.includes("bereit\\s+(?:zur|für)\\s+abholung"),'deutsche Statusvarianten müssen unterstützt werden');
  assert.ok(src.includes("abholbereit"),'Abholbereit muss unterstützt werden');
  assert.ok(src.includes("ready\\s+(?:for\\s+)?pickup"),'englischer Ready-for-pickup-Status muss unterstützt werden');
});

test('RC1039: bestehende und bereits bereitgestellte Sendungen bleiben umbuchbar',()=>{
  assert.match(src,/function\s+readyForLocation\s*\([^)]*\)[\s\S]{0,220}r\.prepared===true/,'prepared=true muss eine Umbuchung erlauben');
  assert.match(src,/ready:readyForLocation\(r\)/,'GET muss den korrigierten Lagerstatus auch für bestehende Datensätze liefern');
  assert.match(src,/if\(!readyForLocation\(rec\)\)throw err\('NOT_READY'/,'move darf nicht mehr ausschließlich am historischen ready-Boolean hängen');
});

test('RC1039: Register synchronisiert Status und ready konsistent',()=>{
  assert.match(src,/rec\.status=text\(b\.status\|\|rec\.status\);rec\.ready=b\.ready===true\|\|rec\.prepared===true\|\|pickupReadyStatus\(rec\.status\)/);
});
