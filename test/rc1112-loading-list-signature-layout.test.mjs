import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');

before(()=>{
  execFileSync(process.execPath,['.github/rc1048/build-three-env.mjs'],{stdio:'pipe'});
});

test('RC1112: Runtime rendert gespeicherte Fahrerunterschrift aus kompatiblen Pickup-Feldern',()=>{
  const js=read('dist-rc1048/assets/rc1096-packaging-groups.js');
  assert.match(js,/function rc1112LoadSignatureValue\(sh\)/,'Signaturauflösung fehlt');
  assert.match(js,/driverSignature\|pickupDriverSignature\|signatureDataUrl\|pickupSignature/,'kompatible Signaturfelder fehlen');
  assert.match(js,/rc1112-driver-signature/,'Signaturbild auf der Ladeliste fehlt');
  assert.match(js,/Unterschrift Fahrer/,'Fahrer-Signaturbeschriftung fehlt');
});

test('RC1112: Ladelisten-Fußbereich ist gegen Überlappung abgesichert',()=>{
  const js=read('dist-rc1048/assets/rc1096-packaging-groups.js');
  assert.match(js,/rc1112-loading-footer/,'stabiler Footer-Container fehlt');
  assert.match(js,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'Footer-Grid fehlt');
  assert.match(js,/break-inside:avoid/,'Druck-Überlappungsschutz fehlt');
  assert.match(js,/page-break-inside:avoid/,'Legacy-Druckschutz fehlt');
});

test('RC1112: Runtime wird in Produktion, TESTSERVICE und Demo ausgeliefert',()=>{
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read('dist-rc1048/'+file);
    assert.match(html,/exporthub-rc1096-packaging-groups/,file+': Runtime-Script fehlt');
  }
  const js=read('dist-rc1048/assets/rc1096-packaging-groups.js');
  assert.match(js,/ExportHUBRC1112LoadingList/);
});
