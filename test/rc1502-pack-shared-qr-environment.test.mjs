import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const packStore=require('../api/shared/pack-notification-store');
const {createHandler}=require('../api/pack-notification/index.js');

function read(path){return fs.readFileSync(path,'utf8');}

test('RC1502 public pack API resolves TESTSERVICE from forwarded host behind Azure proxy',async()=>{
  const token='RC1502-shared-pack-token';
  let seenEnvironment='';
  let state={
    packStations:[{id:'PACK-SHARED',name:'Packbereich',tokenHash:packStore.hashStationToken(token),active:true}],
    packSessions:[],packNotifications:[],packDrafts:[]
  };
  const handler=createHandler({
    rateLimit:()=>{},
    now:()=>new Date('2026-10-12T17:00:00.000Z'),
    mutateState:async(environment,mutator)=>{
      seenEnvironment=environment;
      const result=await mutator(state);
      state=result.state;
      return result;
    }
  });
  const response=await handler({
    method:'POST',
    query:{action:'session'},
    headers:{
      host:'exporthub-functions.internal.azurewebsites.net',
      'x-forwarded-host':'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net',
      origin:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'
    },
    body:{stationToken:token}
  });
  assert.equal(response.status,201);
  assert.equal(seenEnvironment,'testservice');
});

test('RC1502 user-facing Packmeldung provides one shared QR instead of multiple packing stations',()=>{
  const admin=read('assets/pack-station-admin.js');
  assert.match(admin,/Pack-QR-Code/,'shared QR heading is missing');
  assert.match(admin,/Gemeinsamer QR-Code für alle Packplätze/,'shared QR explanation is missing');
  assert.doesNotMatch(admin,/Name des Packtischs|Packtisch anlegen/,'UI must not ask users to create named packing stations');
  assert.match(admin,/call\(['"]shared['"]/,'UI must request the shared QR endpoint');
});

test('RC1502 pack admin API owns one fixed shared packing access point',()=>{
  const api=read('api/pack-stations-admin/index.js');
  assert.match(api,/PACK-SHARED/,'fixed shared packing access id is missing');
  assert.match(api,/action===['"]shared['"]/,'shared QR action is missing');
  assert.match(api,/action===['"]rotate-shared['"]/,'shared QR rotation action is missing');
});
