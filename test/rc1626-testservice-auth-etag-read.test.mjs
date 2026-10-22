import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require=createRequire(import.meta.url);
function loadCommonJs(relative,mocks) {
  const absolute=path.resolve(relative),old=Module._load;
  Module._load=function(name,parent,isMain){
    if(Object.hasOwn(mocks,name))return mocks[name];
    return old.call(this,name,parent,isMain);
  };
  delete require.cache[require.resolve(absolute)];
  try{return require(absolute);}finally{Module._load=old;}
}
function fixture(options={}){
  const count={auth:0,team:0,head:0},state={etag:'team-v1',active:true,rights:'view',authEtag:'auth-v1',revoked:false,failHead:false,failRead:false,noEtag:false};
  const teamBlob={name:'team',
    async getProperties(){
      count.head++;
      if(state.failHead)throw Error('HEAD_UNAVAILABLE');
      return {etag:state.etag};
    }
  };
  if(options.noHead)delete teamBlob.getProperties;
  const authBlob={name:'auth'};
  const blobs={auth:authBlob,team:teamBlob};
  const auth={
    bearer(){return 'some-token';},
    async clients(){return blobs;},
    async readJson(blob){
      if(blob===authBlob){
        count.auth++;
        return{etag:state.authEtag,value:{sessions:[{id:'S1',revokedAt:state.revoked?'2026-10-22T13:00:00Z':null}]}};
      }
      count.team++;
      if(state.failRead)throw Error('FULL_READ_FAILED');
      const value={users:[{id:'U1',user:'tester',name:'Tester',active:state.active,authVersion:0,rights:{shipment:{level:state.rights}}}]};
      return{etag:state.noEtag?null:state.etag,value};
    },
    emptyAuth(){return {sessions:[]};},
    emptyTeam(){return {users:[]};},
    resolveSession(_,authDoc){return{source:'blob',session:{
      id:'S1',userId:'U1',username:'tester',expiresAt:'2099-01-01T00:00:00Z',
      authVersion:0,mustChange:false,revokedAt:authDoc.sessions?.[0]?.revokedAt||null
    }};},
    applyUserPolicy(v){return v;},
    usernameOf(u){return String(u?.user||'').toLowerCase();},
    isActive(u){return Boolean(u&&u.active);},
    lower(v){return String(v||'').toLowerCase();},
    text(v){return String(v==null?'':v).trim();},
    error(code,message,status){return Object.assign(new Error(message),{code,status});},
    environmentFromRequest(req){return req.headers?.['x-exporthub-environment']==='testservice'?'testservice':'production';}
  };
  const fast=loadCommonJs('api/shared/fast-auth-store.js',{'../shared/auth-store':auth});
  const testReq={headers:{'x-exporthub-environment':'testservice'}},prodReq={headers:{}};
  return{fast,state,count,testReq,prodReq};
}

test('RC1626: TESTSERVICE unchanged ETag uses HEAD and avoids repeated full team download; session stays fresh',async()=>{
  const f=fixture();
  const first=await f.fast.validateSession(f.testReq);
  const second=await f.fast.validateSession(f.testReq);
  assert.equal(first.user.id,'U1');
  assert.equal(second.user.id,'U1');
  assert.deepEqual(f.count,{auth:2,team:1,head:1});
});

test('RC1626: changing Azure ETag forces full team reload; disabled account denied',async()=>{
  const f=fixture();
  await f.fast.validateSession(f.testReq);
  f.state.etag='team-v2';f.state.active=false;
  await assert.rejects(()=>f.fast.validateSession(f.testReq),e=>e.code==='ACCOUNT_DISABLED');
  assert.equal(f.count.team,2);
  assert.equal(f.count.head,1);
});

