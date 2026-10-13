import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readBuildContract,readLiveContract} from './helpers/rc1505-release-contract.mjs';

const probe=fs.readFileSync('production-version.js','utf8');
const match=probe.match(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC(\d+)'/);
assert.ok(match,'Autoritativer Produktions-RC fehlt');

test('RC1018 Kalenderbasis wird im aktuellen gemeinsamen Build in allen drei Umgebungen geprüft',()=>{
  const build=readBuildContract();
  for(const marker of ['assets/abholkalender.js?v=1012','assets/rc1012-abholkalender-runtime.js?v=1012'])assert.ok(build.includes(marker),marker+' fehlt im Buildvertrag');
  assert.match(build,/dist-rc1112\/assets\/abholkalender\.js/);
  assert.match(build,/dist-rc1112\/assets\/rc1012-abholkalender-runtime\.js/);
  assert.match(build,/const pages=\['dist-rc1112\/index\.html','dist-rc1112\/TESTVERSION\.html','dist-rc1112\/demo\.html'\]/);
});

test('RC1505 Production-Liveprüfung lädt die Kalenderassets aus Produktion und TESTSERVICE',()=>{
  const live=readLiveContract();
  assert.match(live,/for\(const base of \[PROD,TEST\]\)/);
  assert.match(live,/\/assets\/abholkalender\.js/);
  assert.match(live,/\/assets\/rc1012-abholkalender-runtime\.js/);
  assert.match(live,/calendarScalarText/);
  assert.match(live,/companyId/);
});
