import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('RC1044 bleibt als reproduzierbarer Vorgänger vollständig baubar',()=>{
  execFileSync(process.execPath,['.github/rc1044/build-three-env.mjs'],{cwd:ROOT,stdio:'pipe'});
  for(const [file,environment] of [['index.html','production-candidate'],['TESTVERSION.html','testservice'],['demo.html','demo']]){
    const html=read('dist-rc1044/'+file);
    assert.match(html,new RegExp('ExportHUB RC1044 environment='+environment));
    assert.match(html,/version:'RC1044'/);
    assert.match(html,/assets\/rc1018-mail-language-standard\.js\?v=1018/);
  }
  assert.match(read('dist-rc1044/production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1044'/);
});

test('RC1044-Wrapper bleibt auf der stabilen RC1018-Buildbasis',()=>{
  const wrapper=read('.github/rc1044/build-three-env.mjs');
  assert.match(wrapper,/\.github\/rc1018\/build-three-env\.mjs/);
  assert.match(wrapper,/dist-rc1018/);
  assert.match(wrapper,/dist-rc1044/);
});

test('RC1044: Böllhof und BMP bleiben im Lieferavis gesperrt',()=>{
  const flow=read('assets/rc1015-lieferavis-mail-flow.js');
  assert.match(flow,/bmp:'Kunden-IT blockiert den Zugriff'/);
  assert.match(flow,/'böllhof':'Kein Lieferavis für diesen Kunden'/);
  assert.match(flow,/'böllhoff':'Kein Lieferavis für diesen Kunden'/);
  assert.match(flow,/boellhof:'Kein Lieferavis für diesen Kunden'/);
});
