import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT='api';
function routeFor(name){
 const config=JSON.parse(fs.readFileSync(path.join(ROOT,name,'function.json'),'utf8'));
 const triggers=config.bindings.filter(binding=>binding.type==='httpTrigger');
 assert.equal(triggers.length,1,name+' muss genau einen HTTP-Trigger besitzen');
 const trigger=triggers[0];
 return{route:trigger.route||name,methods:trigger.methods||[]};
}

test('RC1597 P0: POD audit is exposed under /api/pod-quality-audit, not packaging-admin',()=>{
 const pod=routeFor('pod-quality-audit');
 const packaging=routeFor('packaging-admin');
 assert.equal(pod.route,'pod-quality-audit');
 assert.notEqual(pod.route,packaging.route,'POD-Audit und Verpackungsadmin duerfen nie dieselbe Azure Route verwenden');
 assert.ok(pod.methods.includes('post'),'POD Audit accepts POST');
 assert.ok(pod.methods.includes('options'),'CORS OPTIONS is supported');
 const ui=fs.readFileSync('assets/rc1577-pod-quality-audit.js','utf8');
 assert.match(ui,/ENDPOINT='\/api\/pod-quality-audit'/,'POD UI and Azure function must use the same route');
 const api=fs.readFileSync('api/pod-quality-audit/index.js','utf8');
 assert.match(api,/auth\.validateSession\(req\)/,'The POD endpoint must remain authenticated');
 assert.match(api,/auth\.isAdmin\(current\.user\)/,'POD audit remains admin-only');
});

test('RC1597 P0: testservice and production release block an unbound POD audit route',()=>{
 const main=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
 const prod=fs.readFileSync('.github/workflows/exporthub-production-release.yml','utf8');
 for(const [env,workflow] of [['testservice',main],['production',prod]]){
  assert.match(workflow,/RC1597 POD-Audit-API Live-Routing/,'Missing '+env+' POD route smoke');
  assert.match(workflow,/\/api\/pod-quality-audit/,'Missing '+env+' POD route smoke URL');
  assert.match(workflow,/response\.status|\$status|http_code/,'Missing HTTP code test '+env);
  assert.match(workflow,/POD_AUDIT_ROUTE_MISSING|POD_AUDIT_ROUTE_FAILURE/,'Missing route-specific failure '+env);
 }
});
