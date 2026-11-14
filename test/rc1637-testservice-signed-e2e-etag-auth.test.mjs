import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import path from 'node:path';

const require=createRequire(import.meta.url);
function loadFast(auth){
 const absolute=path.resolve('api/shared/fast-auth-store.js'),old=Module._load;
 Module._load=function(name,parent,isMain){
  if(name==='../shared/auth-store')return auth;
  return old.call(this,name,parent,isMain);
 };
 delete require.cache[require.resolve(absolute)];
 try{return require(absolute);}finally{Module._load=old;}
}
function fixture(){
 const primary={auth:0,team:0,head:0},testservice={auth:0,team:0,head:0};
 const state={testEtag:'test-v1',testActive:true,testRevoked:false,failTestHead:false,failTestTeamRead:false};
 const primaryAuth={name:'primary-auth'},testAuth={name:'testservice-auth'};
 const primaryTeam={
  name:'primary-team',
  async getProperties(){primary.head++;return{etag:'primary-v1'};}
 };
 const testTeam={
  name:'testservice-team',
  async getProperties(){
   testservice.head++;
   if(state.failTestHead)throw Error('TESTSERVICE_HEAD_FAILED');
   return{etag:state.testEtag};
  }
 };
 const primaryClients={auth:primaryAuth,team:primaryTeam};
 const testserviceClients={auth:testAuth,team:testTeam};
 let testserviceClientCalls=0;
 const auth={
  bearer(req){return req?.headers?.authorization==='Bearer signed-e2e-token'?'signed-e2e-token':'regular-token';},
  async clients(){return primaryClients;},
  async testserviceClients(){testserviceClientCalls++;return testserviceClients;},
  async readJson(blob){
   if(blob===primaryAuth){
    primary.auth++;
    return{etag:'primary-auth-'+primary.auth,value:{sessions:[{id:'S1',revokedAt:null}]}};
   }
   if(blob===testAuth){
    testservice.auth++;
    return{etag:'test-auth-'+testservice.auth,value:{sessions:[{id:'E2E-S1',revokedAt:state.testRevoked?'2026-11-14T10:00:00Z':null}]}};
   }
   if(blob===primaryTeam){
    primary.team++;
    return{etag:'primary-v1',value:{users:[{id:'U1',user:'tester',name:'Tester',active:true,authVersion:0,rights:{shipment:{level:'view'}}}]}};
   }
   if(blob===testTeam){
    testservice.team++;
    if(state.failTestTeamRead)throw Error('FULL_TESTSERVICE_READ_FAILED');
    return{etag:state.testEtag,value:{users:[{id:'E2E-USER-1',user:'e2e.user',name:'E2E User',active:state.testActive,authVersion:0,rights:{shipment:{level:'view'}}}]}};
   }
   throw Error('UNEXPECTED_BLOB');
  },
  emptyAuth(){return{sessions:[]};},
  emptyTeam(){return{users:[]};},
  resolveSession(token,doc){
   const signed=token==='signed-e2e-token';
   return{source:signed?'signed':'blob',session:{
    id:signed?'E2E-S1':'S1',userId:signed?'E2E-USER-1':'U1',
    username:signed?'e2e.user':'tester',expiresAt:'2099-01-01T00:00:00Z',
    authVersion:0,mustChange:false,
    revokedAt:signed?(doc.sessions?.[0]?.revokedAt||null):null
   }};
  },
  verifySignedSessionToken(token){
   return token==='signed-e2e-token'?{environment:'testservice',uid:'E2E-USER-1',username:'e2e.user'}:null;
  },
  applyUserPolicy(value){return value;},
  usernameOf(user){return String(user?.user||'').toLowerCase();},
  isActive(user){return Boolean(user&&user.active!==false);},
  lower(value){return String(value||'').toLowerCase();},
  text(value){return String(value==null?'':value).trim();},
  error(code,message,status){return Object.assign(new Error(message),{code,status});},
  environmentFromRequest(req){return req.headers?.['x-exporthub-environment']==='testservice'?'testservice':'production';},
  loginStorageEnvironment(){return'production';}
 };
 const fast=loadFast(auth);
 return{
  fast,state,primary,testservice,
  primaryCounts:primary,testserviceCounts:testservice,
  testserviceClientCalls:()=>testserviceClientCalls,
  signedReq:{headers:{authorization:'Bearer signed-e2e-token','x-exporthub-environment':'testservice'}},
  legacyTestReq:{headers:{'x-exporthub-environment':'testservice'}},
  prodReq:{headers:{}}
 };
}

