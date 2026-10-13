import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rc1013Build=fs.readFileSync('.github/rc1013/build-three-env.mjs','utf8');
const rc1016Build=fs.readFileSync('.github/rc1016/build-three-env.mjs','utf8');
const mainContract=fs.readFileSync('.github/workflows/rc1002-main-contract.yml','utf8');
const mainVerify=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
const production=fs.readFileSync('.github/workflows/exporthub-production-release.yml','utf8');
const testservice=fs.readFileSync('.github/workflows/exporthub-testservice.yml','utf8');
const productionVersion=fs.readFileSync('production-version.js','utf8');

function has(text,pattern,message){assert.match(text,pattern,message)}
function currentRc(){
  const m=productionVersion.match(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC(\d+)'/);
  assert.ok(m,'Autoritativer Produktions-RC fehlt');
  return Number(m[1]);
}

test('RC1017: historischer Basisbuild liefert Kalender und Multi-Truck-Asset in alle drei HTML-Ausgaben',()=>{
  for(const asset of ['assets/abholkalender.js','assets/abholkalender.css','assets/rc1017-multi-truck.js']){
    has(rc1013Build,new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),asset+' fehlt im RC1013-Basisbuild');
  }
  has(rc1013Build,/multiTruckTag\(\)/,'RC1017 Script-Tag wird nicht injiziert');
  has(rc1013Build,/const production=prepare\(/,'Produktion fehlt');
  has(rc1013Build,/const testservice=prepare\(/,'TESTSERVICE fehlt');
  has(rc1013Build,/const demo=prepare\(/,'Demo fehlt');
});

test('RC1017: produktiver RC1016-Build dokumentiert den geerbten Multi-Truck-Releasebestand',()=>{
  has(rc1016Build,/execFileSync\(process\.execPath,\['\.github\/rc1013\/build-three-env\.mjs'\]/,'RC1016 baut nicht auf dem geprüften RC1013-Basisbuild auf');
  has(rc1016Build,/fs\.cpSync\(SRC,OUT,\{recursive:true\}\)/,'RC1016 übernimmt den Basisbuild nicht vollständig');
  has(rc1016Build,/multiTruck\s*:\s*['"]assets\/rc1017-multi-truck\.js['"]/,'RC1016 Manifest dokumentiert RC1017 Multi-Truck noch nicht');
});

test('RC1017: Main-Contract prüft den Releasevertrag und alle drei gebauten HTML-Dateien',()=>{
  has(mainContract,/test\/rc1017-three-env-release\.test\.mjs/,'RC1017 Release-Test fehlt im Main-Contract');
  for(const file of ['dist-rc1013/index.html','dist-rc1013/TESTVERSION.html','dist-rc1013/demo.html']){
    has(mainContract,new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'.*rc1017-multi-truck|rc1017-multi-truck.*'+file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'s'),file+' wird nicht auf RC1017 geprüft');
  }
});

test('RC1505/RC1017: Main Verification hält Multi-Truck im Release und Production bleibt separater SHA-Pfad',()=>{
  const rc=currentRc();
  assert.ok(rc>=1017,`Aktueller Release RC${rc} darf nicht hinter RC1017 zurückfallen`);
  has(mainVerify,/\.github\/rc\*\/\*\*/,'RC-Hilfsdateien lösen die Main Verification nicht aus');
  has(mainVerify,/test\/\*\*/,'RC1017 Tests lösen die Main Verification nicht aus');
  has(mainVerify,/test\/rc1017-three-env-release\.test\.mjs/,'RC1017 Release-Test fehlt im Main-Verification-Gate');
  has(mainVerify,/test -s dist-rc1112\/assets\/rc1017-multi-truck\.js/,'RC1017 Assetprüfung fehlt vor TESTSERVICE-Deploy');
  assert.doesNotMatch(mainVerify,/Deploy ExportHUB production/,'Main Verification darf Production nicht deployen');
  has(production,/name:\s*ExportHUB Production Release/,'separater Production-Release fehlt');
  has(production,/release_sha:/,'Production-Release ist nicht SHA-fest');
  has(production,/RC1505 Erfolgreiche Main Verification für Release-SHA verlangen/,'Production verlangt keinen erfolgreichen Main-Verification-Lauf');
  has(production,/test -s \.rc1112_production_app\/assets\/rc1017-multi-truck\.js/,'RC1017 Assetprüfung fehlt im Production-Paket');
});

test('RC1017: ausdrücklicher TESTSERVICE-Ausnahmeweg prüft denselben Multi-Truck-Bestand',()=>{
  has(testservice,/test\/rc1017-three-env-release\.test\.mjs/,'RC1017 Release-Test fehlt im TESTSERVICE-Ausnahmevertrag');
  has(testservice,/assets\/rc1017-multi-truck\.js/,'RC1017 Assetprüfung fehlt im TESTSERVICE-Ausnahmevertrag');
});
