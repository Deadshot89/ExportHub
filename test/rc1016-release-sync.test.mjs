import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=path=>fs.readFileSync(path,'utf8');

function build(){
  execFileSync(process.execPath,['.github/rc1016/build-three-env.mjs'],{stdio:'pipe'});
}

test('RC1016 baut Produktion TESTSERVICE und Demo auf demselben Versionsstand',()=>{
  build();
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read(`dist-rc1016/${file}`);
    assert.match(html,/RC1016/);
    assert.match(html,/assets\/rc1014-task-lifecycle\.js\?v=1016/);
    assert.match(html,/assets\/rc1014-task-runtime\.js\?v=1016/);
    assert.match(html,/assets\/rc1014-shipment-overview\.js\?v=1016/);
    assert.match(html,/assets\/rc1015-lieferavis-mail-flow\.js\?v=1015/,'RC1015 Lieferavis-Fix muss erhalten bleiben');
  }
});

test('RC1016 isoliert nur die Demo als demo-Datenumgebung',()=>{
  build();
  const production=read('dist-rc1016/index.html');
  const testservice=read('dist-rc1016/TESTVERSION.html');
  const demo=read('dist-rc1016/demo.html');
  assert.doesNotMatch(production,/const DATA_ENVIRONMENT='demo';/);
  assert.doesNotMatch(testservice,/const DATA_ENVIRONMENT='demo';/);
  assert.match(demo,/const DATA_ENVIRONMENT='demo';/);
  assert.match(production,/ExportHUB RC1016 environment=production-candidate/);
  assert.match(testservice,/ExportHUB RC1016 environment=testservice/);
  assert.match(demo,/ExportHUB RC1016 environment=demo/);
});

test('RC1016 Manifest dokumentiert RC1015 als erhaltene Releasebasis',()=>{
  build();
  const manifest=JSON.parse(read('dist-rc1016/rc1016-manifest.json'));
  assert.equal(manifest.version,'RC1016');
  assert.equal(manifest.sourceRelease,'RC1015');
  assert.equal(manifest.retainedFixes.lieferavis,'assets/rc1015-lieferavis-mail-flow.js');
  assert.deepEqual(manifest.environments,{production:'index.html',testservice:'TESTVERSION.html',demo:'demo.html'});
});
