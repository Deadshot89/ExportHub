import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');
function block(start,end,max=9000){const s=html.indexOf(start);assert.ok(s>=0,start+' fehlt');const e=end?html.indexOf(end,s+start.length):-1;return html.slice(s,e>s?e:s+max)}

test('RC1031: HTTP 410 markiert einen toten Pickup-Token bis zu einem bewussten Reset als nicht mehr pollbar',()=>{
  const sync=block('function syncOne(','async function syncAll(');
  assert.match(sync,/e&&e\.status===410/,'410 Gone muss als dauerhafter Token-Miss behandelt werden.');
  assert.match(sync,/serverMissUntil\[token\]=Number\.MAX_SAFE_INTEGER/,'410 darf nicht nach 30 Sekunden erneut gepollt werden.');
  assert.match(sync,/misses\+\+;continue/,'410 muss wie ein nicht mehr vorhandener Datensatz aus der Schleife herausfallen.');
});

test('RC1031: erfolgreicher manueller QR-Reset hebt die 410-Sperre für denselben Token wieder auf',()=>{
  const reset=block('function resetPickupServer(','function disable(');
  assert.match(reset,/delete serverMissUntil\[token\]/,'Reset muss die serverseitige Miss-Sperre löschen.');
  assert.match(reset,/delete lastSync\[token\]/,'Reset muss auch die letzte Poll-Zeit zurücksetzen.');
});
