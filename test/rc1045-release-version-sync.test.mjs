import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('RC1045: Produktion TESTSERVICE und Demo zeigen denselben aktuellen Release',()=>{
  execFileSync(process.execPath,['.github/rc1045/build-three-env.mjs'],{cwd:ROOT,stdio:'pipe'});
  for(const [file,environment] of [['index.html','production-candidate'],['TESTVERSION.html','testservice'],['demo.html','demo']]){
    const html=read('dist-rc1045/'+file);
    assert.match(html,new RegExp('ExportHUB RC1045 environment='+environment));
    assert.match(html,/var BUILD=Object\.freeze\(\{version:'RC1045',cache:'1045',loginReturn:'[^']*v=1045[^']*'\}\);/);
    assert.match(html,/assets\/rc1018-mail-language-standard\.js\?v=1018/);
  }
  assert.match(read('dist-rc1045/production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1045'/);
  const manifest=JSON.parse(read('dist-rc1045/rc1045-manifest.json'));
  assert.equal(manifest.compatibility.qr,'stable-qr-v1');
});

test('RC1045: Website Android und Paketmetadaten sind versionsgleich',()=>{
  assert.match(read('production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1045'/);
  assert.match(read('android-app/app/build.gradle.kts'),/versionCode\s*=\s*1045/);
  assert.match(read('android-app/app/build.gradle.kts'),/versionName\s*=\s*"1\.0-rc1045"/);
  assert.equal(JSON.parse(read('android-app/app-build-info.json')).releaseCandidate,'RC1045');
  assert.equal(JSON.parse(read('package.json')).version,'1.0.0-rc1045');
});

test('RC1045: QR-Bestandsschutz ist Bestandteil des Releasevertrags',()=>{
  const pickup=read('pickup.html'),access=read('api/shared/public-access-store.js');
  assert.match(pickup,/function legacyTokenLike/);
  assert.match(pickup,/searchParams\.get\('ehcmd'\)/);
  assert.match(access,/resourceKey/);
  assert.match(access,/legacyReissued/);
  assert.match(access,/tokenHashes/);
});