test('RC1637: signed TESTSERVICE E2E auth reuses only an unchanged ETag and keeps auth fresh',async()=>{
 const f=fixture();
 const first=await f.fast.validateSession(f.signedReq);
 const second=await f.fast.validateSession(f.signedReq);
 assert.equal(first.user.id,'E2E-USER-1');
 assert.equal(second.user.id,'E2E-USER-1');
 assert.deepEqual(f.testserviceCounts,{auth:2,team:1,head:1});
 assert.equal(f.testserviceClientCalls(),1);
});

test('RC1637: signed E2E ETag change reloads team state and denies disabled users',async()=>{
 const f=fixture();
 await f.fast.validateSession(f.signedReq);
 f.state.testEtag='test-v2';
 f.state.testActive=false;
 await assert.rejects(()=>f.fast.validateSession(f.signedReq),e=>e.code==='ACCOUNT_DISABLED');
 assert.deepEqual(f.testserviceCounts,{auth:2,team:2,head:1});
});

test('RC1637: signed E2E session revocation is checked against a fresh auth read',async()=>{
 const f=fixture();
 await f.fast.validateSession(f.signedReq);
 f.state.testRevoked=true;
 await assert.rejects(()=>f.fast.validateSession(f.signedReq),e=>e.code==='SESSION_REVOKED');
 assert.deepEqual(f.testserviceCounts,{auth:2,team:1,head:1});
});

test('RC1637: failed HEAD cannot authorize cached E2E team state; full GET is required',async()=>{
 const f=fixture();
 await f.fast.validateSession(f.signedReq);
 f.state.failTestHead=true;
 f.state.testActive=false;
 await assert.rejects(()=>f.fast.validateSession(f.signedReq),e=>e.code==='ACCOUNT_DISABLED');
 assert.deepEqual(f.testserviceCounts,{auth:2,team:2,head:1});
});

test('RC1637: failed HEAD plus failed full GET never returns a cached healthy session',async()=>{
 const f=fixture();
 await f.fast.validateSession(f.signedReq);
 f.state.failTestHead=true;
 f.state.failTestTeamRead=true;
 await assert.rejects(()=>f.fast.validateSession(f.signedReq),/FULL_TESTSERVICE_READ_FAILED/);
 assert.deepEqual(f.testserviceCounts,{auth:2,team:2,head:1});
});

test('RC1637: legacy TESTSERVICE and signed E2E requests never share in-flight data across blob scopes',async()=>{
 const f=fixture();
 const [legacy,e2e]=await Promise.all([
  f.fast.validateSession(f.legacyTestReq),
  f.fast.validateSession(f.signedReq)
 ]);
 assert.equal(legacy.user.id,'U1');
 assert.equal(e2e.user.id,'E2E-USER-1');
 assert.deepEqual(f.primaryCounts,{auth:1,team:1,head:0});
 assert.deepEqual(f.testserviceCounts,{auth:1,team:1,head:0});
 assert.equal(f.testserviceClientCalls(),1);
});

test('RC1637: production requests retain full team reads and do not use the TESTSERVICE cache',async()=>{
 const f=fixture();
 await f.fast.validateSession(f.prodReq);
 await f.fast.validateSession(f.prodReq);
 assert.deepEqual(f.primaryCounts,{auth:2,team:2,head:0});
 assert.deepEqual(f.testserviceCounts,{auth:0,team:0,head:0});
});
