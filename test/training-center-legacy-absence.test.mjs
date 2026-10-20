import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const LEGACY_DIR=path.join(ROOT,'assets','sop');
const ACTIVE_FILES=[
  '.github/training-center/build-three-env.mjs',
  '.github/rc1521/build-three-env.mjs',
  'assets/training-center/runtime.js',
  'assets/training-center/model.js',
  'assets/training-center/store.js',
  'assets/training-center/coverage.js',
  'assets/training-center/coverage-dashboard.js'
];
const LEGACY_RUNTIME_RX=/(?:\/assets\/sop\/|assets\/sop\/|ExportHubIsoSop|ExportHubSop(?:Catalog|Model|Ui|Coverage|Overlay|Visuals|Tour|Training)|rc1007-sop|rc1010-sop|rc1016-sop|rc1018-sop|rc150[0-9]-sop)/i;

function read(rel){return fs.readFileSync(path.join(ROOT,rel),'utf8');}

function walk(dir,out=[]){
  if(!fs.existsSync(dir))return out;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const abs=path.join(dir,entry.name);
    if(entry.isDirectory())walk(abs,out);else out.push(abs);
  }
  return out;
}

test('historischer SOPMaster-Quellbestand bleibt für unveränderte Regressionen erhalten, ist aber kein Training-Center-Release-Asset',()=>{
  assert.equal(fs.existsSync(LEGACY_DIR),true,'historische SOP-Verträge dürfen vor dem abgesicherten Cutover nicht verschwinden');
  const builder=read('.github/training-center/build-three-env.mjs');
  assert.match(builder,/removeRetiredSopTagsFromBuild/);
  assert.match(builder,/fs\\.rmSync\\(path\\.join\\(out,'assets','sop'\\)/);
});

test('aktive Training-Center- und Release-Dateien referenzieren keine Legacy-SOP-Runtime',()=>{
  for(const rel of ACTIVE_FILES){
    assert.ok(fs.existsSync(path.join(ROOT,rel)),`Aktive Datei fehlt: ${rel}`);
    assert.doesNotMatch(read(rel),LEGACY_RUNTIME_RX,`Legacy-SOP-Referenz in aktiver Datei: ${rel}`);
  }
});

test('neuer Runtime-Quellbaum enthält ausschließlich Training-Center-Code und keine alten SOPMaster-Assets',()=>{
  const files=walk(path.join(ROOT,'assets','training-center'));
  assert.ok(files.length>0,'Training-Center-Quellbaum fehlt');
  for(const file of files){
    if(!/\.(?:js|css|mjs|json)$/i.test(file))continue;
    const rel=path.relative(ROOT,file).replace(/\\/g,'/');
    assert.doesNotMatch(fs.readFileSync(file,'utf8'),LEGACY_RUNTIME_RX,`Legacy-SOP-Abhängigkeit in ${rel}`);
  }
});

test('neue SOP-Quelle enthält die freigegebenen ersten Inhalte unabhängig vom alten Katalog',()=>{
  assert.ok(fs.existsSync(path.join(ROOT,'assets/training-center/catalog/shipment-registration.js')));
  assert.ok(fs.existsSync(path.join(ROOT,'assets/training-center/catalog/dhl-express.js')));
  const shipment=read('assets/training-center/catalog/shipment-registration.js');
  const dhl=read('assets/training-center/catalog/dhl-express.js');
  assert.match(shipment,/Sendung in ExportHUB360 anmelden/);
  assert.match(dhl,/DHL Express/);
  assert.doesNotMatch(shipment,LEGACY_RUNTIME_RX);
  assert.doesNotMatch(dhl,LEGACY_RUNTIME_RX);
});
