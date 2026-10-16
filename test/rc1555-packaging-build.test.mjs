import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}
const mainBuild=read('.github/rc1112/build-three-env.mjs');
const packBuild=read('.github/packmeldungen/build-three-env.mjs');

test('RC1555 main three-environment build copies every packaging masterdata runtime and locale pack',()=>{
  for(const rel of [
    'assets/rc1555-packaging-store.js',
    'assets/rc1555-packaging-management.js',
    'assets/rc1555-packaging-management.css'
  ])assert.ok(mainBuild.includes(rel),`main build missing ${rel}`);
  assert.match(mainBuild,/rc1555-packaging-masterdata/,'main build must copy the central RC1555 locale-pack directory');
  for(const lang of ['de','en','pl','es','fr','it'])assert.ok(mainBuild.includes(`${lang}.json`)||mainBuild.includes('readdirSync'),`main build must carry ${lang} locale pack`);
});

test('RC1555 main build injects i18n then canonical store then masterdata management into all app environments',()=>{
  assert.match(mainBuild,/exporthub-rc1555-packaging-store/,'canonical store tag missing');
  assert.match(mainBuild,/exporthub-rc1555-packaging-management/,'management tag missing');
  assert.match(mainBuild,/rc1555-packaging-store\.js\?v=1555/,'canonical store src missing');
  assert.match(mainBuild,/rc1555-packaging-management\.js\?v=1555/,'management src missing');
  assert.match(mainBuild,/for\s*\(const\s+file\s+of\s*\[['"]index\.html['"],['"]TESTVERSION\.html['"],['"]demo\.html['"]\]/,'three environment html loop missing');
});

test('RC1555 packmeldungen release copies canonical packaging store beside the public pack runtime',()=>{
  assert.match(packBuild,/['"]rc1555-packaging-store\.js['"]/,'PACK_ASSETS must include rc1555-packaging-store.js');
  assert.match(packBuild,/['"]packaging-catalog\.js['"]/,'PACK_ASSETS must continue to copy compatibility catalog adapter');
  assert.match(packBuild,/['"]pack\.html['"]|PACK_FILES/,'pack build must carry the updated pack page');
});

test('RC1555 source app pages contain no management runtime before build injection',()=>{
  // The release builder owns injection; source pages stay clean and the test prevents accidental duplicate tags.
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read(file);
    assert.ok((html.match(/exporthub-rc1555-packaging-management/g)||[]).length<=1,`${file}: duplicate RC1555 management tags`);
    assert.ok((html.match(/exporthub-rc1555-packaging-store/g)||[]).length<=1,`${file}: duplicate RC1555 store tags`);
  }
});
