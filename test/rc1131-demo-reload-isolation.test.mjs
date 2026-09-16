import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function read(path){return fs.readFileSync(path,'utf8')}

test('RC1131: Fake-Demo bleibt auf demo.html und wird nicht zum TESTSERVICE-Routenanker',()=>{
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  const demo=read('dist-rc1112/demo.html');
  const testservice=read('dist-rc1112/TESTVERSION.html');

  assert.match(demo,/exporthub-rc1013-demo-bootstrap/,'Demo-Bootstrap fehlt');
  assert.match(demo,/namedTest=\/-testservice\\\.\/i\.test\(h\)&&window\.__EXPORTHUB_DEMO_MODE__!==true/,'Testservice-Origin berücksichtigt Demo nicht');
  assert.match(demo,/if\(window\.__EXPORTHUB_DEMO_MODE__===true\)return;/,'Testportal-Runtime läuft noch in der Fake-Demo');
  assert.match(demo,/window\.__EXPORTHUB_DEMO_MODE__===true\|\|window\.__EXPORTHUB_PICKUP_MODE__/,'Routenanker schützt Demo nicht');

  const bootstrap=demo.indexOf('exporthub-rc1013-demo-bootstrap');
  const originGuard=demo.indexOf('namedTest=/-testservice\\./i.test(h)&&window.__EXPORTHUB_DEMO_MODE__!==true;');
  assert.ok(bootstrap>=0&&originGuard>bootstrap,'Demo-Modus muss vor der Testservice-Origin-Erkennung aktiv sein');

  assert.doesNotMatch(testservice,/namedTest=\/-testservice\\\.\/i\.test\(h\)&&window\.__EXPORTHUB_DEMO_MODE__!==true/,'TESTVERSION darf nicht als Demo behandelt werden');
  assert.doesNotMatch(testservice,/if\(window\.__EXPORTHUB_DEMO_MODE__===true\)return;/,'TESTVERSION-Testportal darf nicht deaktiviert werden');
});
