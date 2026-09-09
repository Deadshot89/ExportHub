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

function shipmentController(source){
  const open=source.match(/<script\b[^>]*id=["']exporthub-rc373-shipment-controller["'][^>]*>/i);
  assert.ok(open,'kanonischer Sendungscontroller fehlt');
  const start=open.index,end=source.indexOf('</script>',start+open[0].length);
  assert.ok(end>start,'Sendungscontroller ist nicht geschlossen');
  return source.slice(start,end+'</script>'.length);
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
