import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readBuildContract} from './helpers/rc1505-release-contract.mjs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1383: geänderte AVIS-Runtimes werden mit neuem Cache-Key ausgeliefert',()=>{
  const customerBuilder=read('.github/rc1048/build-three-env.mjs');
  const avisBuilder=read('.github/rc1013/build-three-env.mjs');
  const deployPatch=read('.github/rc1018/apply-standard-deploy.mjs');
  const releaseBuild=readBuildContract();

  assert.match(customerBuilder,/rc1092-customer-mail-contacts\.js\?v=1399/);
  assert.match(avisBuilder,/rc1015-lieferavis-mail-flow\.js\?v=1383/);
  assert.match(deployPatch,/rc1015-lieferavis-mail-flow\.js\?v=1383/);
  assert.match(releaseBuild,/rc1092-customer-mail-contacts\.js\?v=1600/);
  assert.match(releaseBuild,/rc1015-lieferavis-mail-flow\.js\?v=1383/);

  for(const source of [customerBuilder,avisBuilder,deployPatch,releaseBuild]){
    assert.doesNotMatch(source,/rc1092-customer-mail-contacts\.js\?v=1092/);
    assert.doesNotMatch(source,/rc1015-lieferavis-mail-flow\.js\?v=1304/);
  }
});
