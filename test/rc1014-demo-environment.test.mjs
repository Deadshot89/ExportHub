import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function read(path){return fs.readFileSync(path,'utf8');}

test('RC1014 Demo-Kern verwendet die isolierte Datenumgebung demo',()=>{
  execFileSync(process.execPath,['.github/rc1014/build-three-env.mjs'],{stdio:'pipe'});
  const demo=read('dist-rc1014/demo.html');
  assert.match(demo,/const DATA_ENVIRONMENT='demo';/,'Demo darf intern nicht als Produktion eingestuft werden.');
  assert.match(demo,/ExportHUB RC1014 environment=demo/);
});

test('RC1014 Demo-State meldet eine gültige API-Version',()=>{
  const bridge=read('dist-rc1014/assets/rc1014-demo-bridge.js');
  assert.match(bridge,/\/api\/exporthub-state/,'RC1014 Demo-Bridge muss den Fake-State vervollständigen.');
  assert.match(bridge,/serverVersion\s*(?:=|:)\s*['"]RC1014['"]/,'Demo-State muss die aktuelle API-Versionskennung liefern.');
});

test('RC1014 Demo-Fix ändert Produktion und TESTSERVICE nicht auf demo',()=>{
  const production=read('dist-rc1014/index.html');
  const testservice=read('dist-rc1014/TESTVERSION.html');
  assert.doesNotMatch(production,/const DATA_ENVIRONMENT='demo';/);
  assert.doesNotMatch(testservice,/const DATA_ENVIRONMENT='demo';/);
  assert.match(production,/ExportHUB RC1014 environment=production-candidate/);
  assert.match(testservice,/ExportHUB RC1014 environment=testservice/);
});
