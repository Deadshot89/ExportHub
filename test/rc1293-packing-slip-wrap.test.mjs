import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const demo=fs.readFileSync('assets/exporthub-demo-bootstrap.js','utf8');
const browser=fs.readFileSync('e2e/specs/print-documents.spec.mjs','utf8');

test('RC1293: Deckblatt rendert Lieferscheine als mehrzeiliges Auto-Fit-Raster',()=>{
  assert.match(build,/data-rc1293-packing-slip-grid="1"/);
  assert.match(build,/grid-template-columns:repeat\(auto-fit,minmax\(36mm,1fr\)\)/);
  assert.match(build,/data-rc1293-packing-slip="1"/);
  assert.match(build,/overflow-wrap:anywhere/);
  assert.match(build,/word-break:break-word/);
  assert.doesNotMatch(build,/d\.join\('\\n'\)\|\|'–'/,'Lieferscheine dürfen nicht mehr ausschließlich vertikal untereinander gerendert werden');
});

test('RC1293: Browserfixture erzwingt mit sieben echten deliveryFiles mindestens eine zweite Reihe',()=>{
  assert.match(demo,/deliveryFiles:\[\{id:'DLV-DEMO-2A'/);
  for(let i=2;i<=7;i++){
    const needle=i===2?'Fake_Lieferschein_DEMO02.pdf':`LS_4711000${i}.pdf`;
    assert.ok(demo.includes(needle),needle+' fehlt in DEMO02');
  }
  assert.match(build,/'assets\/exporthub-demo-bootstrap\.js'/,'aktueller Demo-Datensatz muss in den finalen Build kopiert werden');
  assert.match(browser,/packingSlipGrid/);
  assert.match(browser,/packingSlipGrid\.count\)\.toBe\(7\)/);
  assert.match(browser,/packingSlipGrid\.rowCount\)\.toBeGreaterThanOrEqual\(2\)/);
  assert.match(browser,/scrollWidth<=capture\.packingSlipGrid\.clientWidth\+2/);
});

test('RC1293: Build, Demo und Browserprüfung bleiben syntaktisch gültig',()=>{
  for(const file of ['.github/rc1112/build-three-env.mjs','assets/exporthub-demo-bootstrap.js','e2e/specs/print-documents.spec.mjs']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});
