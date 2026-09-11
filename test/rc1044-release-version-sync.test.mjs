import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('RC1044: Produktion TESTSERVICE und Demo zeigen denselben aktuellen Release',()=>{
  execFileSync(process.execPath,['.github/rc1044/build-three-env.mjs'],{cwd:ROOT,stdio:'pipe'});
  for(const [file,environment] of [['index.html','production-candidate'],['TESTVERSION.html','testservice'],['demo.html','demo']]){
    const html=read('dist-rc1044/'+file);
    assert.match(html,new RegExp('ExportHUB RC1044 environment='+environment));
    assert.match(html,/var BUILD=Object\.freeze\(\{version:'RC1044',cache:'1044',loginReturn:'[^']*v=1044[^']*'\}\);/);
    assert.match(html,/Paletten – Gate41 Deutschland/,'Gate41 Deutschland muss sichtbar sein');
    assert.match(html,/Nicht verfügbar/,'Gate41 Ausland muss sichtbar gesperrt sein');
    assert.match(html,/assets\/rc1018-mail-language-standard\.js\?v=1018/);
  }
  assert.match(read('dist-rc1044/production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1044'/);
});

test('RC1044: Website Android und Paketmetadaten sind versionsgleich',()=>{
  assert.match(read('production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1044'/);
  assert.match(read('android-app/app/build.gradle.kts'),/versionCode\s*=\s*1044/);
  assert.match(read('android-app/app/build.gradle.kts'),/versionName\s*=\s*"1\.0-rc1044"/);
  assert.equal(JSON.parse(read('android-app/app-build-info.json')).releaseCandidate,'RC1044');
  assert.equal(JSON.parse(read('package.json')).version,'1.0.0-rc1044');
});

test('RC1044: Böllhof und BMP bleiben im Lieferavis gesperrt',()=>{
  const flow=read('assets/rc1015-lieferavis-mail-flow.js');
  assert.match(flow,/bmp:'Kunden-IT blockiert den Zugriff'/);
  assert.match(flow,/'böllhof':'Kein Lieferavis für diesen Kunden'/);
  assert.match(flow,/'böllhoff':'Kein Lieferavis für diesen Kunden'/);
  assert.match(flow,/boellhof:'Kein Lieferavis für diesen Kunden'/);
});
