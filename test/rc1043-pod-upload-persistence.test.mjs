import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('.github/rc1043/build-three-env.mjs','utf8');

test('RC1043 POD-Upload darf nach bestätigter Abholung dauerhaft gespeichert werden',()=>{
  assert.match(src,/POD-Sicherung nach manuellem Upload synchronisiert/);
  assert.doesNotMatch(src,/kind==='pod'\?'POD':'ABD'\)\+' als PDF dauerhaft gespeichert'/);
});

test('RC1043 POD-Speicherung erzwingt Azure-Bestätigung mit ausreichendem Zeitfenster',()=>{
  assert.match(src,/deadline=Date\.now\(\)\+80000/);
  assert.match(src,/flushSave\(reason,\{force:true,userInitiated:true\}\)/);
});

test('RC1043 Drei-Umgebungen-Build patcht den POD-Pfad in jeder HTML-Variante',()=>{
  assert.match(src,/html=patchPodUploadPersistence\(html,file\)/);
  assert.match(src,/for\(const file of \['index\.html','TESTVERSION\.html','demo\.html'\]\)patchHtml\(file\)/);
  assert.match(src,/replaceOne\(html,oldFlush,newFlush,file\+' Speicherbestätigung'\)/);
  assert.match(src,/replaceOne\(out,oldReason,newReason,file\+' POD-Sperrausnahme'\)/);
});
