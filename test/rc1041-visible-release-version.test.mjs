import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();

test('RC1041: Produktion TESTSERVICE und Demo zeigen die aktuelle sichtbare Release-Version',()=>{
  execFileSync(process.execPath,['.github/rc1041/build-three-env.mjs'],{cwd:ROOT,stdio:'pipe'});
  for(const [file,environment] of [['index.html','production-candidate'],['TESTVERSION.html','testservice'],['demo.html','demo']]){
    const html=fs.readFileSync(path.join(ROOT,'dist-rc1041',file),'utf8');
    assert.match(html,new RegExp(`ExportHUB RC1041 environment=${environment}`),`${file}: sichtbarer Environment-Marker ist nicht RC1041`);
    assert.match(html,/var BUILD=Object\.freeze\(\{version:'RC1041',cache:'1041',loginReturn:'[^']*v=1041[^']*'\}\);/,`${file}: BUILD-Anzeige ist nicht RC1041`);
    assert.match(html,/assets\/rc1018-mail-language-standard\.js\?v=1018/,`${file}: historische RC1018-Runtime darf durch Versionsanzeige nicht umbenannt werden`);
  }
  const probe=fs.readFileSync(path.join(ROOT,'dist-rc1041','production-version.js'),'utf8');
  assert.match(probe,/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1041'/);
});
