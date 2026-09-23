import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync('assets/rc1027-lieferavis-immediate.js','utf8');

test('RC1243: viewchange/rendered planen außerhalb der Sendungsansicht keinen Lieferavis-Draft-Refresh',()=>{
  const listener=source.slice(
    source.indexOf("if(window&&typeof window.addEventListener==='function'){"),
    source.indexOf("var api=Object.freeze",source.indexOf("if(window&&typeof window.addEventListener==='function'){"))
  );
  assert.match(listener,/name==='exporthub:viewchange'\|\|name==='exporthub:rendered'/);
  assert.match(listener,/!shipmentViewActive\(\)\)return false/);
  assert.ok(listener.indexOf("!shipmentViewActive()")<listener.indexOf("scheduleDraftRefresh(name,100)"),'Guard muss vor Draft-Refresh greifen');
});

test('RC1243: fachliche Lieferavis-Events bleiben aktiv',()=>{
  for(const marker of [
    "'exporthub:rendered'",
    "'exporthub:viewchange'",
    "'exporthub:shipment-customer-changed'",
    "'exporthub:customer-changed'",
    "'exporthub:customer-avis-updated'"
  ]) assert.ok(source.includes(marker),marker+' fehlt');
  assert.match(source,/return scheduleDraftRefresh\(name,100\)/);
});

test('RC1243: Eingaben in der Sendungsansicht triggern weiterhin Draft-Sync',()=>{
  assert.match(source,/scheduleDraftRefresh\('draft-input',260\)/);
  assert.match(source,/scheduleDraftRefresh\('draft-change',120\)/);
  assert.match(source,/function isShipmentDraftField\(el\)/);
});

test('RC1243: Runtime bleibt syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','assets/rc1027-lieferavis-immediate.js'],{stdio:'pipe'});
});
