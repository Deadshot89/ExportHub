import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1251 Security: Produktion und TESTSERVICE verbieten Einbettung in fremde Frames',()=>{
  for(const file of ['staticwebapp.config.json','staticwebapp.testservice.config.json']){
    const config=JSON.parse(read(file));
    assert.ok(config.globalHeaders,file+': globalHeaders fehlen');
    assert.equal(config.globalHeaders['Content-Security-Policy'],"frame-ancestors 'none'",file+': CSP frame-ancestors fehlt');
    assert.equal(config.globalHeaders['X-Frame-Options'],'DENY',file+': X-Frame-Options fehlt');
    assert.equal(config.globalHeaders['X-Content-Type-Options'],'nosniff',file+': nosniff muss erhalten bleiben');
  }
});

test('RC1088 Security: öffentliche Zugriffe bleiben tokengebunden und ohne Cache',()=>{
  const config=JSON.parse(read('staticwebapp.config.json'));
  for(const route of ['/pickup','/pickup.html','/customer-avis','/customer-avis.html']){
    const row=config.routes.find(r=>r.route===route);
    assert.ok(row,route+' fehlt');
    assert.match(String(row.headers&&row.headers['Cache-Control']||''),/no-store/);
    assert.equal(row.headers['Referrer-Policy'],'no-referrer');
    assert.equal(row.headers['X-Content-Type-Options'],'nosniff');
  }
  const access=read('api/shared/public-access-store.js');
  assert.match(access,/crypto\.timingSafeEqual/);
  assert.match(access,/function tokenValid\(token\)/);
  assert.match(access,/PUBLIC_ACCESS_SECRET_MISSING/);
  assert.match(access,/ENVIRONMENT_MISMATCH/);
  assert.match(access,/X-Robots-Tag':'noindex, nofollow, noarchive/);
  const auth=read('api/shared/auth-store.js');
  assert.match(auth,/PBKDF2_ITERATIONS/);
  assert.match(auth,/crypto\.timingSafeEqual/);
  assert.match(auth,/purpose: 'exporthub-session'/);
});

test('RC1088 Rechte: serverseitige Global-Admin-Prüfungen verwenden die gemeinsame User-Policy',()=>{
  const state=read('api/exporthub-state/index.js');
  const diagnostic=read('api/diagnostic-autofix/index.js');
  const loader=read('api/loader-pins-admin/index.js');
  const company=read('api/shared/company-context.js');
  const policy=read('api/shared/user-policy.js');
  assert.match(policy,/GLOBAL_ADMIN_ROLES = new Set\(\['global admin','global administrator','globaler administrator','globaler admin','administrator','admin','vollzugriff'\]\)/);
  assert.match(state,/const \{ isAdmin \} = require\('\.\.\/shared\/user-policy'\)/);
  assert.match(diagnostic,/const \{ isAdmin \} = require\('\.\.\/shared\/user-policy'\)/);
  assert.match(loader,/const \{ isAdmin \} = require\('\.\.\/shared\/user-policy'\)/);
  assert.match(company,/const \{ isAdmin: isGlobalAdmin \} = require\('\.\/user-policy'\)/);
  assert.doesNotMatch(state,/function isAdmin\(user\)/);
  assert.doesNotMatch(diagnostic,/function isAdmin\(user\)/);
  assert.doesNotMatch(loader,/function isGlobalAdmin\(user\)/);
});

test('RC1088 Accessibility: öffentliche Statusmeldungen und Pickup-Dialog sind assistiv nutzbar',()=>{
  for(const page of ['pickup.html','customer-avis.html','location.html','pod-notfall.html']){
    const html=read(page);
    const status=html.match(/<div id="status"[^>]*>/i);
    assert.ok(status,page+': Statusbereich fehlt');
    assert.match(status[0],/role="status"/);
    assert.match(status[0],/aria-live="polite"/);
    assert.match(status[0],/aria-atomic="true"/);
    assert.match(html,/:focus-visible|:focus-within/);
  }
  const pickup=read('pickup.html');
  assert.match(pickup,/id="signatureModal"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="signatureDialogTitle"/);
  assert.match(pickup,/id="signatureDialogTitle"/);
  assert.match(pickup,/alt="Erfasste Fahrerunterschrift"/);
});

test('RC1088 Responsive: öffentliche Kernseiten besitzen Viewport und mobile Layout-Regeln',()=>{
  for(const page of ['pickup.html','customer-avis.html','location.html','pod-notfall.html']){
    const html=read(page);
    assert.match(html,/<meta name="viewport"[^>]*width=device-width/i);
    assert.match(html,/@media\(max-width:/);
  }
  const mobile=read('assets/rc1016-mobile-navigation.js');
  assert.match(mobile,/\(max-width: 640px\)/);
  assert.match(mobile,/aria-expanded/);
  assert.match(mobile,/aria-label/);
});

test('RC1088 Security: Release-Pipeline besitzt getrennte Security- und Accessibility-Gates',()=>{
  const pkg=JSON.parse(read('package.json'));
  for(const name of ['test:contracts','test:security','test:accessibility','test:smoke','verify:release']) assert.ok(pkg.scripts[name],name+' fehlt');
  const workflow=read('.github/workflows/rc1002-main-contract.yml');
  assert.match(workflow,/RC1088 Security Gate/);
  assert.match(workflow,/npm run test:security/);
  assert.match(workflow,/RC1088 Accessibility & Responsive Gate/);
  assert.match(workflow,/npm run test:accessibility/);
  assert.match(workflow,/Gesamte Node-Regression/);
});
