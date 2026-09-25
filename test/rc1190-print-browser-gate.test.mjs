import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const spec=fs.readFileSync('e2e/specs/print-documents.spec.mjs','utf8');
const mainWorkflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
const prWorkflow=fs.readFileSync('.github/workflows/rc1190-print-browser-pr.yml','utf8');

test('RC1190: Gesamtdruck-Browserabnahme benutzt die echte UI-Aktion und echten Druckkontext',()=>{
  assert.match(spec,/data-index352-action=[\"']print-all[\"']/);
  assert.match(spec,/Gesamtausgabe\\s\*drucken\|Gesamtdruck/);
  assert.match(spec,/printButton\.click/);
  assert.match(spec,/__RC1190_PRINT_CAPTURE__/);
  assert.match(spec,/for\(const frame of p\.frames\(\)\)/);
  assert.match(spec,/\\brc390-cover\\b/);
  for(const marker of ['Ladeliste','Ladeliste\\s*1','Ladeliste\\s*2','CMR','CMR\\s*4','Warenbeschreibung'])assert.ok(spec.includes(marker),marker+' fehlt in der Browserabnahme');
  assert.match(spec,/pages:Array\.from\(document\.querySelectorAll\('\.rc390-page,\.rc352-page'\)\)/);
  assert.match(spec,/Gesamtdruck enthält eine leere oder praktisch leere Dokumentseite/);
  assert.match(spec,/vertikal abgeschnittene Inhalte/);
  assert.match(spec,/horizontal abgeschnittene Inhalte/);
});

test('RC1190: Browserabnahme verwendet die lokale Fake-Benelux-Sendung ohne Servermutation',()=>{
  assert.match(spec,/DEMO02\|Benelux/);
  assert.match(spec,/selectOption/);
  assert.match(spec,/capture\.text\)\.toContain\('DEMO02'\)/);
  assert.match(spec,/attachRuntimeGuards/);
  assert.match(spec,/assertRuntimeClean/);
  assert.doesNotMatch(spec,/EXPORTHUB_E2E_LIVE/);
  assert.doesNotMatch(spec,/settleStateSave/);
  assert.doesNotMatch(spec,/__EXPORTHUB_GET_STATE__/);
});

test('RC1190: lokaler Main-Release-Gate enthält Gesamtdrucktest, Live-TESTSERVICE-Gate nicht',()=>{
  const localStart=mainWorkflow.indexOf('- name: RC1124 Lokales Browser-Gate');
  const liveStart=mainWorkflow.indexOf('- name: RC1124 TESTSERVICE Browser Gate');
  assert.ok(localStart>=0&&liveStart>localStart,'Browser-Gate-Blöcke fehlen');
  const localBlock=mainWorkflow.slice(localStart,liveStart);
  const liveBlock=mainWorkflow.slice(liveStart);
  assert.match(localBlock,/e2e\/specs\/print-documents\.spec\.mjs/);
  assert.equal(localBlock.includes('\\n          npx playwright test'),false,'lokaler Browser-Gate enthält literales \\n statt Zeilenumbruch');
  assert.doesNotMatch(liveBlock,/e2e\/specs\/print-documents\.spec\.mjs/);
});

test('RC1190: eigener PR-Browser-Gate baut das aktuelle Paket und führt nur den lokalen Drucktest aus',()=>{
  assert.match(prWorkflow,/pull_request:/);
  assert.match(prWorkflow,/node \.github\/rc1112\/build-three-env\.mjs/);
  assert.match(prWorkflow,/EXPORTHUB_E2E_STATIC:\s*['\"]1['\"]/);
  assert.match(prWorkflow,/npx playwright test e2e\/specs\/print-documents\.spec\.mjs --project=laptop/);
});

test('RC1190: neue Browserdateien sind syntaktisch gültig',()=>{
  for(const file of ['e2e/specs/print-documents.spec.mjs','test/rc1190-print-browser-gate.test.mjs']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});


test('RC1275: Browserabnahme prüft Palettenkonto in echtem Ladelisten-Druck',()=>{
  assert.match(spec,/RC1275 P1: Europaletten erscheinen im echten Ladelisten-Druck als Palettenkonto-Ausgang/);
  assert.match(spec,/DEMO01\|Nord/);
  assert.match(spec,/Palettenkonto\/i/);
  assert.ok(spec.includes("expect(capture.text).toMatch(/Ausgang:\\s*2\\s*Europaletten/i);"),'Palettenkonto-Ausgang wird im Browsertest nicht geprüft');
  assert.match(spec,/rc1095-pallet-account\/i/);
});

test('RC1274: finaler Build stellt L2 und vier CMR im Gesamtdruck wieder her',()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  assert.match(build,/function patchCompletePrintBundle\(/);
  assert.match(build,/loadHtml\(sh,true\)\+loadHtml\(sh,false\)\+cmrHtml\(sh\)/);
  assert.match(build,/\[d\.cover,d\.load1,d\.load2\]\.concat\(d\.cmrs\.slice\(0,4\)\)/);
  assert.match(build,/withQr\?'1 \/ 2 · mit QR-Code':'2 \/ 2 · ohne QR-Code'/);
  assert.match(build,/for\(var i=1;i<=4;i\+\+\)/);
});
