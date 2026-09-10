import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();

test('RC1024: geschützter Lieferavis-Mailflow lädt vor der unveränderten Sprachruntime in allen drei Umgebungen',()=>{
  execFileSync(process.execPath,['.github/rc1018/build-three-env.mjs'],{cwd:ROOT,stdio:'pipe'});
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=fs.readFileSync(path.join(ROOT,'dist-rc1018',file),'utf8');
    const guard=html.indexOf('assets/rc1015-lieferavis-mail-flow.js?v=1021');
    const language=html.indexOf('assets/rc1018-mail-language-standard.js?v=1018');
    assert.ok(guard>=0,`${file}: geschützter Lieferavis-Flow fehlt.`);
    assert.ok(language>=0,`${file}: Sprachruntime fehlt.`);
    assert.ok(guard<language,`${file}: die alte Mailruntime würde vor dem Vorlagenschutz geladen.`);
  }
});

test('RC1024: verworfene RC1021-Vollformatierung ist nicht mehr Teil der Mail-Sprachruntime',()=>{
  const language=fs.readFileSync('assets/rc1018-mail-language-standard.js','utf8');
  assert.match(language,/var VERSION='RC1018'/);
  assert.doesNotMatch(language,/mailSourceCache|syncVisibleAfterRefresh/);
  const flow=fs.readFileSync('assets/rc1015-lieferavis-mail-flow.js','utf8');
  assert.match(flow,/rc1024ReplaceSystemSlot/);
  assert.match(flow,/__rc1018:true/);
});
