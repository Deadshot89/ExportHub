import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const policy=require('../api/shared/user-policy.js');
const stateWriteGuard=require('../api/shared/state-write-guard.js');
const source=fs.readFileSync('api/exporthub-state/index.js','utf8');

function slice(startMarker,endMarker){
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker,start);
  assert.ok(start>=0&&end>start,'missing '+startMarker);
  return source.slice(start,end);
}

const block=[
  slice('function usernameOf(user)','function publicUser('),
  slice('function cachedUserMayWrite(','function clientStateForRead(')
].join('\n');

function rights(level){
  const out={};
  for(const id of policy.MODULES)out[id]={level:'none',visible:false,read:false,edit:false,admin:false,functionAdmin:false};
  if(level==='edit')out.shipment={level:'edit',visible:true,read:true,edit:true,admin:false,functionAdmin:false};
  return out;
}

function sevastian(level){
  return {id:'USER-Sevastian',user:'Sevastian',login:'Sevastian',username:'Sevastian',name:'Sevastian',
    role:'Benutzer',permissions:[],active:true,authVersion:0,rightsRepairVersion:'RC1525',rights:rights(level)};
}

function fixture({cacheMode,cachedLevel,freshLevel}){
  let freshReads=0,forgotten=0,remembered=null;
  const team=level=>({schemaVersion:3,revision:1,users:[sevastian(level)],state:{}});
  const error=(code,message,status)=>Object.assign(new Error(message),{code,status});
  const context={
    Date,Number,Array,
    text:v=>String(v??'').trim(),
    lower:v=>String(v??'').trim().toLowerCase(),
    isAdmin:policy.isAdmin,
    stateWriteGuard,
    error,
    emptyTeam:()=>({users:[],state:{}}),
    bearer:()=> 'token-1',
    readAuthCached:async()=>({value:{sessions:[]},cacheMode:'memory-etag'}),
    resolveSessionFromAuth:()=>({session:{userId:'USER-Sevastian',username:'Sevastian',authVersion:0},source:'blob'}),
    readTeamCachedForSession:async()=>({value:team(cachedLevel),etag:'etag-old',cacheMode}),
    readTeamForSession:async()=>{freshReads++;return {value:team(freshLevel),etag:'etag-new'}},
    forgetWarmTeam:()=>{forgotten++},
    rememberWarmTeam:(_c,value,etag)=>{remembered={value,etag}}
  };
  vm.runInNewContext(block+'\nthis.validateSession=validateSession;this.hasAnyEditRight=hasAnyEditRight;',context);
  const run=()=>context.validateSession({query:{mode:'save'}},{},{environment:'production'});
  return {run,hasAnyEditRight:context.hasAnyEditRight,counts:()=>({freshReads,forgotten,remembered})};
}

test('RC1580: save from a stale warm cache rereads Azure when the cached user lacks edit rights',async()=>{
  const f=fixture({cacheMode:'memory-save',cachedLevel:'none',freshLevel:'edit'});
  const current=await f.run();
  assert.equal(f.hasAnyEditRight(current.user),true,'fresh rights from Azure must be used');
  assert.equal(current.teamEtag,'etag-new');
  assert.equal(current.timing.teamCache,'full-read','saveMerged must not treat the fresh read as optimistic');
  const counts=f.counts();
  assert.equal(counts.freshReads,1);
  assert.equal(counts.forgotten,1);
  assert.equal(counts.remembered.etag,'etag-new');
});

test('RC1580: a user without edit rights in Azure is still rejected after the reread',async()=>{
  const f=fixture({cacheMode:'memory-save',cachedLevel:'none',freshLevel:'none'});
  const current=await f.run();
  assert.equal(f.hasAnyEditRight(current.user),false,'the save handler keeps refusing with WRITE_FORBIDDEN');
  assert.equal(f.counts().freshReads,1);
});

test('RC1580: a cached user with edit rights keeps the fast save path without an extra read',async()=>{
  const f=fixture({cacheMode:'memory-save',cachedLevel:'edit',freshLevel:'edit'});
  const current=await f.run();
  assert.equal(current.timing.teamCache,'memory-save');
  assert.equal(f.counts().freshReads,0);
});

test('RC1580: ETag-verified cache reads are not reread',async()=>{
  const f=fixture({cacheMode:'memory-etag',cachedLevel:'none',freshLevel:'edit'});
  await f.run();
  assert.equal(f.counts().freshReads,0);
});
