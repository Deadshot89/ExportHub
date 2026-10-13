import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { verifyMainPrProvenance } from '../.github/rc1473/verify-main-pr-provenance.mjs';

await verifyMainPrProvenance();

const read=p=>fs.readFileSync(p,'utf8');
const mainWorkflow='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const productionWorkflow='.github/workflows/exporthub-production-release.yml';

test('RC1505 bewahrt RC1112 als gemeinsame Buildbasis, trennt aber Production vom main-Deploy',()=>{
  const flow=read(mainWorkflow),wrapper=read('.github/rc1112/build-three-env.mjs'),r1048=read('.github/rc1048/build-three-env.mjs'),r1047=read('.github/rc1047/build-three-env.mjs'),r1046=read('.github/rc1046/build-three-env.mjs'),r1045=read('.github/rc1045/build-three-env.mjs'),r1044=read('.github/rc1044/build-three-env.mjs');
  assert.match(read('production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1112'/);
  assert.match(flow,/name:\s*ExportHUB RC1112 Main Verification/);
  assert.match(flow,/node \.github\/rc1112\/build-three-env\.mjs/);
  assert.match(flow,/dist-rc1112\/index\.html/);
  assert.match(flow,/dist-rc1112\/TESTVERSION\.html/);
  assert.match(flow,/dist-rc1112\/demo\.html/);
  assert.match(wrapper,/\.github\/rc1048\/build-three-env\.mjs/);
  assert.match(wrapper,/dist-rc1048/);
  assert.match(r1048,/\.github\/rc1047\/build-three-env\.mjs/);
  assert.match(r1048,/dist-rc1047/);
  assert.match(r1047,/\.github\/rc1046\/build-three-env\.mjs/);
  assert.match(r1046,/\.github\/rc1045\/build-three-env\.mjs/);
  assert.match(r1045,/\.github\/rc1044\/build-three-env\.mjs/);
  assert.match(r1044,/\.github\/rc1018\/build-three-env\.mjs/);
  assert.match(flow,/Deploy ExportHUB TESTSERVICE/);
  assert.doesNotMatch(flow,/Deploy ExportHUB production/);
  assert.doesNotMatch(flow,/AZURE_STATIC_WEB_APPS_API_TOKEN_WONDERFUL_FOREST_0F315E310/);
});

test('RC1112 Main Verification bewahrt die RC1018 Mail- und Sprachruntime unverändert',()=>{
  const flow=read(mainWorkflow),contract=read('.github/rc1505/verify-build-contract.mjs');
  assert.match(flow,/test\/rc1018-mail-language-standard\.test\.mjs/);
  assert.match(flow,/test\/rc1018-production-deploy\.test\.mjs/);
  assert.match(flow,/test\/rc1015-lieferavis-mail-flow\.test\.mjs/);
  assert.match(flow,/npm test/);
  assert.match(flow,/assets\/rc1015-lieferavis-mail-flow\.js\?v=1383/);
  assert.match(flow,/assets\/rc1018-mail-language-standard\.js\?v=1018/);
  assert.match(flow,/node \.github\/rc1505\/verify-build-contract\.mjs/);
  assert.match(contract,/includes\('dist-rc1112\/pickup\.html','assets\/rc1018-public-language\.js\?v=1018'\)/);
  assert.match(contract,/includes\('dist-rc1112\/location\.html','assets\/rc1018-public-language\.js\?v=1018'\)/);
});

test('RC1519 Main Verification erzwingt die Public-Page-Sprachruntime nicht auf der internen index.html',()=>{
  const flow=read(mainWorkflow),contract=read('.github/rc1505/verify-build-contract.mjs');
  assert.doesNotMatch(flow,/grep -q 'assets\/rc1018-public-language\.js\?v=1018' dist-rc1112\/index\.html/);
  assert.match(flow,/node \.github\/rc1505\/verify-build-contract\.mjs/);
  assert.match(contract,/includes\('dist-rc1112\/pickup\.html','assets\/rc1018-public-language\.js\?v=1018'\)/);
  assert.match(contract,/includes\('dist-rc1112\/location\.html','assets\/rc1018-public-language\.js\?v=1018'\)/);
});

test('RC1505: Production verwendet denselben RC1112-Build über manuellen SHA-festen Release',()=>{
  assert.equal(fs.existsSync(productionWorkflow),true,'Production-Release-Workflow fehlt');
  const flow=read(productionWorkflow);
  assert.match(flow,/name:\s*ExportHUB Production Release/);
  assert.match(flow,/workflow_dispatch:/);
  assert.match(flow,/release_sha:/);
  assert.match(flow,/node \.github\/rc1112\/build-three-env\.mjs/);
  assert.match(flow,/\.rc1112_production_app/);
  assert.match(flow,/Deploy ExportHUB production/);
  assert.match(flow,/ExportHUB RC1112 environment=production-candidate/);
});
