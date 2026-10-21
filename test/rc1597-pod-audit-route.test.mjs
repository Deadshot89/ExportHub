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

test('RC1598: reject an unauthenticated 401 without POD handler evidence',async()=>{
 const {verifyEvidence}=await import('../.github/rc1598/verify-pod-audit-route.mjs');
 assert.equal(verifyEvidence({postStatus:401,postBody:null,optionsStatus:404,unknownOptionsStatus:404}).ok,false);
 assert.equal(verifyEvidence({postStatus:404,postBody:null,optionsStatus:204,optionsAllow:'POST, OPTIONS',unknownOptionsStatus:404}).ok,false);
 assert.equal(verifyEvidence({postStatus:200,postBody:{ok:true},optionsStatus:204,optionsAllow:'POST, OPTIONS',unknownOptionsStatus:404}).ok,false);
});

test('RC1598: authenticated handler response is accepted and negative control is enforced for Azure gateway 401',async()=>{
 const {verifyEvidence}=await import('../.github/rc1598/verify-pod-audit-route.mjs');
 assert.equal(verifyEvidence({postStatus:401,postBody:{ok:false,code:'AUTH_REQUIRED'},optionsStatus:404,unknownOptionsStatus:404}).ok,true);
 assert.equal(verifyEvidence({postStatus:401,postBody:null,optionsStatus:204,optionsAllow:'POST, OPTIONS',unknownOptionsStatus:404}).ok,true);
 assert.equal(verifyEvidence({postStatus:401,postBody:null,optionsStatus:204,optionsAllow:'POST, OPTIONS',unknownOptionsStatus:401}).ok,false);
 assert.equal(verifyEvidence({postStatus:401,postBody:null,optionsStatus:204,optionsAllow:'GET',unknownOptionsStatus:404}).ok,false);
});

test('RC1598: shared live probe is identical for TESTSERVICE and PRODUCTION and includes negative control',()=>{
 const main=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
 const prod=fs.readFileSync('.github/workflows/exporthub-production-release.yml','utf8');
 for(const [env,workflow] of [['testservice',main],['production',prod]]){
  assert.match(workflow,new RegExp('node \\.github/rc1598/verify-pod-audit-route\\.mjs '+env));
 }
 const helper=fs.readFileSync('.github/rc1598/verify-pod-audit-route.mjs','utf8');
 assert.match(helper,/rc1598-pod-quality-audit-unbound-control/);
 assert.match(helper,/POD_AUDIT_ROUTE_MISSING/);
 assert.match(helper,/postStatus===401/);
});
