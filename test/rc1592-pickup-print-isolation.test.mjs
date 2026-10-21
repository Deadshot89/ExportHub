import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pickup=fs.readFileSync('assets/rc1546-pickup-control.js','utf8');
const smoke=fs.readFileSync('e2e/specs/public-smoke.spec.mjs','utf8');

test('RC1592: Abholkontrolle blendet andere Druckseiten nur bei vorhandenem Overlay aus',()=>{
  assert.match(pickup,/@media print\{body:has\(> \.rc1546-overlay\)>\*:not\(\.rc1546-overlay\)\{display:none!important\}/,
    'Globale Druck-Sperre muss an aktives Abholkontroll-Overlay gebunden sein');
  assert.doesNotMatch(pickup,/@media print\{body>\*:not\(\.rc1546-overlay\)\{display:none!important\}/,
    'Unbedingte Druck-Sperre würde auch echte Ladelisten verstecken');
});

test('RC1592: A4-Querformat gehört ausschließlich zur Abholkontrolle, nicht zu allen Ladelisten',()=>{
  assert.match(pickup,/@page rc1546ControlPage\{size:A4 landscape;margin:10mm\}/,
    'Die Abholkontrolle braucht eine eigene benannte Querformat-Seite');
  assert.match(pickup,/\.rc1546-overlay\{page:rc1546ControlPage!important;/,
    'Nur das aktive Overlay soll das Querformat nutzen');
  assert.doesNotMatch(pickup,/@page\{size:A4 landscape;margin:10mm\}/,
    'Globale A4-Querformat-Regel überschreibt sonst normale Ladelisten');
});

test('RC1592: der Browser-Smoke prüft beide Druckmodi und die Signaturgeometrie',()=>{
  assert.match(smoke,/expect\(layout\.printPageHeight,[^\n]*\)\.toBeGreaterThan\(0\)/);
  assert.match(smoke,/expect\(layout\.signatureHeight\)\.toBeGreaterThan\(0\)/);
  // Druckbild mit geladener Kontroll-CSS vor, während und nach dem Overlay prüfen.
  for(const marker of ['normalPrint.overlayCount','normalPrint.stageDisplay','normalPrint.stageHeight',
    'normalPrint.signatureHeight','restoredPrint.stageDisplay','restoredPrint.stageHeight']){
    assert.ok(smoke.includes('expect('+marker+','),'Fehlende 3-Zustands-Druckprüfung: '+marker);
  }
  assert.ok(smoke.indexOf('const normalPrint=')>smoke.indexOf('exporthub-rc1546-style'),
    'Normaldruck erst NACH Installation der echten CSS prüfen');
  assert.ok(smoke.indexOf('const normalPrint=')<smoke.indexOf('const overlayPrint='),
    'Normaldruck muss VOR dem Overlay geprüft werden');
  assert.ok(smoke.indexOf('const restoredPrint=')>smoke.indexOf('const overlayPrint='),
    'Wiederherstellung muss NACH dem Overlay geprüft werden');
  // CSS blendet den direkten body-Kindcontainer aus, nicht jedes verschachtelte
  // DOM-Element einzeln. ComputedStyle(stage) bleibt sonst irreführend "block".
  assert.match(smoke,/pageRoot\.parentElement!==document\.body/);
  assert.match(smoke,/expect\(overlayPrint\.pageRootIsBodyChild,[^\n]*\)\.toBe\(true\)/);
  assert.match(smoke,/expect\(overlayPrint\.pageRootDisplay,[^\n]*\)\.toBe\('none'\)/);
  assert.match(smoke,/expect\(overlayPrint\.stageHeight,[^\n]*\)\.toBe\(0\)/);
  assert.match(smoke,/expect\(overlayPrint\.overlayDisplay,[^\n]*\)\.not\.toBe\('none'\)/);
  assert.match(smoke,/expect\(overlayPrint\.overlayHeight,[^\n]*\)\.toBeGreaterThan\(0\)/);
  assert.doesNotMatch(smoke,/expect\(overlayPrint\.stageDisplay,[^\n]*\)\.toBe\('none'\)/,
    'Die alte Child-computedStyle-Prüfung ergibt trotz verborgenem Elterncontainer block');
});

test('RC1592: der sichere Abholkontroll-Druckmodus bleibt möglich',()=>{
  assert.match(pickup,/function printCurrentList\(\)\{[^}]*window\.print\(\)/);
  assert.match(pickup,/overlay\.className='rc1546-overlay'/);
  assert.match(pickup,/d\.body\.appendChild\(overlay\)/);
  assert.match(pickup,/\.rc1546-overlay\{page:rc1546ControlPage!important;position:static!important;display:block!important/);
});


test('RC1592: die Abholkontroll-Runtime liegt schon vor dem lokalen Browser-Gate im Drei-Umgebungen-Build',()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  const finalizer=fs.readFileSync('.github/rc1488/finalize-auto-update.mjs','utf8');
  assert.match(build,/'assets\/rc1546-pickup-control\.js'/,
    'Lokale Print-Browser-Tests benötigen dieselbe Runtime bereits im ersten Build');
  assert.match(finalizer,/PICKUP_SCRIPT_SRC='\/assets\/rc1546-pickup-control\.js\?v=1546'/,
    'Release-Finalizer muss die identische Abholkontroll-Datei ausliefern');
});
