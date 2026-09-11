import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('RC1043 bleibt als reproduzierbarer Vorgänger vollständig baubar',()=>{
  execFileSync(process.execPath,['.github/rc1043/build-three-env.mjs'],{cwd:ROOT,stdio:'pipe'});
  for(const [file,environment] of [['index.html','production-candidate'],['TESTVERSION.html','testservice'],['demo.html','demo']]){
    const html=read('dist-rc1043/'+file);
    assert.match(html,new RegExp('ExportHUB RC1043 environment='+environment));
    assert.match(html,/version:'RC1043'/);
    assert.match(html,/assets\/rc1018-mail-language-standard\.js\?v=1018/);
    assert.match(html,/assets\/rc1013-gate41-ui\.js\?v=1041/);
  }
  assert.match(read('dist-rc1043/production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1043'/);
});

test('RC1043-Wrapper bleibt auf der stabilen RC1018-Buildbasis',()=>{
  const wrapper=read('.github/rc1043/build-three-env.mjs');
  assert.match(wrapper,/\.github\/rc1018\/build-three-env\.mjs/);
  assert.match(wrapper,/dist-rc1018/);
  assert.match(wrapper,/dist-rc1043/);
});
