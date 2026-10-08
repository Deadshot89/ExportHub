import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function block(source,startMarker,endMarker){
  const start=source.indexOf(startMarker);
  const end=start<0?-1:source.indexOf(endMarker,start+startMarker.length);
  assert.ok(start>=0&&end>start,`Funktionsgrenze fehlt: ${startMarker}`);
  return source.slice(start,end);
}

test('RC1467: Login-/Startup-AutoEnable darf keine Colli-validierende Sendungsspeicherung auslösen',()=>{
  const source=fs.readFileSync('assets/rc1015-lieferavis-mail-flow.js','utf8');
  const auto=block(source,'async function rc1021AutoEnable(reason){','function stripAvisBlocks(text){');
  assert.match(auto,/RC1467: background\/startup auto-enable/,'RC1467 Startup-Guard fehlt');
  assert.doesNotMatch(auto,/rc1015PersistBeforeAvis\s*\(/,'Automatischer Login-/Lifecycle-Pfad darf die strikte Sendungsspeicherung nicht starten');
  assert.match(auto,/var saveAlreadyConfirmed=true;/,'Automatischer Lifecycle muss als bereits persistierter Hintergrundpfad behandelt werden');
});

test('RC1467: bewusste Lieferavis-Aktivierung behält die normale Save-/Colli-Prüfung',()=>{
  const source=fs.readFileSync('assets/rc1015-lieferavis-mail-flow.js','utf8');
  const manual=block(source,'async function rc1015Toggle(on){','async function rc1021AutoEnable(reason){');
  assert.match(manual,/rc1015PersistBeforeAvis\s*\(/,'Manuelle Aktivierung muss weiterhin den normalen validierten Save-Pfad verwenden');
});

test('RC1467: Produktionsbuild erzwingt frischen Lieferavis-Runtime-Request',()=>{
  const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  assert.match(builder,/\/assets\/rc1015-lieferavis-mail-flow\.js\?v=1383&rc=1467/,'RC1467 Cache-Bust fehlt im Produktionsbuild');
});
