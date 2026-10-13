import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const init=fs.readFileSync('api/pickup-init/index.js','utf8');
const confirm=fs.readFileSync('api/pickup-confirm-v2/index.js','utf8');

test('RC1516 P0: Reset bewahrt monotone Pickup-Sequenz fuer die naechste Fahrerunterschrift',()=>{
  assert.match(init,/pickupSequence/,'Reset muss die bereits verwendete Pickup-Sequenz bewahren');
  assert.match(confirm,/function nextSequence\(/,'Bestaetigung braucht einen monotonen Sequenzzaehler');
  assert.match(confirm,/r\.pickupSequence\s*=\s*sequence/,'verwendete Sequenz muss am Pickup-Datensatz persistiert werden');
  assert.doesNotMatch(confirm,/const sequence=historyOf\(r\)\.length\+1/,'nach Reset darf die Sequenz nicht wieder bei 1 beginnen');
});
