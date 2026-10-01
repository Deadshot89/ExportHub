import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const api=fs.readFileSync('api/customer-avis/index.js','utf8');
const page=fs.readFileSync('customer-avis.html','utf8');
const config=JSON.parse(fs.readFileSync('staticwebapp.config.json','utf8'));
const reminder=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');
const flow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1360: production issues canonical ExportHUB360 AVIS links',()=>{
  assert.match(api,/https:\/\/exporthub360\.com/);
  assert.match(api,/function publicAvisUrl\(/);
  assert.match(api,/PRODUCTION_AVIS_ORIGIN\+'\/avis\/'\+encoded/);
  assert.match(api,/url:publicAvisUrl\(env,issued\.token\)/);
});

test('RC1326: branded AVIS path is routed to the existing secure customer portal',()=>{
  const route=config.routes.find(r=>r.route==='/avis/*');
  assert.ok(route,'/avis/* route missing');
  assert.equal(route.rewrite,'/customer-avis.html');
  assert.equal(route.allowedRoles?.[0],'anonymous');
  assert.ok(config.navigationFallback.exclude.includes('/avis/*'));
  assert.ok(config.routes.some(r=>r.route==='/customer-avis.html'),'legacy customer-avis route must remain');
});

test('RC1326: customer portal accepts token from /avis/<token> without breaking query links',()=>{
  assert.match(page,/pathname/);
  assert.ok(page.includes("pathMatch=String(u.pathname||'').match(/\\/avis\\/([^/?#]+)\\/?$/i)"));
  assert.match(page,/searchParams\.get\('token'\)/);
  assert.match(page,/searchParams\.get\('avis'\)/);
  assert.match(page,/pathToken/);
});

test('RC1326: reminder validation allows branded production and legacy production URLs',()=>{
  assert.match(reminder,/exporthub360\.com/);
  assert.match(reminder,/LEGACY_PRODUCTION_PUBLIC_HOST/);
  assert.match(reminder,/brandedPath/);
  assert.match(reminder,/legacyPath/);
});


test('RC1365: Production-AVIS-Route bleibt fail-closed, externe Marken-Domain-DNS ist separater Blocker',()=>{
  const start=flow.indexOf('- name: RC1363 AVIS und Drucklayout live verifizieren');
  const end=flow.indexOf('\n      - name:',start+1);
  assert.ok(start>=0&&end>start,'RC1363/RC1365 Live-Gate fehlt');
  const block=flow.slice(start,end);
  assert.ok(block.includes('$prod/avis/RC1363TEST?rc1365='),'Production-/avis/-Route wird nicht hart geprüft');
  assert.match(block,/productionAvisRoute=\$oc/);
  assert.match(block,/branded_ready=0/);
  assert.match(block,/RC1365 ExportHUB360 DNS\/Custom-Domain/);
  assert.match(block,/DNS\/Custom-Domain bleibt als separater externer P1-Blocker offen/);
  const coreIfStart=block.indexOf('if [[ "$mc"');
  const coreIfEnd=block.indexOf('; then',coreIfStart);
  assert.ok(coreIfStart>=0&&coreIfEnd>coreIfStart,'RC1365 Core-Gate konnte nicht isoliert werden');
  assert.doesNotMatch(block.slice(coreIfStart,coreIfEnd),/\$bc/,'Externe Marken-Domain darf den Software-Core-Gate nicht blockieren');
});
