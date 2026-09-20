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

test('RC1194: Kundenportal-Key unterscheidet sicher zwischen fehlend, zu kurz und bereit',()=>{
  const before=process.env.EXPORTHUB_CUSTOMER_PORTAL_KEY;
  try{
    delete process.env.EXPORTHUB_CUSTOMER_PORTAL_KEY;
    assert.deepEqual(store.keyStatus(),{configured:false,code:'CUSTOMER_PORTAL_KEY_MISSING'});
    process.env.EXPORTHUB_CUSTOMER_PORTAL_KEY='x'.repeat(31);
    assert.deepEqual(store.keyStatus(),{configured:false,code:'CUSTOMER_PORTAL_KEY_TOO_SHORT'});
    assert.equal(store.keyConfigured(),false);
    process.env.EXPORTHUB_CUSTOMER_PORTAL_KEY='x'.repeat(32);
    assert.deepEqual(store.keyStatus(),{configured:true,code:null});
    assert.equal(store.keyConfigured(),true);
    process.env.EXPORTHUB_CUSTOMER_PORTAL_KEY='x'.repeat(64);
    assert.equal(store.keyConfigured(),true);
  } finally {
    restore('EXPORTHUB_CUSTOMER_PORTAL_KEY',before);
  }
});

test('RC1187: schwacher Key bleibt fail-closed in UI-Status und Release-Readiness',()=>{
  assert.match(credentialsApi,/configured:store\.keyConfigured\(\)/);
  assert.match(readinessApi,/keyStatus=typeof store\.keyStatus/);
  assert.match(readinessApi,/CUSTOMER_PORTAL_NOT_CONFIGURED/);
});

test('RC1187: Secret-Wert wird weiterhin weder in Readiness noch Manifest ausgegeben',()=>{
  assert.doesNotMatch(readinessApi,/EXPORTHUB_CUSTOMER_PORTAL_KEY/);
  assert.doesNotMatch(readinessApi,/process\.env/);
  assert.match(build,/customerPortalKeyStrength:'RC1187 minimum 32 characters, fail-closed before portal use and production release'/);
});


test('RC1194: Readiness meldet nur sicheren Fehlergrund und nie Secret oder exakte Länge',()=>{
  assert.match(readinessApi,/keyStatus=typeof store\.keyStatus/);
  assert.match(readinessApi,/code:keyStatus\.code/);
  assert.doesNotMatch(readinessApi,/process\.env/);
  assert.doesNotMatch(readinessApi,/EXPORTHUB_CUSTOMER_PORTAL_KEY/);
  assert.doesNotMatch(readinessApi,/keyLength|secretLength|configuredLength/);
  assert.match(readinessApi,/version:'RC1194'/);
});
