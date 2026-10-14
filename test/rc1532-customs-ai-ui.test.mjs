import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync(new URL('../assets/rc1532-customs-ai.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/rc1532-customs-ai.css',import.meta.url),'utf8');
const builder=fs.readFileSync(new URL('../.github/rc1532/build-three-env.mjs',import.meta.url),'utf8');
const currentBuilder=fs.readFileSync(new URL('../.github/rc1506/build-three-env.mjs',import.meta.url),'utf8');

test('RC1532 UI: KI-Zollexperte wird additiv in den bestehenden Exportexperten eingebaut',()=>{
  assert.match(runtime,/rc1294AbdAnalysis/);
  assert.match(runtime,/rc1294-router/);
  assert.match(runtime,/data-rc1294-mode['"]?,?\s*['"]ai|data-rc1294-mode=[\\"']ai/i);
  assert.match(runtime,/KI-Zollexperte/);
  assert.doesNotMatch(runtime,/replaceChildren\(.*rc626Abd|rc626Abd\.innerHTML|remove\(.*rc626Abd/i);
});

test('RC1532 UI: Fragen nutzen aktuellen Rechnungs-Snapshot und read-only API',()=>{
  assert.match(runtime,/ExportHUBRC1294ABDAnalysis/);
  assert.match(runtime,/\.snapshot\(/);
  assert.match(runtime,/\/api\/customs-ai/);
  assert.match(runtime,/method:['"]POST['"]/);
  assert.doesNotMatch(runtime,/saveAbd|confirmRc626Abd|createShipment|sendAbd|updateState|saveState/i);
});

test('RC1532 UI: Antwort zeigt Quellen, Prüfstand, Unsicherheit und sichere Links',()=>{
  assert.match(runtime,/checkedAt/);
  assert.match(runtime,/uncertainty/);
  assert.match(runtime,/sourceUrl/);
  assert.match(runtime,/noopener/);
  assert.match(runtime,/Aktuelle Rechnungsanalyse|Rechnungsanalyse/);
});

test('RC1532 UI: responsive Layout ohne Überlagerung',()=>{
  assert.match(css,/display:grid/);
  assert.match(css,/@media\s*\(max-width:\s*700px\)/);
  assert.match(css,/overflow-wrap:anywhere/);
  assert.match(css,/min-width:0/);
});

test('RC1532 Build: Asset wird in alle drei Umgebungen kopiert und genau einmal injiziert',()=>{
  assert.match(builder,/assets\/rc1532-customs-ai\.js/);
  assert.match(builder,/assets\/rc1532-customs-ai\.css/);
  for(const name of ['index.html','TESTVERSION.html','demo.html'])assert.match(builder,new RegExp(name.replace('.','\\.')));
  assert.match(builder,/exporthub-rc1532-customs-ai/);
});

test('RC1532 Build: aktuelle additive Release-Stufe bindet RC1532 nach RC1506 ein',()=>{
  assert.match(currentBuilder,/import\s*\{integrateCustomsAi\}\s*from\s*['"]\.\.\/rc1532\/build-three-env\.mjs['"]/);
  const coverage=currentBuilder.indexOf("fs.writeFileSync(path.join(out,'rc1506-sop-coverage-manifest.json')");
  const customs=currentBuilder.indexOf('integrateCustomsAi(root,out)');
  assert.ok(coverage>=0&&customs>coverage,'RC1532 muss additiv nach der bestehenden RC1506-Stufe ausgeführt werden');
});
