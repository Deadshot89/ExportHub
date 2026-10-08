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
    colliTypes:[
      {id:'CT1',name:'Spezialkiste A',l:88,w:55,h:44,ldm:0.21,note:'intern'},
      {id:'CT2',name:'Industrie Palette',l:120,w:100,h:165,ldm:0.5,secret:'nicht senden'},
      {id:'OLD-E3',name:'E3',l:60,w:40,h:22,ldm:0.10}
    ],
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

function request(body,action='customer-search'){
  return{method:'POST',query:{action},headers:{host:'www.exporthub360.de'},body};
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

test('packaging-list exposes saved colliTypes with only name and dimensions',async()=>{
  const f=fixture();
  const res=await f.handler(request({stationToken:f.token},'packaging-list'));
  assert.equal(res.status,200);
  const special=res.body.packaging.find(x=>x.name==='Spezialkiste A');
  assert.deepEqual(special,{name:'Spezialkiste A',length:88,width:55,height:44,ldm:0.21,source:'master'});
  assert.equal(Object.hasOwn(special,'note'),false);
  assert.equal(Object.hasOwn(special,'id'),false);
});

test('packaging-list keeps fixed E3 master dimensions ahead of stale saved E3 values',async()=>{
  const f=fixture();
  const res=await f.handler(request({stationToken:f.token},'packaging-list'));
  assert.equal(res.status,200);
  const e3=res.body.packaging.find(x=>x.name==='E3');
  assert.deepEqual(e3,{name:'E3',length:43,width:31,height:31,ldm:0.06,source:'fixed'});
});

test('packaging-list rejects an invalid station token',async()=>{
  const f=fixture();
  const res=await f.handler(request({stationToken:'wrong-token'},'packaging-list'));
  assert.equal(res.status,404);
  assert.equal(res.body.ok,false);
});
