'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const api=require('../api/pack-notification/index.js');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('RC1514: same-environment pack state mutations are serialized before Azure ETag contention can build up',async()=>{
  assert.equal(typeof api.serializeStateMutations,'function','pack API must expose the serialization helper for regression coverage');
  let active=0,maxActive=0;
  const order=[];
  const mutate=api.serializeStateMutations(async(_environment,label)=>{
    active+=1;maxActive=Math.max(maxActive,active);order.push(`start:${label}`);
    await delay(label==='A'?30:5);
    order.push(`end:${label}`);active-=1;
    return label;
  });

  const results=await Promise.all([
    mutate('testservice','A'),
    mutate('testservice','B')
  ]);

  assert.deepEqual(results,['A','B']);
  assert.equal(maxActive,1,'two TESTSERVICE pack writes must never enter the shared state critical section together');
  assert.deepEqual(order,['start:A','end:A','start:B','end:B']);
});

test('RC1514: production and TESTSERVICE keep independent mutation queues',async()=>{
  assert.equal(typeof api.serializeStateMutations,'function');
  let active=0,maxActive=0;
  const mutate=api.serializeStateMutations(async()=>{
    active+=1;maxActive=Math.max(maxActive,active);
    await delay(20);
    active-=1;
  });

  await Promise.all([
    mutate('production',null),
    mutate('testservice',null)
  ]);

  assert.equal(maxActive,2,'TESTSERVICE serialization must not block production and vice versa');
});

test('RC1514: a failed pack write releases the queue for the next independent session',async()=>{
  assert.equal(typeof api.serializeStateMutations,'function');
  let calls=0;
  const mutate=api.serializeStateMutations(async()=>{
    calls+=1;
    if(calls===1)throw new Error('synthetic storage failure');
    return 'second-session-saved';
  });

  await assert.rejects(()=>mutate('testservice',null),/synthetic storage failure/);
  assert.equal(await mutate('testservice',null),'second-session-saved');
  assert.equal(calls,2);
});