test('RC1626: mutating returned team users cannot poison later cached authorization',async()=>{
  const f=fixture();
  const first=await f.fast.validateSession(f.testReq);
  first.user.active=false;
  first.user.rights.shipment.level='admin';
  const second=await f.fast.validateSession(f.testReq);
  assert.equal(second.user.active,true);
  assert.equal(second.user.rights.shipment.level,'view');
  second.user.active=false;
  const third=await f.fast.validateSession(f.testReq);
  assert.equal(third.user.active,true);
  assert.equal(f.count.team,1);
});

test('RC1626: team rights are not stale after ETag change',async()=>{
  const f=fixture();
  await f.fast.validateSession(f.testReq);
  f.state.etag='team-v2';f.state.rights='none';
  const second=await f.fast.validateSession(f.testReq);
  assert.equal(second.user.rights.shipment.level,'none');
  assert.equal(f.count.team,2);
});

test('RC1626: failed HEAD never accepts old state when authoritative GET fails',async()=>{
  const f=fixture();
  await f.fast.validateSession(f.testReq);
  f.state.failHead=true;f.state.failRead=true;
  await assert.rejects(()=>f.fast.validateSession(f.testReq),/FULL_READ_FAILED/);
  assert.equal(f.count.team,2);
});

test('RC1626: failed HEAD falls back to full fresh read',async()=>{
  const f=fixture();
  await f.fast.validateSession(f.testReq);
  f.state.failHead=true;f.state.etag='team-v2';f.state.active=false;
  await assert.rejects(()=>f.fast.validateSession(f.testReq),e=>e.code==='ACCOUNT_DISABLED');
  assert.equal(f.count.team,2);
});

test('RC1626: unversioned/missing ETag never creates unverified cache',async()=>{
  const f=fixture();
  f.state.noEtag=true;
  await f.fast.validateSession(f.testReq);
  await f.fast.validateSession(f.testReq);
  assert.equal(f.count.team,2);assert.equal(f.count.head,0);
});

test('RC1626: unsupported HEAD never creates unverified cache',async()=>{
  const f=fixture({noHead:true});
  await f.fast.validateSession(f.testReq);
  await f.fast.validateSession(f.testReq);
  assert.equal(f.count.team,2);assert.equal(f.count.head,0);
});

test('RC1626: production path still reads full team on every completed request',async()=>{
  const f=fixture();
  await f.fast.validateSession(f.prodReq);
  await f.fast.validateSession(f.prodReq);
  assert.equal(f.count.team,2);assert.equal(f.count.head,0);
});

test('RC1626: session revocation is always checked against fresh auth document',async()=>{
  const f=fixture();
  await f.fast.validateSession(f.testReq);
  f.state.revoked=true;
  await assert.rejects(()=>f.fast.validateSession(f.testReq),e=>e.code==='SESSION_REVOKED');
  assert.equal(f.count.auth,2);
  assert.equal(f.count.team,1);
  assert.equal(f.count.head,1);
});

test('RC1626: parallel TESTSERVICE requests still coalesce full reads',async()=>{
  const f=fixture();
  const result=await Promise.all([f.fast.validateSession(f.testReq),f.fast.validateSession(f.testReq)]);
  assert.equal(result.length,2);
  assert.equal(f.count.auth,1);
  assert.equal(f.count.team,1);
});

test('RC1626: production and TESTSERVICE simultaneous requests do not share trusted HEAD cache results',async()=>{
  const f=fixture();
  await Promise.all([f.fast.validateSession(f.testReq),f.fast.validateSession(f.prodReq)]);
  assert.equal(f.count.auth,2);
  assert.equal(f.count.team,2);
});

test('RC1626: source checks ensure TESTSERVICE opt-in, ETag comparison and no authorization bypass',()=>{
  const src=fs.readFileSync('api/shared/fast-auth-store.js','utf8');
  assert.match(src,/auth\.environmentFromRequest\(req\)==='testservice'/);
  assert.match(src,/props\.etag\)===cache\.etag/);
  assert.match(src,/auth\.readJson\(c\.auth,auth\.emptyAuth\(\)\)/);
  assert.match(src,/if \(session\.revokedAt\)/);
});
