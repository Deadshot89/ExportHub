import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1379: geänderte AVIS-Runtimes werden mit neuem Cache-Key ausgeliefert',()=>{
  const customerBuilder=read('.github/rc1048/build-three-env.mjs');
  const avisBuilder=read('.github/rc1013/build-three-env.mjs');
  const deployPatch=read('.github/rc1018/apply-standard-deploy.mjs');
  const workflow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');

  assert.match(customerBuilder,/rc1092-customer-mail-contacts\.js\?v=1380/);
  assert.match(avisBuilder,/rc1015-lieferavis-mail-flow\.js\?v=1379/);
  assert.match(deployPatch,/rc1015-lieferavis-mail-flow\.js\?v=1379/);
  assert.match(workflow,/rc1092-customer-mail-contacts\.js\?v=1380/);
  assert.match(workflow,/rc1015-lieferavis-mail-flow\.js\?v=1379/);

  for(const source of [customerBuilder,avisBuilder,deployPatch,workflow]){
    assert.doesNotMatch(source,/rc1092-customer-mail-contacts\.js\?v=1092/);
    assert.doesNotMatch(source,/rc1015-lieferavis-mail-flow\.js\?v=1304/);
  }
});
