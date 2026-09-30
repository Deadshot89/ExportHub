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
  for(const marker of ['Ladeliste','Ladeliste\\s*1','CMR','CMR\\s*1','Warenbeschreibung'])assert.ok(spec.includes(marker),marker+' fehlt in der Browserabnahme');
  assert.match(spec,/expect\(capture\.load2Count\)\.toBe\(0\)/);
  assert.match(spec,/expect\(capture\.cmrCount\)\.toBe\(3\)/);
  assert.match(spec,/printDocuments:Array\.from\(document\.querySelectorAll\('\.rc390-page,\.rc352-page,\.rc390-cmr-wrap'\)\)/);
  assert.match(spec,/expect\(capture\.printDocuments\.length\)\.toBe\(5\)/);
  assert.match(spec,/Gesamtdruck enthält ein leeres oder praktisch leeres Druckdokument/);
  assert.match(spec,/vertikal abgeschnittene Inhalte/);
  assert.match(spec,/horizontal abgeschnittene Inhalte/);
});

test('RC1190: Browserabnahme verwendet die lokale Fake-Benelux-Sendung ohne Servermutation',()=>{
  assert.match(spec,/DEMO02\|Benelux/);
  assert.match(spec,/selectLoadingListShipment/);
  assert.match(spec,/Ladeliste suchen/);
  assert.match(spec,/data-rc1283-result/);
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

test('RC1340: Lieferschein-PDFs werden dedupliziert und über den Gesamtdruck ausgegeben',()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  assert.match(build,/function rc1340PrintableDeliveryAttachments/);
  assert.match(build,/await rc1340PrepareDeliveryAttachmentPrints\(sh\)/);
  assert.match(build,/await rc1340PrintPreparedAttachments\(attachmentJobs\)/);
  assert.match(build,/attachmentCount:attachmentJobs\.length/);
  assert.match(build,/window\.ExportHUBRC1340AttachmentPrint/);
  assert.match(build,/data-rc1354-pdf-print-bridge/);
  assert.match(build,/frame\.contentWindow\.postMessage\(\{type:'print'\},'\*'\)/);
  assert.match(build,/dataResponse=await fetch\(url\)/);
  assert.match(build,/URL\.createObjectURL\(dataBlob\)/);
  const bridgeStart=build.indexOf('async function rc1340PrintPreparedAttachment(item,index,total){');
  const bridgeEnd=build.indexOf('async function rc1340PrintPreparedAttachments(items){',bridgeStart);
  const bridge=build.slice(bridgeStart,bridgeEnd);
  assert.match(bridge,/if\(chromium\)/);
  const chromiumBlock=bridge.match(/if\(chromium\)\{([\s\S]*?)\}else\{/);
  assert.ok(chromiumBlock,'Chromium-Druckzweig fehlt');
  assert.match(chromiumBlock[1],/postMessage\(\{type:'print'\},'\*'\)/);
  assert.doesNotMatch(chromiumBlock[1],/\.print\(/);
  assert.match(spec,/RC1340 P1: echte Lieferschein-PDFs werden im Gesamtdruck exakt einmal gedruckt/);
  assert.match(spec,/expect\(result\.printed\)\.toHaveLength\(2\)/);
  assert.match(spec,/LS_NUR_METADATA\.pdf/);
  assert.match(spec,/status:'replaced'/);
});

test('RC1345: finaler Build erzwingt genau eine Ladeliste und drei CMR',()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  assert.match(build,/function patchCompletePrintBundle\(/);
  assert.match(build,/RC1345 Gesamtdruck muss genau eine Ladeliste enthalten/);
  assert.match(build,/return\[d\.cover,d\.load1\]\.concat\(d\.cmrs\.slice\(0,3\)\)\.filter\(Boolean\)/);
  assert.match(build,/for\(var i=1;i<=3;i\+\+\)/);
  assert.match(build,/CMR '\+i\+' \/ 3<\/div><\/div>'/);
});


test('RC1355: PDF attachment bridge never reads cross-origin Window.print',()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  const start=build.indexOf('async function rc1340PrintPreparedAttachment(item,index,total){');
  const end=build.indexOf('async function rc1340PrintPreparedAttachments(items){',start);
  assert.ok(start>=0&&end>start,'PDF attachment print bridge missing');
  const bridge=build.slice(start,end);
  assert.doesNotMatch(bridge,/frame\.contentWindow\.print\(\)/);
  assert.match(bridge,/frame\.contentWindow\.postMessage\(\{type:'print'\},'\*'\)/);
  assert.match(build,/RC1355 Cross-Origin PDF-Druckzugriff ist noch aktiv/);
});
