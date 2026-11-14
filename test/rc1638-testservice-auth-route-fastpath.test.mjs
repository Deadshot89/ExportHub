import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ROUTES=[
  "api/pod-quality-audit/index.js",
  "api/packaging-admin/index.js",
  "api/pack-stations-admin/index.js",
  "api/customer-portal-credentials/index.js",
  "api/urgent-orders/index.js",
  "api/quality-capa/index.js",
  "api/shipment-documentation/index.js",
  "api/shipment-evidence/index.js",
  "api/avis-reminder-mail/index.js",
  "api/web-push/index.js",
  "api/exporthub-auth/index.js",
  "api/sop-documents/index.js"
];

test('RC1638: every remaining session-heavy API route delegates TESTSERVICE auth to the ETag fast path',()=>{
 for(const path of ROUTES){
  const source=fs.readFileSync(path,'utf8');
  assert.ok(source.includes("require('../shared/fast-auth-store')"),path+' must load the shared fast-auth adapter');
  assert.ok(source.includes('fastAuth.isSource(auth)'),path+' must preserve fallback for injected/mock auth stores');
  assert.ok(source.includes('fastAuth.validateSession'),path+' must use the ETag-verified session validator');
 }
});

test('RC1638: production authentication semantics remain owned by the existing fast-auth adapter',()=>{
 const fast=fs.readFileSync('api/shared/fast-auth-store.js','utf8');
 assert.ok(fast.includes('readSessionDocuments(c,testserviceRequest)'));
 assert.ok(fast.includes('if(verifiedTestservice){'));
 assert.ok(fast.includes('auth.readJson(c.team,auth.emptyTeam())'));
});
