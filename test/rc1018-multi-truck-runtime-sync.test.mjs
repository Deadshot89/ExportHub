import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function buildRc1018(){
  execFileSync(process.execPath,['.github/rc1018/build-three-env.mjs'],{stdio:'pipe'});
}

function html(file){
  return fs.readFileSync(`dist-rc1018/${file}`,'utf8');
}

function assertMultiTruckRuntime(source,file){
  for(const marker of [
    'function rc1017FitRows(',
    'function rc1017SyncSubShipments(',
    'function renderRc1017SubShipments(',
    'function rc1017ActivateSubShipmentQr(',
    'function rc1017SubShipmentDocumentShipment(',
    'rc1017-print-subshipment',
    'rc1017-qr-subshipment',
    'rc1017-stow-subshipment'
  ]) assert.ok(source.includes(marker),`${file}: Mehr-LKW-Laufzeitmarker fehlt: ${marker}`);
}

test('RC1018 baut die vollständige Mehr-LKW-Browserruntime identisch in Produktion TESTSERVICE und Demo',()=>{
  buildRc1018();
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    assertMultiTruckRuntime(html(file),file);
  }
});
