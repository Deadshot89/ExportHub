import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const DEPLOY_PATH='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';

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

function scriptById(source,id){
  const escaped=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const open=new RegExp(`<script\\b[^>]*id=["']${escaped}["'][^>]*>`,'i').exec(source);
  assert.ok(open,`${id}: Scriptblock fehlt`);
  const start=open.index,end=source.indexOf('</script>',start+open[0].length);
  assert.ok(end>start,`${id}: Scriptblock ist nicht geschlossen`);
  return source.slice(start,end+'</script>'.length);
}

function shipmentController(source){
  return scriptById(source,'exporthub-rc373-shipment-controller');
}

test('RC1018 baut die vollständige Mehr-LKW-Browserruntime identisch in Produktion TESTSERVICE und Demo',()=>{
  buildRc1018();
  const production=html('index.html');
  const canonical=shipmentController(production);
  assertMultiTruckRuntime(production,'index.html');
  for(const file of ['TESTVERSION.html','demo.html']){
    const source=html(file);
    assertMultiTruckRuntime(source,file);
    assert.equal(shipmentController(source),canonical,`${file}: Sendungscontroller weicht von Produktion ab`);
  }
});

test('RC1018 stellt die Mehr-LKW-Synchronisierung dem RC565-Speichercontroller über die Script-Grenze bereit',()=>{
  buildRc1018();
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const source=html(file),controller=shipmentController(source),saveRuntime=scriptById(source,'rc565-end-to-end-function-core');
    assert.match(controller,/window\.rc1017SyncSubShipments\s*=\s*rc1017SyncSubShipments\s*;/,`${file}: RC373 exportiert rc1017SyncSubShipments nicht global`);
    assert.match(saveRuntime,/window\.rc1017SyncSubShipments\(saved\);/,`${file}: RC565 ruft die Mehr-LKW-Synchronisierung nicht über window auf`);
    assert.doesNotMatch(saveRuntime,/(^|[^.\w])rc1017SyncSubShipments\(saved\);/,`${file}: RC565 enthält weiterhin den nicht sichtbaren privaten Funktionsaufruf`);
  }
});

test('RC1018 Liveprüfung bestätigt die Mehr-LKW-Browserintegration in Produktion TESTSERVICE und Demo',()=>{
  const deploy=fs.readFileSync(DEPLOY_PATH,'utf8');
  for(const target of ['$p','$t','$d']){
    for(const marker of ['function rc1017SyncSubShipments(','rc1017-qr-subshipment','rc1017-print-subshipment']){
      const escaped=marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const variable=target.replace('$','\\$');
      assert.match(deploy,new RegExp(`grep -q ['"]${escaped}['"] ["']${variable}["']`),`Liveprüfung fehlt für ${target}: ${marker}`);
    }
  }
});
