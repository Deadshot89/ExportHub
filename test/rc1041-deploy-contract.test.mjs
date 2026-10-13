import test from 'node:test';
import assert from 'node:assert/strict';
import {readBuildContract,readLiveContract} from './helpers/rc1505-release-contract.mjs';

test('RC1041 Buildvertrag prüft den aktuellen Gate41-Runtime-Cache in allen drei Umgebungen',()=>{
  const build=readBuildContract();
  assert.match(build,/assets\/rc1013-gate41-ui\.js\?v=1385/);
  assert.doesNotMatch(build,/rc1013-gate41-ui\.js\?v=1013/);
  assert.match(build,/const pages=\['dist-rc1112\/index\.html','dist-rc1112\/TESTVERSION\.html','dist-rc1112\/demo\.html'\]/);
});

test('RC1041 Production-Liveprüfung erwartet den i18n-Vertrag der nationalen Gate41-Erfolgsmeldung',()=>{
  const live=readLiveContract();
  assert.match(live,/RC1041 Gate41/);
  assert.match(live,/gate41\.calculated/);
  assert.match(live,/for\(const base of \[PROD,TEST\]\)/);
});
