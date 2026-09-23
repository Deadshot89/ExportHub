import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync('assets/rc1207-pallet-account-fix.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1246: Palettenkonto-Ansicht wird über State oder echte Paletten-DOM-Elemente erkannt',()=>{
  assert.match(source,/function palletViewActive\(\)/);
  assert.match(source,/if\(view==='pallet'\)return true/);
  assert.match(source,/\.rc542-table,#rc542PalIn,#rc542PalOut,\[data-exporthub-rendered-view="pallet"\]/);
});

test('RC1246: Scheduler startet außerhalb des Palettenkontos keinen Tabellen-Scan-Timer',()=>{
  const start=source.indexOf('function scheduleEnhance(){');
  const end=source.indexOf('async function cleanupProductionDayOnce',start);
  assert.ok(start>=0&&end>start,'scheduleEnhance Block fehlt');
  const block=source.slice(start,end);
  assert.match(block,/installBookingGuard\(\)/);
  assert.match(block,/if\(!palletViewActive\(\)\)return false/);
  assert.ok(block.indexOf('!palletViewActive()')<block.indexOf('setTimeout'),'View-Guard muss vor Timer liegen');
});

test('RC1246: globaler MutationObserver plant Arbeit nur bei aktiver Palettenansicht',()=>{
  const start=source.indexOf("if(typeof root.MutationObserver==='function'");
  const end=source.indexOf("(root.setTimeout||setTimeout)",start);
  assert.ok(start>=0&&end>start,'MutationObserver Block fehlt');
  const block=source.slice(start,end);
  assert.match(block,/new root\.MutationObserver\(function\(\)\{if\(palletViewActive\(\)\)scheduleEnhance\(\)\}\)/);
});

test('RC1246: Buchungs- und Admin-Funktionen bleiben erhalten',()=>{
  assert.match(source,/function installBookingGuard\(\)/);
  assert.match(source,/function syncDirectionUi\(\)/);
  assert.match(source,/function enhanceAdminDeleteButtons\(\)/);
  assert.match(source,/function deletePalletBooking\(id,options\)/);
  assert.match(source,/version:'RC1246'/);
});

test('RC1246: neue Runtime wird mit frischem Cache-Key ausgeliefert',()=>{
  assert.match(build,/assets\/rc1207-pallet-account-fix\.js\?v=1246/);
  assert.doesNotMatch(build,/assets\/rc1207-pallet-account-fix\.js\?v=1207/);
});

test('RC1246: Runtime bleibt syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','assets/rc1207-pallet-account-fix.js'],{stdio:'pipe'});
});
