import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');
const documentApi=fs.readFileSync('api/exporthub-document/index.js','utf8');
const overview=fs.readFileSync('assets/rc1165-pod-backup-status.js','utf8');
const viewer=fs.readFileSync('assets/rc1063-abd-blob-viewer-compat.js','utf8');
const staticConfig=fs.readFileSync('staticwebapp.config.json','utf8');

test('RC1461: alte POD-PDFs werden nach dem Layout-Fix nicht weiterverwendet',()=>{
  assert.match(archive,/POD_PDF_LAYOUT_VERSION\s*=\s*'RC1461-STRUCTURED-V2'/);
  assert.match(archive,/isCurrentAutomaticPod\(existing\)/);
  assert.match(documentApi,/podArchive\.getPodDownload\(pod\.accessKey,environment,''\)/);
  assert.match(documentApi,/X-ExportHUB-POD-Layout/);
});

test('RC1461: POD zeigt Fahrer, Kennzeichen, Verlader und Spedition kompakt in einer Zeile',()=>{
  assert.match(archive,/const metaW=\(width-18\)\/4/);
  assert.match(archive,/card\('Fahrer',[^\n]+x,y,metaW,51\)/);
  assert.match(archive,/card\('Kennzeichen',[^\n]+x\+metaW\+6,y,metaW,51\)/);
  assert.match(archive,/card\('Verlader',[^\n]+x\+2\*\(metaW\+6\),y,metaW,51\)/);
  assert.match(archive,/card\('Spedition',[^\n]+x\+3\*\(metaW\+6\),y,metaW,51\)/);
});

test('RC1461: Fahrerunterschrift bleibt klein und wird nie künstlich vergrößert',()=>{
  assert.match(archive,/maxH=36/);
  assert.match(archive,/if\(scale>1\)scale=1/);
  assert.doesNotMatch(archive,/maxH\s*=\s*150/);
  assert.doesNotMatch(archive,/maxW\s*=\s*width/);
});

test('RC1461: Sendungskachel bietet bei vorhandenem POD eine direkte POD-Öffnen-Aktion',()=>{
  assert.match(overview,/function podFileOf\(sh\)/);
  assert.match(overview,/data-rc1461-pod-open/);
  assert.match(overview,/POD öffnen/);
  assert.match(overview,/ExportHUBDocumentBlob1059/);
  assert.match(overview,/\.open\(file,\{name:/);
  assert.doesNotMatch(overview,/fetch\s*\(/);
});

test('RC1461: Dokumentpanel überspringt PODs nicht wegen vorhandener DOM-Zeilen',()=>{
  assert.match(viewer,/function rowMatchesDocument\(row,d\)/);
  assert.match(viewer,/list\.forEach\(function\(d,index\)/);
  assert.doesNotMatch(viewer,/for\(var i=rows\.length;i<list\.length;i\+\+\)/);
  assert.match(viewer,/data-rc1151-document-row/);
  assert.match(viewer,/subShipments\.podFiles/);
});

test('RC1461: kritische POD- und Pickup-Runtimes dürfen nicht mehr veraltet aus Cache kommen',()=>{
  for(const route of ['/assets/rc1165-pod-backup-status.js','/assets/rc1063-abd-blob-viewer-compat.js','/assets/rc1018-public-language.js']){
    assert.ok(staticConfig.includes('"route": "'+route+'"'),route+' fehlt');
  }
  assert.match(staticConfig,/no-store, no-cache, must-revalidate/);
});

test('RC1461: betroffene JavaScript-Dateien bleiben syntaktisch gültig',()=>{
  for(const file of ['api/shared/pod-archive.js','api/exporthub-document/index.js','assets/rc1165-pod-backup-status.js','assets/rc1063-abd-blob-viewer-compat.js']){
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(result.status,0,file+'\n'+(result.stderr||result.stdout));
  }
  JSON.parse(staticConfig);
});