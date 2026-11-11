import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The staff module is deliberately embedded, but the anonymous public
// reporting page must be a top-level navigation because it denies framing.
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('Urgent public-form link escapes the embedded staff iframe in the SAME tab',()=>{
 const staff=read('assets/urgent-orders.html');
 const nav=read('assets/pack-notification-nav.js');
 const link=staff.match(/<a\b[^>]*\bid="urgentPublicFormLink"[^>]*>/)?.[0];
 assert.ok(link,'public-form link must exist');
 assert.match(link,/\bhref="\/urgent-order"/);
 assert.match(link,/\btarget="_top"/,'navigate the current top-level tab, not the embedded frame');
 assert.doesNotMatch(link,/\btarget="_blank"/,'never open a new window');
 assert.match(staff,/urgentPublicFormLink'\)\.href=urgentPublicOrigin\(\)\+'\/urgent-order'/);
 assert.match(nav,/urgentorders:\{path:'\/assets\/urgent-orders\.html\?embedded=1'/);
 assert.doesNotMatch(nav,/frame\.setAttribute\('sandbox'/,'existing same-origin embed must remain unsandboxed');
});

test('anonymous Urgent public route keeps anti-framing policy in both deployments',()=>{
 for(const file of ['staticwebapp.config.json','staticwebapp.testservice.config.json']){
  const config=JSON.parse(read(file));
  const route=config.routes.find(x=>x.route==='/urgent-order');
  assert.ok(route,file+' public route');
  assert.equal(route.rewrite,'/assets/urgent-order-report.html');
  assert.deepEqual(route.allowedRoles,['anonymous']);
  assert.equal(config.globalHeaders['X-Frame-Options'],'DENY');
  assert.equal(config.globalHeaders['Content-Security-Policy'],"frame-ancestors 'none'");
 }
});
