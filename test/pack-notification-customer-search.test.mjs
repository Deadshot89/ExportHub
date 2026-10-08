import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const packStore=require('../api/shared/pack-notification-store.js');
const api=require('../api/pack-notification/index.js');

function fixture(){
  const token='PT01-customer-search-secret';
  const customers=[
    {id:'C1',account:'10001',name:'Bosch Hausgeräte GmbH',email:'hidden@example.invalid',address:'Secret 1'},
    {id:'C2',customerNumber:'10002',customerName:'BSH Bosch Service',contacts:[{email:'hidden2@example.invalid'}]},
    ...Array.from({length:30},(_,i)=>({id:`M${i+1}`,account:`BOSCH-${String(i+1).padStart(2,'0')}`,name:`Bosch Treffer ${i+1}`,note:'internal'}))
  ];
  let state={
    customers,
    packStations:[{id:'PT01',name:'Packtisch 01',tokenHash:packStore.hashStationToken(token),active:true}],
    packSessions:[],packNotifications:[],tasks:[]
  };
  const handler=api.createHandler({
    now:()=>new Date('2026-10-08T10:00:00.000Z'),
    rateLimit:()=>{},
    mutateState:async(_environment,mutator)=>{
      const result=await mutator(JSON.parse(JSON.stringify(state)));
      state=result.state;
      return result;
    }
  });
  return{token,handler,state:()=>state};
}

function request(body){
  return{method:'POST',query:{action:'customer-search'},headers:{host:'www.exporthub360.de'},body};
}

test('customer-search returns only minimal customer fields and caps results at ten',async()=>{
  const f=fixture();
  const res=await f.handler(request({stationToken:f.token,query:'bosch'}));
  assert.equal(res.status,200);
  assert.equal(res.body.ok,true);
  assert.equal(res.body.customers.length,10);
  for(const customer of res.body.customers){
    assert.deepEqual(Object.keys(customer).sort(),['account','id','name']);
    assert.equal(typeof customer.id,'string');
    assert.equal(typeof customer.account,'string');
    assert.equal(typeof customer.name,'string');
  }
});

test('customer-search matches customerNumber/customerName case-insensitively',async()=>{
  const f=fixture();
  const res=await f.handler(request({stationToken:f.token,query:'bsh bosch'}));
  assert.equal(res.status,200);
  assert.deepEqual(res.body.customers,[{id:'C2',account:'10002',name:'BSH Bosch Service'}]);
});

test('customer-search returns no data for empty or one-character query',async()=>{
  const f=fixture();
  for(const query of ['', ' ', 'b']){
    const res=await f.handler(request({stationToken:f.token,query}));
    assert.equal(res.status,200);
    assert.deepEqual(res.body.customers,[]);
  }
});

test('customer-search rejects an invalid station token',async()=>{
  const f=fixture();
  const res=await f.handler(request({stationToken:'wrong-token',query:'bosch'}));
  assert.equal(res.status,404);
  assert.equal(res.body.ok,false);
});
