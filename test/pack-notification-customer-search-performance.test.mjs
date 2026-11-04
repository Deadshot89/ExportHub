import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const api=require('../api/pack-notification/index.js');
const store=require('../api/shared/pack-notification-store.js');
const token='PT01-customer-search-perf-secret';
function stateFor(name,active=true){
  return {
    packStations:[{id:'PT01',name:'Packtisch 01',tokenHash:store.hashStationToken(token),active}],
    customers:[{id:'customer-1',name,account:'1234567'}],
    packDrafts:[],packSessions:[],tasks:[],documents:[{data:'SECRET_PDF_BYTES_MUST_NOT_BE_CACHED'}]
  };
}
function request(query,stationToken=token,environment='production'){
  return {method:'POST',query:{action:'customer-search'},headers:{
    host:environment==='testservice'?'pack-testservice.azurestaticapps.net':'www.exporthub360.de'
  },body:{stationToken,query}};
}

test('repeated pack-station searches reuse short-lived read-only snapshot, then refresh',async()=>{
  let clock=1000,reads=0,current=stateFor('BSH Hausgeräte');
  const handler=api.createHandler({rateLimit:()=>{},customerCacheNow:()=>clock,customerCacheTtlMs:6000,
    readState:async()=>{reads++;return structuredClone(current);}
  });
  const first=await handler(request('haus'));
  assert.equal(first.status,200,JSON.stringify(first.body));
  assert.equal(first.body.customers[0].name,'BSH Hausgeräte');
  const second=await handler(request('1234'));
  assert.equal(second.status,200);
  assert.equal(reads,1,'typing a second query must not re-download the complete Azure team-state');
  const unauthorized=await handler(request('haus','not-a-valid-station-token'));
  assert.equal(unauthorized.status,404,'cached customers must never bypass station QR token validation');
  assert.equal(reads,1);
  current=stateFor('Kunde nach Änderung',false);
  clock+=6001;
  const expired=await handler(request('haus'));
  assert.equal(expired.status,403,'deactivated station must be rejected after the short cache TTL');
  assert.equal(reads,2);
});

test('parallel customer queries share one Azure read, without leaking between TESTSERVICE and production',async()=>{
  let clock=100,reads={production:0,testservice:0};
  const handler=api.createHandler({rateLimit:()=>{},customerCacheNow:()=>clock,customerCacheTtlMs:6000,
    readState:async environment=>{reads[environment]++;await Promise.resolve();return stateFor(environment==='production'?'Produktionskunde':'TESTSERVICE Kunde');}
  });
  const [prodA,prodB,testOnly]=await Promise.all([
    handler(request('kunde')),handler(request('produkt')),handler(request('kunde',token,'testservice'))
  ]);
  assert.equal(prodA.status,200);assert.equal(prodB.status,200);assert.equal(testOnly.status,200);
  assert.equal(reads.production,1);
  assert.equal(reads.testservice,1);
  assert.equal(prodA.body.customers[0].name,'Produktionskunde');
  assert.equal(testOnly.body.customers[0].name,'TESTSERVICE Kunde');
  assert.equal((await handler(request('test',token,'production'))).body.customers.length,0,'test data must not appear on production');
});

test('pack homepage draft list warms customer lookup without an additional Azure read',async()=>{
  let reads=0;
  const handler=api.createHandler({rateLimit:()=>{},customerCacheTtlMs:6000,
    readState:async()=>{reads++;return stateFor('Henkel Düsseldorf');}
  });
  const listed=await handler({method:'POST',query:{action:'draft-list'},headers:{host:'www.exporthub360.de'},body:{stationToken:token}});
  assert.equal(listed.status,200,JSON.stringify(listed.body));
  const customer=await handler(request('henk'));
  assert.equal(customer.status,200,JSON.stringify(customer.body));
  assert.equal(customer.body.customers[0].name,'Henkel Düsseldorf');
  assert.equal(reads,1,'homepage already loaded team-state: do not fetch it again for first search');
});

test('failed customer-state loads are not cached; next query retries cleanly',async()=>{
  let reads=0;
  const handler=api.createHandler({rateLimit:()=>{},readState:async()=>{reads++;if(reads===1)throw new Error('temporary Azure read failure');return stateFor('Kunde Test');}});
  const first=await handler(request('kunde'));
  assert.equal(first.status,500);
  const second=await handler(request('kunde'));
  assert.equal(second.status,200,JSON.stringify(second.body));
  assert.equal(reads,2);
});

test('client invalidates stale searches, caches repeat terms and ships updated asset version',()=>{
  const client=fs.readFileSync(new URL('../assets/pack-notification.js',import.meta.url),'utf8');
  assert.match(client,/const seq=\+\+state\.customerQuerySeq;clearTimeout\(state\.customerSearchTimer\)/,'input must invalidate outstanding replies even below 2 characters');
  assert.match(client,/function selectCustomer\(customer\)\{clearTimeout\(state\.customerSearchTimer\);state\.customerQuerySeq\+\+/);
  assert.match(client,/customerResultsCache:new Map\(\)/);
  assert.match(client,/Date\.now\(\)-cached\.at<45000/);
  assert.match(client,/\},140\);/,'reduced debounce should feel responsive');
  for(const path of ['../pack.html','../assets/pack.html']){
    const html=fs.readFileSync(new URL(path,import.meta.url),'utf8');
    assert.match(html,/src="\/assets\/pack-notification\.js\?v=9"/,'clients must fetch the mixed-type-safe optimized JS instead of stale cached v8');
  }
});
