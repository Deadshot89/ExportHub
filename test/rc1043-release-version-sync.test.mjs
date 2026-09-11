import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('RC1043: Produktion TESTSERVICE und Demo zeigen exakt denselben aktuellen Release',()=>{
  execFileSync(process.execPath,['.github/rc1043/build-three-env.mjs'],{cwd:ROOT,stdio:'pipe'});
  for(const [file,environment] of [['index.html','production-candidate'],['TESTVERSION.html','testservice'],['demo.html','demo']]){
    const html=read('dist-rc1043/'+file);
    assert.match(html,new RegExp('ExportHUB RC1043 environment='+environment));
    assert.match(html,/var BUILD=Object\.freeze\(\{version:'RC1043',cache:'1043',loginReturn:'[^']*v=1043[^']*'\}\);/);
    assert.match(html,/assets\/rc1018-mail-language-standard\.js\?v=1018/);
    assert.match(html,/assets\/rc1013-gate41-ui\.js\?v=1041/,'RC1041 Gate41-Korrektur muss in RC1043 erhalten bleiben');
  }
  assert.match(read('dist-rc1043/production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1043'/);
});

test('RC1043: Website Android und Paketmetadaten sind versionsgleich',()=>{
  assert.match(read('production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1043'/);
  assert.match(read('android-app/app/build.gradle.kts'),/versionCode\s*=\s*1043/);
  assert.match(read('android-app/app/build.gradle.kts'),/versionName\s*=\s*"1\.0-rc1043"/);
  assert.equal(JSON.parse(read('android-app/app-build-info.json')).releaseCandidate,'RC1043');
  assert.equal(JSON.parse(read('package.json')).version,'1.0.0-rc1043');
});
