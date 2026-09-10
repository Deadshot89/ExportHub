import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const workflow='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const testserviceWorkflow='.github/workflows/exporthub-testservice.yml';
const developmentWorkflow='.github/workflows/rc1018-development.yml';
const standardDeploy='.github/rc1018/apply-standard-deploy.mjs';

test('RC1018 ist der aktuelle gemeinsame Standarddeploy für Produktion TESTSERVICE und Demo',()=>{
  const flow=read(workflow);
  assert.match(read('production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1018'/);
  assert.match(flow,/ExportHUB RC1018 Drei-Umgebungen Deploy/);
  assert.match(flow,/node \.github\/rc1018\/build-three-env\.mjs/);
  assert.match(flow,/dist-rc1018\/index\.html/);
  assert.match(flow,/dist-rc1018\/TESTVERSION\.html/);
  assert.match(flow,/dist-rc1018\/demo\.html/);
  assert.match(flow,/Deploy ExportHUB production/);
  assert.match(flow,/Deploy ExportHUB TESTSERVICE/);
});

test('RC1021 Standarddeploy prüft die aktualisierte Mailruntime vor Veröffentlichung',()=>{
  const flow=read(workflow);
  assert.match(flow,/test\/rc1018-mail-language-standard\.test\.mjs/);
  assert.match(flow,/test\/rc1018-production-deploy\.test\.mjs/);
  assert.match(flow,/test\/rc1015-lieferavis-mail-flow\.test\.mjs/);
  assert.match(flow,/npm test/);
  assert.match(flow,/assets\/rc1018-mail-language-standard\.js\?v=1021/);
  assert.doesNotMatch(flow,/assets\/rc1018-mail-language-standard\.js\?v=1018/);
  assert.match(flow,/assets\/rc1018-public-language\.js\?v=1018/);
});

test('RC1021 Lieferavis-Cache-Key ist im Build und Live-Deployvertrag durchgängig',()=>{
  const flow=read(workflow),generator=read(standardDeploy);
  assert.match(flow,/assets\/rc1015-lieferavis-mail-flow\.js\?v=1021/,'Produktionsdeploy prüft noch den alten Lieferavis-Cache-Key.');
  assert.doesNotMatch(flow,/assets\/rc1015-lieferavis-mail-flow\.js\?v=1015/,'Produktionsdeploy darf den alten Lieferavis-Cache-Key nicht mehr erzwingen.');
  assert.match(generator,/assets\/rc1015-lieferavis-mail-flow\.js\?v=1021/,'Standard-Deploy-Generator kennt den neuen Lieferavis-Cache-Key nicht.');
});

test('RC1021 aktualisierte Mailruntime nutzt in allen aktiven Deploypfaden einen frischen Cache-Key',()=>{
  for(const file of [workflow,testserviceWorkflow,developmentWorkflow]){
    const flow=read(file);
    assert.match(flow,/assets\/rc1018-mail-language-standard\.js\?v=1021/,`${file}: neuer Mailruntime-Cache-Key fehlt.`);
    assert.doesNotMatch(flow,/assets\/rc1018-mail-language-standard\.js\?v=1018/,`${file}: alter Mailruntime-Cache-Key ist noch aktiv.`);
  }
  const generator=read(standardDeploy);
  assert.match(generator,/assets\/rc1018-mail-language-standard\.js\?v=1021/,'Standard-Deploy-Generator kennt den neuen Mailruntime-Cache-Key nicht.');
});

test('RC1018 Deploypakete enthalten öffentliche DE EN Seiten und beide neuen Laufzeitressourcen',()=>{
  const flow=read(workflow);
  assert.match(flow,/customer-avis\.html/);
  assert.match(flow,/pickup\.html/);
  assert.match(flow,/location\.html/);
  assert.match(flow,/rc1018-mail-language-standard\.js/);
  assert.match(flow,/rc1018-public-language\.js/);
  assert.match(flow,/\.rc1018_production_app/);
  assert.match(flow,/\.rc1018_testservice_app/);
});

test('RC1021 Liveprüfung bestätigt die aktualisierte Mailruntime in allen drei Oberflächen',()=>{
  const flow=read(workflow);
  assert.match(flow,/Live RC1018 Produktion TESTSERVICE und Demo prüfen/);
  assert.match(flow,/ExportHUB RC1018 environment=production-candidate/);
  assert.match(flow,/ExportHUB RC1018 environment=testservice/);
  assert.match(flow,/ExportHUB RC1018 environment=demo/);
  assert.match(flow,/version:'RC1018'/);
  assert.match(flow,/rc1018-mail-language-standard\.js\?v=1021/);
  assert.match(flow,/rc1018-public-language\.js/);
});