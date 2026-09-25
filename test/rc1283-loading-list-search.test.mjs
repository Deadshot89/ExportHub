import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1283-loading-list-search.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const e2e=fs.readFileSync('e2e/specs/print-documents.spec.mjs','utf8');

function api(){
  const document={readyState:'loading',addEventListener(){},querySelectorAll(){return[]},getElementById(){return null},documentElement:null};
  const window={document,addEventListener(){},setTimeout(){return 1},clearTimeout(){},console,Map,Event:function(){},MutationObserver:null};
  vm.runInContext(runtime,vm.createContext({window,document,console,Map,Event:function(){},MutationObserver:null}));
  return window.ExportHUBRC1283LoadingListSearch;
}

test('RC1283: Suchindex enthält Referenz, Kunde, Anhang/Dateiname und Bemerkung',()=>{
  const x=api(),shipment={id:'S1',ref:'ABC123',customerName:'Beispiel Kunde',comments:'Tor 4 beachten',documents:[{name:'Lieferschein_ABC123.pdf'}]};
  const hay=x.searchText(shipment,'ABC123 · Beispiel Kunde');
  for(const marker of ['abc123','beispiel kunde','lieferschein_abc123.pdf','tor 4 beachten'])assert.ok(hay.includes(marker),marker+' fehlt im Suchindex');
});

test('RC1283: Mehrwortsuche filtert nur passende Ladelisten',()=>{
  const x=api(),rows=[
    {search:'abc123 beispiel kunde lieferschein_abc123.pdf tor 4 beachten'},
    {search:'xyz999 anderer kunde rechnung.pdf'}
  ];
  assert.equal(x.filterRows(rows,'Beispiel Lieferschein').length,1);
  assert.equal(x.filterRows(rows,'Tor 4').length,1);
  assert.equal(x.filterRows(rows,'nicht vorhanden').length,0);
});

test('RC1283: Runtime ersetzt die Dropdown-Bedienung und bietet drei direkte Aktionen',()=>{
  assert.match(runtime,/Ladeliste suchen/);
  assert.match(runtime,/data-rc1283-native-select/);
  assert.match(runtime,/style\.setProperty\('display','none','important'\)/);
  for(const action of ['open','print','download'])assert.ok(runtime.includes("['"+action+"'")||runtime.includes("'"+action+"'"),action+' fehlt');
  assert.match(runtime,/download-load1/);
  assert.match(runtime,/__EXPORTHUB_RC1283_OPEN_LOAD1__/);
  assert.match(runtime,/__EXPORTHUB_RC1283_DOWNLOAD_LOAD1__/);
});

test('RC1283: Drei-Umgebungen-Build injiziert Runtime und vorhandene Ladelisten-Pfade',()=>{
  assert.match(build,/function patchRc1283LoadingListSearch\(/);
  assert.match(build,/assets\/rc1283-loading-list-search\.js\?v=1283-6/);
  assert.match(build,/__EXPORTHUB_RC1283_OPEN_LOAD1__/);
  assert.match(build,/__EXPORTHUB_RC1283_DOWNLOAD_LOAD1__/);
  assert.match(build,/body=loadHtml\(sh,true\)/);
  assert.match(build,/createPdf\('load1',sh\)/);
  assert.match(build,/'assets\/rc1283-loading-list-search\.js'/);
});

test('RC1283: Trefferauswahl ist vom alten Dropdown entkoppelt und bleibt als Snapshot verfügbar',()=>{
  const start=runtime.indexOf("b.addEventListener('click'");
  const end=runtime.indexOf('results.appendChild(b)',start);
  assert.ok(start>=0&&end>start);
  const clickBlock=runtime.slice(start,end);
  assert.doesNotMatch(clickBlock,/dispatchSelection/);
  assert.match(clickBlock,/selectedSnapshot=/);
  assert.match(clickBlock,/lastSelectedRef=refOf\(row\.shipment\)\|\|row\.reference\|\|row\.value/);
  assert.match(runtime,/if\(selectedSnapshot&&selectedSnapshot\.shipment\)return selectedSnapshot/);
});

test('RC1283: DOM-Wächter ignoriert Suchergebnis-Mutationen und erkennt dynamische Sendungsoptionen',()=>{
  assert.match(runtime,/function rc1283MutationRelevant\(records\)/);
  assert.match(runtime,/target===current\|\|current\.contains&&current\.contains\(target\)/);
  assert.match(runtime,/closest\('#rc1283LoadListSearch'\)/);
  assert.match(runtime,/querySelectorAll\('select'\)/);
  assert.match(runtime,/if\(rc1283MutationRelevant\(records\)\)schedule\(\)/);
  assert.match(runtime,/exporthub:rendered/);
  assert.match(runtime,/exporthub:viewchange/);
});

test('RC1283: echter Browsertest prüft alle vier Suchdimensionen und verbirgt das alte Dropdown',()=>{
  for(const marker of ['DEMO02','Benelux','Fake_Lieferschein_DEMO02.pdf','RC1203 Demo-Bemerkung'])assert.ok(e2e.includes(marker),marker+' fehlt im Browsertest');
  assert.match(e2e,/getByRole\('combobox',\{name:'Sendung auswählen'\}\)\.first\(\)/);
  assert.match(e2e,/toBeHidden/);
  assert.match(e2e,/data-rc1283-result/);
  assert.match(e2e,/data-rc1283-action/);
  assert.match(e2e,/selectOption\(value,\{force:true\}\)/);
});
