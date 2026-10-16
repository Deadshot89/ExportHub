import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('e2e/specs/multi-truck-live.spec.mjs','utf8');

test('RC1550: Mehr-LKW Live-Test wartet nur auf Pickup-Init der angeklickten Teilsendung',()=>{
  const start=source.indexOf('const responsePromise=page.waitForResponse');
  assert.ok(start>=0,'Pickup-Init Response-Wartebedingung fehlt');
  const end=source.indexOf('const response=await responsePromise',start);
  assert.ok(end>start,'Pickup-Init Response-Auswertung fehlt');
  const block=source.slice(start,end);
  assert.match(block,/postDataJSON\s*\(/,'Response-Matcher muss den Request-Body auswerten');
  assert.match(block,/subShipmentId/,'Response-Matcher muss die Teilsendungs-ID prüfen');
  assert.match(block,/===\s*id|id\s*===/,'Response-Matcher muss exakt die aktuell angeklickte Teilsendung matchen');
});
