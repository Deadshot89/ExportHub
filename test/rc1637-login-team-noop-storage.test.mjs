import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import Module from 'node:module';
import path from 'node:path';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
function withMockStore(){
 const primary='DefaultEndpointsProtocol=https;AccountName=syntheticstorage;EndpointSuffix=core.windows.net';
 const writes=[],values=new Map(),key=(container,name)=>container+'/'+name;
 const original=Module._load,target=path.resolve('api/shared/auth-store.js');
 const blob=(container,name)=>({
  name,
  async download(){
   const raw=values.get(key(container,name));
   if(raw===undefined)throw Object.assign(new Error('missing'),{statusCode:404});
   return{etag:'"e1"',readableStreamBody:[Buffer.from(raw)]};
  },
  async upload(raw,length,options){
   assert.equal(length,Buffer.byteLength(raw));
   assert.ok(options.conditions.ifNoneMatch==='*'||options.conditions.ifMatch);
   writes.push({container,name,bytes:length});
   values.set(key(container,name),raw);
   return{etag:'"e2"'};
  }
 });
 const sdk={BlobServiceClient:{fromConnectionString(cs){
  assert.equal(cs,primary);
  return {getContainerClient(container){
    return {getBlockBlobClient(name){return blob(container,name)}};
  }};
 }}};
 const before=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
 const beforeMode=process.env.EXPORTHUB_TEST_AUTH_ISOLATION;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=primary;
 delete process.env.EXPORTHUB_TEST_AUTH_ISOLATION;
 Module._load=function(name,parent,isMain){
  if(name==='@azure/storage-blob')return sdk;
  return original.call(this,name,parent,isMain);
 };
 delete require.cache[require.resolve(target)];
 let auth;
 try{auth=require(target)}
 finally{Module._load=original}
 values.set('exporthub-data/team-state.json',JSON.stringify({
  schemaVersion:3,revision:17,users:[],state:{auditLog:[]},
  authBootstrap:{completedAt:'2026-10-01T00:00:00Z'}
 }));
 return{auth,writes,values,dispose(){
  delete require.cache[require.resolve(target)];
  if(before===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=before;
  if(beforeMode===undefined)delete process.env.EXPORTHUB_TEST_AUTH_ISOLATION;
  else process.env.EXPORTHUB_TEST_AUTH_ISOLATION=beforeMode;
 }};
}
test('RC1637: unknown/disabled login denials never write or generate Blob versions',async()=>{
 const h=withMockStore();
 try{
  const before=h.values.get('exporthub-data/team-state.json');
  const missing=await h.auth.mutateTeamForEnvironment('production',()=>({
   ok:false,code:'INVALID_CREDENTIALS',status:401,skipTeamWrite:true
  }));
  const disabled=await h.auth.mutateTeamForEnvironment('production',()=>({
   ok:false,code:'ACCOUNT_DISABLED',status:403,skipTeamWrite:true
  }));
  assert.equal(missing.skippedWrite,true);
  assert.equal(disabled.skippedWrite,true);
  assert.equal(h.writes.length,0);
  assert.equal(h.values.get('exporthub-data/team-state.json'),before);
  assert.equal(missing.team.revision,17);
 }finally{h.dispose()}
});
test('RC1637: real password failure, lockout and any unapproved marker still persist',async()=>{
 const h=withMockStore();
 try{
  const badPassword=await h.auth.mutateTeamForEnvironment('production',team=>{
   team.users.push({id:'test-locked',loginSecurity:{failedAttempts:1,stage:'first'}});
   team.state.auditLog.push({type:'LOGIN_FAILED',at:'2026-10-23T08:00:00Z'});
   return {ok:false,code:'INVALID_CREDENTIALS',status:401};
  });
  assert.equal(badPassword.skippedWrite,undefined);
  assert.equal(h.writes.length,1);
  const invalidBypass=await h.auth.mutateTeamForEnvironment('production',team=>{
   team.state.auditLog.push({type:'LOGIN_FAILED',at:'2026-10-23T08:00:01Z'});
   return {ok:false,code:'ACCOUNT_LOCKED_TEMPORARY',status:423,skipTeamWrite:true};
  });
  assert.equal(invalidBypass.skippedWrite,undefined);
  assert.equal(h.writes.length,2);
  const realSuccess=await h.auth.mutateTeamForEnvironment('production',team=>{
   team.state.auditLog.push({type:'LOGIN_SUCCESS'});
   return {ok:true,skipTeamWrite:true};
  });
  assert.equal(realSuccess.skippedWrite,undefined);
  assert.equal(h.writes.length,3);
 }finally{h.dispose()}
});
test('RC1637: endpoint sets read-only bypass for exactly two immutable denials',()=>{
 const src=readFileSync('api/exporthub-auth/index.js','utf8');
 const login=src.slice(src.indexOf('async function login('),src.indexOf('async function bootstrapStatus('));
 assert.ok(login.includes("code: 'INVALID_CREDENTIALS'"));
 assert.match(login,/if \(!user\) return \{[^\n]+skipTeamWrite: true \};/);
 assert.match(login,/if \(!auth\.isActive\(user\)\) return \{[^\n]+skipTeamWrite: true \};/);
 assert.equal((login.match(/skipTeamWrite: true/g)||[]).length,2);
 assert.match(login,/security\.failedAttempts = Number\(security\.failedAttempts \|\| 0\) \+ 1/);
 assert.match(login,/auth\.addAudit\(team, 'LOGIN_FAILED'/);
 assert.match(login,/auth\.addAudit\(team, 'LOGIN_SUCCESS'/);
 const store=readFileSync('api/shared/auth-store.js','utf8');
 assert.match(store,/result\.skipTeamWrite === true && result\.ok === false/);
 assert.match(store,/\(result\.code === 'INVALID_CREDENTIALS' \|\| result\.code === 'ACCOUNT_DISABLED'\)/);
});
