import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SOURCE=fs.readFileSync('assets/rc1207-pallet-account-fix.js','utf8');

test('RC1299: automatische Palettenkonto-Bereinigung startet pro Seitenlauf nur einmal',()=>{
  assert.match(SOURCE,/cleanupAttempted=false/);
  const start=SOURCE.indexOf('function scheduleCleanup(){');
  const end=SOURCE.indexOf('\nif(root.addEventListener)',start);
  assert.ok(start>=0&&end>start,'scheduleCleanup fehlt');
  const block=SOURCE.slice(start,end);
  assert.match(block,/cleanupAttempted/);
  assert.match(block,/cleanupAttempted=true/);
});

test('RC1299: Hintergrund-Bereinigung löst keine 80-Sekunden-Save-Retry-Schleife mehr aus',()=>{
  const start=SOURCE.indexOf('async function persistOnce(reason){');
  const end=SOURCE.indexOf('\nfunction rerender(){',start);
  assert.ok(start>=0&&end>start,'persistOnce fehlt');
  const block=SOURCE.slice(start,end);
  assert.match(block,/lastSavedGeneration/,'bereits bestätigte queueSave-Generationen müssen ohne zweiten Flush akzeptiert werden');
  assert.match(block,/flushSave\(reason,\{force:true,userInitiated:false\}\)/);
  assert.doesNotMatch(block,/while\([^)]*!ok/,'persistOnce darf fehlgeschlagene Azure-Saves nicht wiederholt senden');
  assert.match(SOURCE,/await persistOnce\('RC1207 Palettenkonto 21\.09\.2026 bereinigt'\)/);
});

test('RC1299: explizites Admin-Löschen behält den bestätigten robusten Save-Pfad',()=>{
  const start=SOURCE.indexOf('async function deletePalletBooking');
  const end=SOURCE.indexOf('\nfunction bookingIdFromCorrection',start);
  assert.ok(start>=0&&end>start,'deletePalletBooking fehlt');
  const block=SOURCE.slice(start,end);
  assert.match(block,/await persist\('Palettenbuchung gelöscht'\)/);
  assert.doesNotMatch(block,/persistOnce/);
});

test('RC1299: Runtime-Version ist sichtbar aktualisiert',()=>{
  assert.match(SOURCE,/version:'RC1299'/);
});
