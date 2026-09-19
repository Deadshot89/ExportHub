import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const hub=fs.readFileSync('assets/exporthub-environment-hub.js','utf8');
const rc1013=fs.readFileSync('.github/rc1013/build-three-env.mjs','utf8');
const rc1112=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1174: wiederholtes Diagnoseereignis derselben ID wird bei neuerem Zeitpunkt erneut gemeldet',()=>{
  assert.match(hub,/matchedAt>Number\(marker\.at\|\|0\)\?critical\.slice\(idx\):critical\.slice\(idx\+1\)/);
  assert.match(hub,/const at=String\(rec\.lastAt\|\|rec\.at\|\|''\)\.trim\(\)/);
  assert.match(hub,/Zeitpunkt:/);
});

test('RC1174: strukturierter Android-Diagnose-Push enthält ebenfalls den Ereigniszeitpunkt',()=>{
  assert.match(rc1013,/d\.time&&d\.time!==['"]—['"]/);
  assert.match(rc1013,/Zeitpunkt:/);
  assert.match(rc1013,/fallbackTime/);
});

test('RC1174: finaler Drei-Umgebungen-Build cache-bustet die Android-Diagnosebrücke',()=>{
  assert.match(rc1112,/exporthub-environment-hub\\\.js\\\?v=\\d\+/);
  assert.match(rc1112,/exporthub-environment-hub\.js\?v=1174/);
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=fs.readFileSync('dist-rc1112/'+file,'utf8');
    assert.match(html,/assets\/exporthub-environment-hub\.js\?v=1174/,file+' lädt nicht die aktuelle Android-Diagnosebrücke');
  }
  const built=fs.readFileSync('dist-rc1112/assets/exporthub-environment-hub.js','utf8');
  assert.match(built,/matchedAt>Number\(marker\.at\|\|0\)/);
  assert.match(built,/Zeitpunkt:/);
  assert.match(built,/ExportHUB Fehlerdiagnose/);
  assert.match(built,/ExportHUBAndroid\.notify/);
});

test('RC1174: geänderte Browser- und Build-Dateien bleiben syntaktisch gültig',()=>{
  for(const file of [
    'assets/exporthub-environment-hub.js',
    '.github/rc1013/build-three-env.mjs',
    '.github/rc1112/build-three-env.mjs',
    'e2e/specs/navigation.spec.mjs',
    'e2e/specs/shipment-create.spec.mjs'
  ])execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
});
