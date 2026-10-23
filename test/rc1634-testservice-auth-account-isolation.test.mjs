import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {isolationConfig,accountName}=require('../api/shared/testservice-auth-isolation.js');
const prod='DefaultEndpointsProtocol=https;AccountName=realproduction;AccountKey=FAKE';
const testCs='DefaultEndpointsProtocol=https;AccountName=syntheticpilot;AccountKey=FAKE';
const flags={EXPORTHUB_STORAGE_CONNECTION_STRING:prod,EXPORTHUB_TEST_STORAGE_CONNECTION_STRING:testCs,EXPORTHUB_TEST_AUTH_ISOLATION:'enabled'};

test('RC1634: feature disabled by default; legacy auth never selects independent account',()=>{
 assert.deepEqual(isolationConfig({}),{enabled:false});
 assert.deepEqual(isolationConfig({EXPORTHUB_TEST_STORAGE_CONNECTION_STRING:testCs}),{enabled:false});
 assert.deepEqual(isolationConfig({EXPORTHUB_TEST_AUTH_ISOLATION:''}),{enabled:false});
});

test('RC1634: flag requires a different explicit test Azure storage account',()=>{
 assert.equal(accountName(prod),'realproduction');
 assert.equal(accountName(testCs),'syntheticpilot');
 const r=isolationConfig(flags);
 assert.deepEqual(r,{enabled:true,connectionString:testCs,container:'exporthub-data',authBlob:'testservice/auth-sessions.json'});
 const rejects=(env,code)=>assert.throws(()=>isolationConfig(env),e=>e?.code===code&&e.status===503);
 rejects({...flags,EXPORTHUB_TEST_STORAGE_CONNECTION_STRING:prod},'TEST_AUTH_ISOLATION_ACCOUNT_NOT_SEPARATE');
 rejects({...flags,EXPORTHUB_TEST_STORAGE_CONNECTION_STRING:'AccountName=realproduction;AccountKey=ROTATED_FAKE_KEY'},'TEST_AUTH_ISOLATION_ACCOUNT_NOT_SEPARATE');
 rejects({...flags,EXPORTHUB_TEST_STORAGE_CONNECTION_STRING:''},'TEST_AUTH_ISOLATION_ACCOUNT_NOT_SEPARATE');
 rejects({...flags,EXPORTHUB_TEST_STORAGE_CONNECTION_STRING:'UseDevelopmentStorage=true'},'TEST_AUTH_ISOLATION_ACCOUNT_NOT_SEPARATE');
 rejects({...flags,EXPORTHUB_STORAGE_CONNECTION_STRING:'',AzureWebJobsStorage:''},'TEST_AUTH_ISOLATION_ACCOUNT_NOT_SEPARATE');
 rejects({...flags,EXPORTHUB_TEST_AUTH_ISOLATION:'true'},'TEST_AUTH_ISOLATION_MODE_INVALID');
});

test('RC1634: test auth blob must remain under TESTSERVICE prefix',()=>{
 for(const name of ['auth-sessions.json','production/auth-sessions.json','testservice/../auth.json','testservice//auth.json','testservice/']){
  assert.throws(()=>isolationConfig({...flags,EXPORTHUB_TEST_AUTH_BLOB:name}),e=>e?.code==='TEST_AUTH_ISOLATION_PATH_INVALID');
 }
 assert.equal(isolationConfig({...flags,EXPORTHUB_TEST_AUTH_BLOB:'testservice/session-data.json'}).authBlob,'testservice/session-data.json');
 assert.equal(isolationConfig({...flags,EXPORTHUB_TEST_STORAGE_CONTAINER:'exporthub-testaccount'}).container,'exporthub-testaccount');
 assert.throws(()=>isolationConfig({...flags,EXPORTHUB_TEST_STORAGE_CONTAINER:'production/data'}),/TEST_AUTH_ISOLATION_PATH_INVALID/);
});

test('RC1634: login, password reset, session revocation and admin actions use the same scoped router',()=>{
 const src=fs.readFileSync('api/exporthub-auth/index.js','utf8');
 assert.match(src,/function scopedAuth\(req\)/);
 assert.match(src,/auth\.loginStorageEnvironment\(req\)/);
 assert.match(src,/mutateTeam:mutator=>auth\.mutateTeamForEnvironment\(environment,mutator\)/);
 assert.match(src,/mutateAuth:mutator=>auth\.mutateAuth\(mutator,environment\)/);
 assert.match(src,/createSession:\(user,deviceId,mustChange\)=>auth\.createSession\(user,deviceId,mustChange,environment\)/);
 assert.match(src,/revokeUserSessions:\(userId,reason,except\)=>auth\.revokeUserSessions\(userId,reason,except,environment\)/);
 assert.match(src,/const saved = await scopedAuth\(req\)\.mutateTeam\(/);
 assert.match(src,/const created = await scopedAuth\(req\)\.createSession\(/);
 assert.match(src,/await scopedAuth\(req\)\.mutateAuth\(/);
 assert.doesNotMatch(src,/await auth\.mutateTeam\(/);
 assert.doesNotMatch(src,/await auth\.mutateAuth\(/);
});

test('RC1634: new credentials are opt-in; production clients and normal token handling remain legacy',()=>{
 const src=fs.readFileSync('api/shared/auth-store.js','utf8');
 assert.match(src,/const isolated=isolationConfig\(\)/);
 assert.match(src,/isolated\.enabled\?isolated\.connectionString:connectionString\(\)/);
 assert.match(src,/isolated\.enabled\?isolated\.authBlob:AUTH_BLOB/);
 assert.match(src,/env==='testservice'&&isolationConfig\(\)\.enabled\?'testservice':'production'/);
 assert.match(src,/async function mutateAuth\(mutator, environment='production'\)/);
 assert.match(src,/async function createSession\(user, deviceId, mustChange, environment='production'\)/);
 assert.match(src,/const target=loginStorageEnvironment\(req\)/);
 const fast=fs.readFileSync('api/shared/fast-auth-store.js','utf8');
 assert.match(fast,/const c=isolated\?await auth\.testserviceClients\(\):await clients\(\)/);
 assert.match(fast,/if \(isSignedTestserviceE2E\(token\)\) return auth\.validateSession/);
});

test('RC1634: exporthub-state never seeds missing isolated TESTSERVICE by reading production',()=>{
 const src=fs.readFileSync('api/exporthub-state/index.js','utf8');
 assert.match(src,/environment==='testservice'\?isolationConfig\(\):\{enabled:false\}/);
 assert.match(src,/productionTeam:isTest\?null:container\.getBlockBlobClient\(TEAM_BLOB_BASE\)/);
 assert.match(src,/if\(!c\.productionTeam\)throw error\('TEST_STATE_IMPORT_REQUIRED'/);
 assert.match(src,/auth:container\.getBlockBlobClient\(isTest\?isolated\.authBlob:AUTH_BLOB\)/);
});
