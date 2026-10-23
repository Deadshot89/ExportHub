import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module,{createRequire} from 'node:module';
import path from 'node:path';

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

test('RC1634: real auth-store routing never writes TESTSERVICE session into production when opt-in enabled',async()=>{
 const keys=['EXPORTHUB_TEST_AUTH_ISOLATION','EXPORTHUB_TEST_STORAGE_CONNECTION_STRING',
  'EXPORTHUB_STORAGE_CONNECTION_STRING','EXPORTHUB_STORAGE_CONTAINER',
  'EXPORTHUB_TEST_STORAGE_CONTAINER','EXPORTHUB_TEST_AUTH_BLOB'];
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const writes=[],contents=new Map();
 const blob=(connection,container,name)=>{
  const key=connection+'|'+container+'|'+name;
  return{
   name,
   async download(){
    if(!contents.has(key))throw Object.assign(new Error('missing'),{statusCode:404});
    return{etag:'"v1"',readableStreamBody:[Buffer.from(contents.get(key))]};
   },
   async upload(raw,bytes,opts){
    assert.equal(bytes,Buffer.byteLength(raw));
    assert.ok(opts.conditions.ifNoneMatch==='*'||opts.conditions.ifMatch);
    writes.push({connection,container,name,bytes});
    contents.set(key,raw);
    return{etag:'"v1"'};
   }
  };
 };
 const fakeSDK={BlobServiceClient:{
  fromConnectionString(connection){
   return{getContainerClient(container){
    return{getBlockBlobClient(name){return blob(connection,container,name)}};
   }};
  }
 }};
 const authPath=path.resolve('api/shared/auth-store.js'),original=Module._load;
 try{
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=prod;
  process.env.EXPORTHUB_TEST_STORAGE_CONNECTION_STRING=testCs;
  process.env.EXPORTHUB_TEST_AUTH_ISOLATION='enabled';
  process.env.EXPORTHUB_STORAGE_CONTAINER='exporthub-data';
  delete process.env.EXPORTHUB_TEST_AUTH_BLOB;
  Module._load=function(name,parent,isMain){
   if(name==='@azure/storage-blob')return fakeSDK;
   return original.call(this,name,parent,isMain);
  };
  delete require.cache[require.resolve(authPath)];
  const auth=require(authPath);
  Module._load=original;
  assert.equal(auth.loginStorageEnvironment({headers:{host:'www.exporthub360.com'}}),'production');
  assert.equal(auth.loginStorageEnvironment({headers:{host:'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'}}),'testservice');
  assert.equal(auth.loginStorageEnvironment({headers:{host:'localhost:7071','x-exporthub-environment':'testservice'}}),'testservice');
  await assert.rejects(
   async()=>auth.loginStorageEnvironment({headers:{host:'www.exporthub360.com','x-exporthub-environment':'testservice'}}),
   e=>e?.code==='ENVIRONMENT_MISMATCH'
  );
  const testClient=await auth.testserviceClients();
  assert.equal(testClient.auth.name,'testservice/auth-sessions.json');
  assert.equal(testClient.team.name,'testservice/team-state.json');
  const result=await auth.mutateAuth(a=>{
   a.sessions.push({id:'isolated-s1',expiresAt:'2099-01-01T00:00:00Z'});
   return 'updated';
  },'testservice');
  assert.equal(result.result,'updated');
  assert.equal(writes.length,1);
  assert.equal(writes[0].connection,testCs);
  assert.equal(writes[0].name,'testservice/auth-sessions.json');
  await auth.mutateAuth(a=>{
   a.sessions.push({id:'prod-s1',expiresAt:'2099-01-01T00:00:00Z'});
   return true;
  });
  assert.equal(writes.length,2);
  assert.equal(writes[1].connection,prod);
  assert.equal(writes[1].name,'auth-sessions.json');
  assert.doesNotMatch(contents.get(prod+'|exporthub-data|auth-sessions.json'),/isolated-s1/);
  assert.doesNotMatch(contents.get(testCs+'|exporthub-data|testservice\/auth-sessions.json'),/prod-s1/);
 }finally{
  Module._load=original;
  delete require.cache[require.resolve(authPath)];
  for(const k of keys){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];}
 }
});
