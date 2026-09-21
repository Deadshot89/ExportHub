import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const runtime=fs.readFileSync('assets/rc1198-cover-print.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const perf=fs.readFileSync('assets/rc1069-performance.js','utf8');
const navigation=fs.readFileSync('e2e/specs/navigation.spec.mjs','utf8');
const printE2e=fs.readFileSync('e2e/specs/print-documents.spec.mjs','utf8');

test('RC1198: Sendung erstellen erhält einen eigenen Nur-Deckblatt-Druckbutton',()=>{
  assert.match(runtime,/data-rc1198-print-cover/);
  assert.match(runtime,/Nur Deckblatt drucken/);
  assert.match(runtime,/rc363BlockActions/);
  assert.match(runtime,/rc363SaveShipment/);
  assert.match(runtime,/function hasOpenSave\(\)/);
  assert.match(runtime,/rt\.dirty\|\|rt\.pendingSave\|\|rt\.saving/);
  assert.match(runtime,/!a\|\|!saved\|\|hasOpenSave\(\)/);
  assert.match(runtime,/a\.print\('cover'\)/);
  assert.match(runtime,/Date\.now\(\)-startedAt>30000/);
});

test('RC1198: zentraler Dokumentrenderer unterstützt ausschließlich die Deckblattseite',()=>{
  assert.match(build,/if\(mode==='cover'\)return\[d\.cover\]\.filter\(Boolean\)/);
  assert.match(build,/mode==='cover'\?'Deckblatt':'Ladeliste'/);
  assert.match(build,/assets\/rc1198-cover-print\.js\?v=1198/);
  assert.match(build,/'assets\/rc1198-cover-print\.js'/);
});

test('RC1198: tatsächliches rc390-Deckblatt ist als Palettenblatt deutlich farbig',()=>{
  assert.match(build,/RC1198: tatsächliches rc390-Deckblatt für Paletten-Sichtbarkeit/);
  assert.match(build,/background:linear-gradient\(180deg,#facc15 0,#fde047 62mm,#fef08a 62mm,#facc15 100%\)/);
  assert.match(build,/border:10mm solid #08245d!important/);
  assert.match(build,/border-top-width:20mm!important/);
  assert.match(build,/\.rc390-cover \.rc390-cover-ref/);
  assert.match(build,/background:#08245d!important/);
  assert.match(build,/border:4mm solid #facc15!important/);
  assert.match(build,/font-size:48px!important/);
  assert.match(build,/\.rc390-cover \.rc390-card/);
  assert.match(build,/background:#dbeafe!important/);
  assert.match(build,/border:2mm solid #08245d!important/);
  assert.match(build,/\.rc390-cover \.rc390-cover-qr/);
  assert.match(build,/background:#fff!important/);
});

test('RC1198: Druckvorwärmung erkennt auch Nur-Deckblatt-Druck',()=>{
  assert.match(perf,/data-rc1198-print-cover/);
  assert.match(perf,/Deckblatt\\s\*drucken/);
});

test('RC1198: Browserabnahme deckt echten rc390-Druck und Ein-Seiten-Druck ab',()=>{
  assert.match(navigation,/Tatsächliches rc390-Deckblatt ist aus Palettenentfernung kontrastreich/);
  assert.match(navigation,/Sendung erstellen zeigt eigene Nur-Deckblatt-Druckaktion/);
  assert.match(printE2e,/Nur Deckblatt drucken erzeugt genau eine echte rc390-Deckblattseite/);
  assert.match(printE2e,/mainResult\?\.mode\)\.toBe\('cover'\)/);
  assert.match(printE2e,/mainResult\?\.pages\)\.toBe\(1\)/);
});

test('RC1198: Runtime, Build und Browsertests bleiben syntaktisch gültig',()=>{
  for(const file of [
    'assets/rc1198-cover-print.js',
    '.github/rc1112/build-three-env.mjs',
    'assets/rc1069-performance.js',
    'e2e/specs/navigation.spec.mjs',
    'e2e/specs/print-documents.spec.mjs'
  ]){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});
