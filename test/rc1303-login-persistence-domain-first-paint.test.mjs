import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync('assets/rc1074-login-clean.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1303: Produktionswechsel führt auf die öffentliche ExportHUB360-Domain',()=>{
  assert.match(runtime,/RC1303_PRODUCTION_URL='https:\/\/www\.exporthub360\.de\/'/);
  assert.match(runtime,/target==='testservice'\?hub\.testserviceUrl:RC1303_PRODUCTION_URL/);
  assert.match(build,/PUBLIC_PRODUCTION_HOST='www\.exporthub360\.de'/);
  assert.match(build,/PUBLIC_PRODUCTION_ORIGIN='https:\/\/www\.exporthub360\.de'/);
  assert.match(build,/productionUrl:PROD_ORIGIN\+'\/'/);
  assert.match(build,/function prodUrl\(\)\{return PROD_ORIGIN\+'\/\?entry=login'\}/);
});

test('RC1303: Login hat den finalen kompakten Stil bereits vor dem ersten Paint',()=>{
  assert.match(build,/exporthub-rc1303-login-first-paint/);
  assert.match(build,/#login \.clean-version-badge,#login \.eh-login-mode-head,#login \.eh-login-environment-note\{display:none!important\}/);
  assert.match(build,/patchRc1303LoginExperience\(html,file\)/);
  assert.match(build,/file==='index\.html'[\s\S]*ehLoginProduction[\s\S]*aria-pressed="true"/);
  assert.match(build,/file==='TESTVERSION\.html'[\s\S]*ehLoginTestservice[\s\S]*aria-pressed="true"/);
});

test('RC1303: gespeicherte Browser-Credentials werden bei aktiviertem Merken aktiv wieder angeboten',()=>{
  assert.match(build,/navigator\.credentials\.get\(\{password:true,mediation:'optional'\}\)/);
  assert.match(build,/navigator\.credentials\.get\(\{password:true,mediation:'required'\}\)/);
  assert.match(build,/RC1303 Passwortmanager-Fallback fehlt/);
});

test('RC1303: Login-Runtime wird cache-frisch ausgeliefert',()=>{
  assert.match(build,/rc1074-login-clean\.js\?v=1303/);
  assert.match(workflow,/rc1074-login-clean\.js\?v=1303/);
});
