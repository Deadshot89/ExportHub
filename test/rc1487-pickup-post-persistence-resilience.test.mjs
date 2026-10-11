import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('api/pickup-confirm-v2/index.js','utf8');

test('RC1487 P0: persistierte Abholung darf bei Token-Consume-Fehler nicht wieder zu HTTP 500 werden',()=>{
  assert.match(src,/async function consumePickupAccess\(/,'post-persistentes Token-Tracking braucht eine fehlertolerante Grenze');
  assert.match(src,/pickup access consume pending/,'Consume-Fehler muss sichtbar geloggt statt geworfen werden');
  assert.doesNotMatch(src,/if\(complete\)await access\.consume\(/,'nach persistierter Abholung darf access.consume nicht ungeschützt werfen');
});

test('RC1487 P0: API meldet den echten Consume-Zustand und kann ihn beim Recovery nachholen',()=>{
  assert.match(src,/const oneTimeConsumed=await consumePickupAccess\(context,resolved,loader,rec\)/,'Recovery muss Token-Tracking best effort nachholen');
  assert.match(src,/if\(complete\)oneTimeConsumed=await consumePickupAccess\(context,resolved,loader,rec\)/,'Erstbestätigung muss denselben fehlertoleranten Pfad nutzen');
  assert.doesNotMatch(src,/oneTimeConsumed:true/,'Recovery darf bei fehlgeschlagenem Consume nicht fälschlich Erfolg melden');
  assert.doesNotMatch(src,/oneTimeConsumed:complete/,'Erstbestätigung darf Completion nicht mit Token-Consume gleichsetzen');
  assert.match(src,/oneTimeConsumed,teamStateSynced/,'Response muss den tatsächlich erreichten Consume-Zustand ausgeben');
});
