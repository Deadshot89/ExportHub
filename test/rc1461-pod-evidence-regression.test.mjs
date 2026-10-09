import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');
const overview=fs.readFileSync('assets/rc1165-pod-backup-status.js','utf8');
const viewer=fs.readFileSync('assets/rc1063-abd-blob-viewer-compat.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1461: alte POD-PDFs werden nach dem Layout-Fix nicht weiterverwendet',()=>{
  assert.match(archive,/POD_PDF_LAYOUT_VERSION\s*=\s*'RC1461-STRUCTURED-V2'/);
  assert.match(archive,/isCurrentAutomaticPod\(existing\)/);
});

test('RC1461: POD zeigt Fahrer, Kennzeichen, Verlader und Spedition kompakt in einer Zeile',()=>{
  assert.match(archive,/const metaW=\(width-18\)\/4/);
  assert.match(archive,/card\('Fahrer',[^\n]+x,y,metaW,51\)/);
  assert.match(archive,/card\('Kennzeichen',[^\n]+x\+metaW\+6,y,metaW,51\)/);
  assert.match(archive,/card\('Verlader',[^\n]+x\+2\*\(metaW\+6\),y,metaW,51\)/);
  assert.match(archive,/card\('Spedition',[^\n]+x\+3\*\(metaW\+6\),y,metaW,51\)/);
});

test('RC1461: Fahrerunterschrift bleibt klein und kann den POD nicht mehr dominieren',()=>{
  assert.match(archive,/maxH=36/);
  assert.doesNotMatch(archive,/maxH\s*=\s*150/);
  assert.doesNotMatch(archive,/maxW\s*=\s*width/);
});

test('RC1461: Sendungskachel bietet bei vorhandenem POD eine direkte POD-Öffnen-Aktion',()=>{
  assert.match(overview,/function podFileOf\(sh\)/);
  assert.match(overview,/data-rc1461-pod-open/);
  assert.match(overview,/POD öffnen/);
  assert.match(overview,/ExportHUBDocumentBlob1059/);
  assert.match(overview,/\.open\(file,\{name:/);
});

test('RC1461: Dokumentpanel überspringt PODs nicht wegen vorhandener DOM-Zeilen',()=>{
  assert.match(viewer,/function rowMatchesDocument\(row,d\)/);
  assert.match(viewer,/list\.forEach\(function\(d,index\)/);
  assert.doesNotMatch(viewer,/for\(var i=rows\.length;i<list\.length;i\+\+\)/);
  assert.match(viewer,/data-rc1151-document-row/);
});

test('RC1461: geänderte POD-Runtimes werden mit neuem Cache-Key ausgeliefert',()=>{
  assert.match(build,/rc1165-pod-backup-status\.js\?v=1461/);
  assert.match(build,/rc1063-abd-blob-viewer-compat\.js\?v=1461/);
});

test('RC1461: betroffene JavaScript-Dateien bleiben syntaktisch gültig',()=>{
  for(const file of ['api/shared/pod-archive.js','assets/rc1165-pod-backup-status.js','assets/rc1063-abd-blob-viewer-compat.js','.github/rc1112/build-three-env.mjs']){
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(result.status,0,file+'\n'+(result.stderr||result.stdout));
  }
});
