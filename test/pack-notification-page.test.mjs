import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}

test('public qr pack page is standalone and has no ExportHUB login/navigation shell',()=>{
  const html=read('pack.html');
  assert.match(html,/id="packForm"/);
  assert.match(html,/id="packCustomer"/);
  assert.match(html,/id="packDeliveryNote"/);
  assert.match(html,/id="packPackageCount"/);
  assert.match(html,/id="packWeight"/);
  assert.match(html,/id="packDocuments"[^>]*multiple/);
  assert.match(html,/id="packSubmit"/);
  assert.doesNotMatch(html,/id="login"|ehLoginProduction|sidebar|main-navigation/i);
});

test('pack client creates one fresh session per page instance and locks logical submit',()=>{
  const js=read('assets/pack-notification.js');
  assert.match(js,/crypto\.randomUUID/);
  assert.match(js,/api\('session'/);
  assert.match(js,/api\('submit'/);
  assert.match(js,/sessionId/);
  assert.match(js,/submitLocked/);
  assert.match(js,/FileReader/);
  assert.match(js,/documents/);
});

test('pack page supports responsive package rows and confirmation state',()=>{
  const js=read('assets/pack-notification.js');
  const css=read('assets/pack-notification.css');
  assert.match(js,/renderPackages/);
  assert.match(js,/packPackageRows/);
  assert.match(js,/packSuccess/);
  assert.match(css,/@media\s*\(max-width:\s*640px\)/);
  assert.match(css,/\.pack-package-grid/);
  assert.match(css,/overflow-wrap/);
});

test('static web app routes /pack/* to public pack.html and excludes it from SPA fallback',()=>{
  const config=JSON.parse(read('staticwebapp.config.json'));
  const route=config.routes.find(r=>r.route==='/pack/*');
  assert.ok(route);
  assert.equal(route.rewrite,'/pack.html');
  assert.ok(Array.isArray(route.allowedRoles)&&route.allowedRoles.includes('anonymous'));
  assert.ok(config.navigationFallback.exclude.includes('/pack/*'));
  assert.ok(config.navigationFallback.exclude.includes('/pack.html'));
});
