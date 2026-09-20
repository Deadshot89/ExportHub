import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import store from '../api/shared/customer-portal-store.js';

const readinessApi=fs.readFileSync('api/customer-portal-readiness/index.js','utf8');
const credentialsApi=fs.readFileSync('api/customer-portal-credentials/index.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function restore(name,value){
  if(value===undefined)delete process.env[name];
  else process.env[name]=value;
}

test('RC1187: Kundenportal-Key ist erst ab exakt 32 Zeichen konfiguriert',()=>{
  const before=process.env.EXPORTHUB_CUSTOMER_PORTAL_KEY;
  try{
    process.env.EXPORTHUB_CUSTOMER_PORTAL_KEY='x'.repeat(31);
    assert.equal(store.keyConfigured(),false);
    process.env.EXPORTHUB_CUSTOMER_PORTAL_KEY='x'.repeat(32);
    assert.equal(store.keyConfigured(),true);
    process.env.EXPORTHUB_CUSTOMER_PORTAL_KEY='x'.repeat(64);
    assert.equal(store.keyConfigured(),true);
  } finally {
    restore('EXPORTHUB_CUSTOMER_PORTAL_KEY',before);
  }
});

test('RC1187: schwacher Key bleibt fail-closed in UI-Status und Release-Readiness',()=>{
  assert.match(credentialsApi,/configured:store\.keyConfigured\(\)/);
  assert.match(readinessApi,/configured=store\.keyConfigured\(\)/);
  assert.match(readinessApi,/CUSTOMER_PORTAL_NOT_CONFIGURED/);
});

test('RC1187: Secret-Wert wird weiterhin weder in Readiness noch Manifest ausgegeben',()=>{
  assert.doesNotMatch(readinessApi,/EXPORTHUB_CUSTOMER_PORTAL_KEY/);
  assert.doesNotMatch(readinessApi,/process\.env/);
  assert.match(build,/customerPortalKeyStrength:'RC1187 minimum 32 characters, fail-closed before portal use and production release'/);
});
