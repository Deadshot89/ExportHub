import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const OLD='wonderful-forest-0f315e310-testservice.centralus.7.azurestaticapps.net';
const CURRENT='ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';

test('RC1152: finaler TESTSERVICE und Umgebungswechsel verwenden ausschließlich den aktuellen Testserver',()=>{
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});

  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=fs.readFileSync('dist-rc1112/'+file,'utf8');

    assert.doesNotMatch(
      html,
      new RegExp(OLD.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&')),
      file+' darf keinen aktiven Verweis auf den stillgelegten TESTSERVICE enthalten.'
    );

    assert.match(
      html,
      new RegExp(CURRENT.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&')),
      file+' muss den aktuellen TESTSERVICE für Login-/Release-Wechsel enthalten.'
    );
  }
});
