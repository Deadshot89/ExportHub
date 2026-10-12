import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function build(){
  execFileSync(process.execPath,['scripts/rc1462-pretest.mjs'],{stdio:'pipe'});
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
}

function qrSuccessBlock(html){
  const marker="one.status='Bereit zur Abholung';one.processStatus='Bereit zur Abholung'";
  const at=html.indexOf(marker);
  assert.ok(at>=0,'QR-Erfolgsstatus fehlt im Release-Build');
  const start=Math.max(0,html.lastIndexOf('function ',at));
  const next=html.indexOf('function ',at+marker.length);
  const end=next>at?next:Math.min(html.length,at+3500);
  return html.slice(start,end);
}

test('RC1498 RED: QR-Erfolg synchronisiert auch serverseitig persistierte Shared-Sendungen',()=>{
  build();
  for(const file of ['index.html','TESTVERSION.html']){
    const html=fs.readFileSync('dist-rc1112/'+file,'utf8');
    const block=qrSuccessBlock(html);
    assert.match(block,/salesSharedShipments/,file+': QR-Erfolg lässt salesSharedShipments sonst im Status Erstellt stehen');
    assert.match(block,/sharedShipments/,file+': QR-Erfolg lässt sharedShipments sonst im Status Erstellt stehen');
  }
});

test('RC1498 RED: QR-Erfolg muss die State-Wurzeln der Sendungsübersicht erreichen',()=>{
  build();
  for(const file of ['index.html','TESTVERSION.html']){
    const html=fs.readFileSync('dist-rc1112/'+file,'utf8');
    const block=qrSuccessBlock(html);
    assert.match(block,/ExportHUBClean\.state|rc1498/i,file+': QR-Erfolg erreicht ExportHUBClean.state der Sendungsübersicht nicht');
    assert.match(block,/appState|rc1498/i,file+': QR-Erfolg erreicht appState der Sendungsübersicht nicht');
  }
});
