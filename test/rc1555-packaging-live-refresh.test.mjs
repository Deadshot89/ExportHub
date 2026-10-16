import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SOURCE=fs.readFileSync('assets/rc1555-packaging-shipment.js','utf8');

test('RC1555 already-rendered shipment packaging menus refresh from canonical active masterdata without reload',()=>{
  assert.match(SOURCE,/ExportHUBPackagingStore/,'shipment selector must read the canonical packaging store');
  assert.match(SOURCE,/activeItems\s*\(/,'live refresh must use active canonical packaging only');
  assert.match(SOURCE,/function\s+refreshPackagingOptions\s*\(/,'runtime needs an explicit live option refresh for existing RC682 pickers');
  assert.match(SOURCE,/\.rc682-packaging-picker/,'live refresh must update already-rendered RC682 pickers');
  assert.match(SOURCE,/\.rc682-packaging-native/,'hidden native selector must be refreshed together with the visible menu');
  assert.match(SOURCE,/\.rc682-packaging-columns/,'visible packaging menu columns must be rebuilt from current masterdata');
  assert.match(SOURCE,/exporthub:packaging-masterdata-changed[^\n]*refreshPackagingOptions/s,'masterdata event must invoke the live option refresh');
  assert.doesNotMatch(SOURCE,/location\.reload|location\.assign|location\.replace/i,'live refresh must not reload the application');
});
