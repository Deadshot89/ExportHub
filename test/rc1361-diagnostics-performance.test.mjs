import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/rc1013-diagnostics.js','utf8');
const build=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');
const start=source.indexOf('  function install(win){');
const end=source.indexOf('  return Object.freeze(',start);
const install=source.slice(start,end);

test('RC1361: Diagnose beobachtet den globalen DOM nicht mehr dauerhaft',()=>{
  assert.ok(start>=0&&end>start,'install()-Block der Diagnose fehlt');
  assert.doesNotMatch(install,/observe\(win\.document\.documentElement/,'kein seitenweiter Dauer-MutationObserver erlaubt');
  assert.match(install,/activeObserver\.observe\(target,\{childList:true,subtree:true\}\)/,'Observer muss nur den aktiven Diagnosebereich beobachten');
  assert.match(install,/if\(!diagnosticsVisible\(win\)\)\{stopActiveWatchers\(\);return false;\}/,'Observer muss außerhalb der Diagnoseansicht deaktiviert bleiben');
  assert.match(install,/activeObserver\.disconnect\(\)/,'Observer muss beim Verlassen der Diagnoseansicht getrennt werden');
});

test('RC1361: 10-Sekunden-Polling läuft nur in der sichtbaren Diagnoseansicht',()=>{
  assert.match(install,/if\(!activePollTimer&&typeof win\.setInterval==='function'\)/);
  assert.match(install,/activePollTimer=win\.setInterval\(function\(\)\{if\(!win\.document\.hidden&&diagnosticsVisible\(win\)\)refresh\(win\);\},10000\)/);
  assert.match(install,/win\.clearInterval\|\|clearInterval/,'Polling muss beim View-Wechsel beendet werden');
  assert.doesNotMatch(install,/win\.setInterval\(function\(\)\{if\(!win\.document\.hidden&&\(diagnosticsVisible/,'alter dauerhaft installierter Polling-Pfad darf nicht zurückkehren');
});

test('RC1361: eigene Diagnose-Renderings lösen keine Refresh-Schleife aus',()=>{
  assert.match(install,/function mutationOutsideEnhancedHost\(records\)/);
  assert.match(install,/target===host\|\|\(host\.contains&&host\.contains\(target\)\)/);
  assert.match(install,/if\(mutationOutsideEnhancedHost\(records\)\)schedule\(180\)/);
});

test('RC1361: Funktionsvertrag und Auslieferung bleiben erhalten',()=>{
  assert.match(source,/\/api\/diagnostic-autofix/);
  assert.match(source,/data-rc1083-level/);
  assert.match(source,/data-rc1083-status/);
  assert.match(source,/data-rc1083-area/);
  assert.match(source,/version:'RC1085'/,'Autofix-Fachversion darf durch die Performanceänderung nicht umgedeutet werden');
  assert.match(build,/assets\/rc1013-diagnostics\.js\?v=1361/,'geänderte Runtime braucht einen frischen Cache-Key');
});
