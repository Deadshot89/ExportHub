import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const packStore=require('../api/shared/pack-notification-store.js');
const api=require('../api/pack-notification/index.js');

function request(action,body){
  return{method:'POST',query:{action},headers:{host:'www.exporthub360.de'},body};
}

test('RC1514: public pack read actions never enter the shared-state mutation path',async()=>{
  const token='PT01-readonly-secret-token';
  const state={
    packStations:[{id:'PT01',name:'Packtisch 01',tokenHash:packStore.hashStationToken(token),active:true}],
    packDrafts:[{id:'draft-1',status:'draft',customer:'BSH Hausgeräte',packageType:'Euro Palette',packageCount:2,updatedAt:'2026-10-13T08:00:00.000Z'}],
    customers:[{id:'bsh-1',account:'100200',name:'BSH Hausgeräte'}],
    colliTypes:[{name:'Karton',length:40,width:30,height:20}]
  };
  let mutationCalls=0,readCalls=0;
  const handler=api.createHandler({
    rateLimit:()=>{},
    mutateState:async()=>{mutationCalls++;throw new Error('read action entered mutation path');},
    readState:async(_environment,reader)=>{readCalls++;return reader(JSON.parse(JSON.stringify(state)));}
  });

  const responses=await Promise.all([
    handler(request('customer-search',{stationToken:token,query:'BSH'})),
    handler(request('packaging-list',{stationToken:token})),
    handler(request('draft-list',{stationToken:token})),
    handler(request('draft-get',{stationToken:token,draftId:'draft-1'}))
  ]);

  for(const result of responses)assert.equal(result.status,200,JSON.stringify(result.body));
  assert.equal(mutationCalls,0,'read-only pack requests must not write team-state.json');
  assert.equal(readCalls,4,'every read-only pack request must use the read state path');
});
