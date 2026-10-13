import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const main='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const production='.github/workflows/exporthub-production-release.yml';
const testservice='.github/workflows/exporthub-testservice.yml';

for(const [label,file] of [['Main Verification',main],['Production Release',production],['TESTSERVICE Ausnahme',testservice]]){
  test(`RC1521 ${label} verwendet den finalen Kombinations-Builder`,()=>{
    const src=read(file);
    assert.match(src,/node \.github\/rc1018\/apply-public-language\.mjs/);
    assert.match(src,/node \.github\/rc1018\/fix-mail-wording\.mjs/);
    assert.match(src,/node \.github\/rc1521\/build-three-env\.mjs/);
  });
}

test('RC1521 Production baut Packmeldungen nicht ein zweites Mal und bleibt manuell SHA-fest',()=>{
  const src=read(production);
  const buildBlock=src.slice(src.indexOf('RC1112 Production-Kandidat'),src.indexOf('RC1112 Production-Paket'));
  assert.doesNotMatch(buildBlock,/node \.github\/packmeldungen\/build-three-env\.mjs/);
  assert.match(src,/release_sha:/);
  assert.match(src,/PRODUCTION FREIGEBEN/);
  assert.match(src,/git merge-base --is-ancestor "\$RELEASE_SHA" origin\/main/);
});

test('RC1521 Main Verification bleibt TESTSERVICE-only und Production bleibt getrennt',()=>{
  const src=read(main);
  assert.match(src,/Deploy ExportHUB TESTSERVICE/);
  assert.doesNotMatch(src,/Deploy ExportHUB production/);
  assert.doesNotMatch(src,/AZURE_STATIC_WEB_APPS_API_TOKEN_WONDERFUL_FOREST_0F315E310/);
});

test('RC1521 TESTSERVICE-Einzeldeploy behält die ausdrückliche Divergenzfreigabe',()=>{
  const src=read(testservice);
  assert.match(src,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(src,/Deploy TESTSERVICE explicit only/);
});
