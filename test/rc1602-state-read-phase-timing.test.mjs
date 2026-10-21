import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readTimedStateResponse,publicStateReadTimings} from '../e2e/helpers/rc1602-state-read-timing.mjs';

test('RC1602: separates transfer and JSON parse timings without mutating response payload',async()=>{
  let t=0;
  const original={ok:true,state:{shipments:[{ref:'PRIVATE-REF-123',customerName:'PRIVATE CUSTOMER'}]},revision:42};
  const raw=JSON.stringify(original);
  const response={status:200,async text(){t+=120;return raw}};
  const {payload,measurements}=await readTimedStateResponse(response,{now:()=>t+=5});
  assert.deepEqual(payload,original);
  assert.ok(measurements.bodyMs>=120);
  assert.ok(measurements.parseMs>=0);
  assert.equal(measurements.bodyBytes,Buffer.byteLength(raw));
  assert.equal(response.status,200);
});

test('RC1602: only numeric allowlisted timing fields are ever logged',()=>{
  const detail={
    status:200,headerMs:123.8,measurements:{bodyMs:423.6,parseMs:238.3,bodyBytes:58_927_926,
      reference:'SECRET_REF',headers:{authorization:'Bearer SECRET_TOKEN'}},
    serverMs:412,authMs:28,teamMs:221,secret:'SECRET_CUSTOMER'
  };
  const safe=publicStateReadTimings(detail);
  assert.deepEqual(Object.keys(safe),['status','headerMs','bodyMs','parseMs','bodyBytes','serverMs','authMs','teamMs']);
  assert.equal(safe.headerMs,124);
  assert.equal(safe.bodyBytes,58_927_926);
  for(const forbidden of ['SECRET_REF','SECRET_TOKEN','SECRET_CUSTOMER','authorization','reference']){
    assert.ok(!JSON.stringify(safe).includes(forbidden));
  }
});

test('RC1602: invalid/empty timing values produce null, not identifiable exception text',()=>{
  const safe=publicStateReadTimings({status:NaN,headerMs:-1,measurements:{bodyMs:Infinity,parseMs:null,bodyBytes:'SECRET'},teamMs:undefined});
  assert.equal(safe.status,0);
  assert.equal(safe.headerMs,null);
  assert.equal(safe.bodyMs,null);
  assert.equal(safe.parseMs,null);
  assert.equal(safe.bodyBytes,null);
  assert.equal(safe.teamMs,null);
});

test('RC1602: malformed JSON fails closed without echoing the 59MB response',async()=>{
  const secret='PRIVATE_CUSTOMER_SECRETS';
  await assert.rejects(()=>readTimedStateResponse({async text(){return '{"sensitive":"'+secret+'",'}}, {now:()=>0}),SyntaxError);
});

test('RC1602: existing Node E2E fixtures using response.json are supported',async()=>{
  const {payload,measurements}=await readTimedStateResponse({async json(){return {ok:true,revision:1}}}, {now:()=>7});
  assert.deepEqual(payload,{ok:true,revision:1});
  assert.equal(measurements.bodyBytes,null);
  assert.equal(measurements.parseMs,null);
});

test('RC1602: timing instrumentation is only in authenticated TESTSERVICE readiness',()=>{
  const source=fs.readFileSync('e2e/helpers/testservice-readiness.mjs','utf8');
  assert.match(source,/EXPORTHUB_E2E_LIVE/);
  assert.match(source,/EXPORTHUB_E2E_PUBLIC_ENV/);
  assert.match(source,/testservice/);
  assert.match(source,/Authorization':'Bearer '\+token/);
  assert.match(source,/readTimedStateResponse\(response\)/);
  assert.match(source,/RC1602 TESTSERVICE State-Read phase timings/);
  assert.doesNotMatch(source,/console\.log\([^)]*(?:payload|token|state)\s*[,)]/i);
});
