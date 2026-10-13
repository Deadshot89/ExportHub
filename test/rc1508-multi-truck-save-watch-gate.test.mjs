import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/rc1328-multi-truck-ui-refresh.js','utf8');

test('RC1508: normale Ein-LKW-Speicherung startet keinen 50-Sekunden Mehr-LKW-Watcher',()=>{
  assert.match(
    source,
    /function onSaved\(event\)\{\s*var detail=event&&event\.detail\|\|\{\},sh=detail\.shipment;\s*if\(sh&&!hasMultiTruck\(sh\)\)return false;\s*return schedule\(sh\)\s*\}/,
    'shipment-saved muss bekannte Ein-LKW-Sendungen ohne watchCurrent(50) beenden'
  );
});

test('RC1508: lokales No-Merge-Save-ACK startet über exporthub:sync keinen Mehr-LKW-Watcher',()=>{
  assert.match(
    source,
    /function isNoMergeSaveConfirmation\(event\)\{var detail=event&&event\.detail\|\|\{\};return detail\.remote===true&&detail\.reason==='save-confirmation'&&detail\.concurrentMerge!==true\}/,
    'Mehr-LKW-Runtime benötigt den gemeinsamen No-Merge-Save-ACK-Guard'
  );
  assert.match(
    source,
    /w\.addEventListener\('exporthub:sync',function\(event\)\{if\(isNoMergeSaveConfirmation\(event\)\)return;scheduleCurrent\(\)\}\)/,
    'lokales Save-ACK darf scheduleCurrent() nicht erneut starten'
  );
});

test('RC1508: echte Mehr-LKW- und Lifecycle-Refreshes bleiben erhalten',()=>{
  assert.match(source,/w\.addEventListener\('exporthub:shipment-saved',onSaved\)/);
  assert.match(source,/\['exporthub:viewchange','exporthub:rendered','exporthub:state-loaded','exporthub:shipment-updated'\]\.forEach\(function\(name\)\{\s*w\.addEventListener\(name,scheduleCurrent\)\s*\}\)/);
  assert.match(source,/function schedule\(sh\)\{\s*if\(hasMultiTruck\(sh\)&&refresh\(sh\)\)return true;\s*return watchCurrent\(50\)\s*\}/);
});
