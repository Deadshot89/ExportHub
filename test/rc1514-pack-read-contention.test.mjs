import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const packStore=require('../api/shared/pack-notification-store.js');
const api=require('../api/pack-notification/index.js');

const clone=value=>JSON.parse(JSON.stringify(value));

function request(action,body){
  return{method:'POST',query:{action},headers:{host:'www.exporthub360.de'},body};
}

test('RC1514: read-only pack actions never enter the shared-state write path',async()=>{
  const token='PT01-rc1514-read-only-token';
  const state={
    customers:[{id:'C1',account:'10001',name:'Bosch Hausgeräte GmbH'}],
    colliTypes:[{id:'CT1',name:'Euro Palette',l:120,w:80,h:145}],
    packStations:[{id:'PT01',name:'Packtisch 01',tokenHash:packStore.hashStationToken(token),active:true}],
    packSessions:[],
    packNotifications:[],
    packDrafts:[{id:'D1',status:'draft',customer:'RC1514 Kunde',packageType:'Euro Palette',packageCount:1,updatedAt:'2026-10-13T10:00:00.000Z'}],
    tasks:[]
  };
  let reads=0,writes=0;
  const handler=api.createHandler({
    rateLimit:()=>{},
    readState:async()=>{reads++;return clone(state);},
    mutateState:async()=>{writes++;throw new Error('RC1514 unexpected shared-state write');}
  });

  const cases=[
    ['customer-search',{stationToken:token,query:'bosch'}],
    ['packaging-list',{stationToken:token}],
    ['draft-list',{stationToken:token}],
    ['draft-get',{stationToken:token,draftId:'D1'}]
  ];
  for(const [action,body] of cases){
    const res=await handler(request(action,body));
    assert.equal(res.status,200,`${action} must stay read-only`);
    assert.equal(res.body.ok,true,`${action} must succeed`);
  }
  assert.equal(writes,0,'read-only pack actions must not mutate team-state.json');
  assert.equal(reads,cases.length,'each read-only action should read state once');
});
