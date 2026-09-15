import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');

before(()=>{
  execFileSync(process.execPath,['.github/rc1048/build-three-env.mjs'],{stdio:'pipe'});
});

test('RC1112: Ladeliste rendert gespeicherte Fahrerunterschrift aus kompatiblen Pickup-Feldern',()=>{
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read('dist-rc1048/'+file);
    assert.match(html,/function rc1112LoadSignatureValue\(sh\)/,file+': Signaturauflösung fehlt');
    assert.match(html,/driverSignature\|pickupDriverSignature\|signatureDataUrl\|pickupSignature/,file+': kompatible Signaturfelder fehlen');
    assert.match(html,/rc1112-driver-signature/,file+': Signaturbild auf der Ladeliste fehlt');
    assert.match(html,/Unterschrift Fahrer/,file+': Fahrer-Signaturbeschriftung fehlt');
  }
});

test('RC1112: Ladelisten-Fußbereich ist gegen Überlappung abgesichert',()=>{
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read('dist-rc1048/'+file);
    assert.match(html,/rc1112-loading-footer/,file+': stabiler Footer-Container fehlt');
    assert.match(html,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,file+': Footer-Grid fehlt');
    assert.match(html,/break-inside:avoid/,file+': Druck-Überlappungsschutz fehlt');
  }
});

test('RC1112: Signaturwert invalidiert den Ladelisten-Dokumentcache',()=>{
  const html=read('dist-rc1048/index.html');
  const start=html.indexOf('function documentCacheKey');
  const end=start<0?-1:html.indexOf('function ',start+'function documentCacheKey'.length);
  assert.ok(start>=0&&end>start,'documentCacheKey fehlt');
  assert.match(html.slice(start,end),/String\(rc1112LoadSignatureValue\(sh\)\)/);
});
