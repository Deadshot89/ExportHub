import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const packStore=require('../api/shared/pack-notification-store.js');
const api=require('../api/pack-notification/index.js');

function stateFor(token){
  return {
    packStations:[{
      id:'E2E-PACK-STATION-RC1502',
      name:'E2E Packtisch RC1502',
      tokenHash:packStore.hashStationToken(token),
      active:true
    }],
    packSessions:[],
    packNotifications:[],
    packDrafts:[]
  };
}

test('RC1502 RED: TESTSERVICE origin wins when Azure proxy host does not contain testservice',async()=>{
  const token='E2E-PACK-rc1502-testservice-token';
  let state=stateFor(token);
  let selectedEnvironment='';
  const handler=api.createHandler({
    rateLimit:()=>{},
    now:()=>new Date('2026-10-12T16:30:00.000Z'),
    mutateState:async(environment,mutator)=>{
      selectedEnvironment=environment;
      const result=await mutator(JSON.parse(JSON.stringify(state)));
      state=result.state;
      return result;
    }
  });

  const testservice='https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';
  const res=await handler({
    method:'POST',
    query:{action:'session'},
    headers:{
      host:'exporthub-api.azurewebsites.net',
      origin:testservice,
      referer:testservice+'/pack/'+encodeURIComponent(token)
    },
    body:{stationToken:token}
  });

  assert.equal(res.status,201);
  assert.equal(selectedEnvironment,'testservice','Pack-API darf den TESTSERVICE-Aufruf nicht in den Produktions-State routen');
});
