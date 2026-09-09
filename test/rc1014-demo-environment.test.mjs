import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function read(path){return fs.readFileSync(path,'utf8');}
function build(){execFileSync(process.execPath,['.github/rc1016/build-three-env.mjs'],{stdio:'pipe'});}

test('RC1016 Demo-Kern verwendet die isolierte Datenumgebung demo',()=>{
  build();
  const demo=read('dist-rc1016/demo.html');
  assert.match(demo,/const DATA_ENVIRONMENT='demo';/,'Demo darf intern nicht als Produktion eingestuft werden.');
  assert.match(demo,/ExportHUB RC1016 environment=demo/);
});

test('RC1016 Demo-State meldet eine gültige API-Version',()=>{
  build();
  const bridge=read('dist-rc1016/assets/rc1014-demo-bridge.js');
  assert.match(bridge,/\/api\/exporthub-state/,'RC1016 Demo-Bridge muss den Fake-State vervollständigen.');
  assert.match(bridge,/serverVersion\s*(?:=|:)\s*['"]RC1016['"]/,'Demo-State muss die aktuelle API-Versionskennung liefern.');
});

test('RC1016 Demo-Fix ändert Produktion und TESTSERVICE nicht auf demo',()=>{
  build();
  const production=read('dist-rc1016/index.html');
  const testservice=read('dist-rc1016/TESTVERSION.html');
  assert.doesNotMatch(production,/const DATA_ENVIRONMENT='demo';/);
  assert.doesNotMatch(testservice,/const DATA_ENVIRONMENT='demo';/);
  assert.match(production,/ExportHUB RC1016 environment=production-candidate/);
  assert.match(testservice,/ExportHUB RC1016 environment=testservice/);
});
