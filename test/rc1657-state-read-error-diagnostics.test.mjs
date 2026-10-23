import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {safeStateReadErrorCode,stateReadErrorCodeFromResponse}
  from '../e2e/helpers/rc1657-state-read-error-diagnostics.mjs';

test('RC1657: API code from JSON 500 is retained without user-facing message',async()=>{
  const response={
    url:()=> 'https://example.invalid/api/exporthub-state?mode=read',
    json:async()=>({ok:false,code:'STORAGE_UNREACHABLE',message:'PRIVATE CUSTOMER / SECRET TOKEN'})
  };
  assert.equal(await stateReadErrorCodeFromResponse(response),'STORAGE_UNREACHABLE');
});

test('RC1657: response without a safe error code is generic, never a message leak',()=>{
  for(const payload of [
    {code:'NOT_SAFE; reference=PRIVATE'}, {code:'abc'}, {code:'SERVER_ERROR_PRIVATE-REF'},
    {code:'TOKEN=SECRET'}, {code:'A'.repeat(80)}, {message:'sensitive'},
    null,[],42
  ])assert.equal(safeStateReadErrorCode(payload),'UNAVAILABLE');
});

test('RC1657: other endpoints and state writes are not inspected',async()=>{
  let parsed=0;
  const response=url=>({url:()=>url,json:async()=>{parsed++;return {code:'SERVER_ERROR'}}});
  assert.equal(await stateReadErrorCodeFromResponse(response('https://example.invalid/api/pickup-status?mode=read')),null);
  assert.equal(await stateReadErrorCodeFromResponse(response('https://example.invalid/api/exporthub-state?mode=save&ack=1')),null);
  assert.equal(await stateReadErrorCodeFromResponse(response('not-a-url')),null);
  assert.equal(parsed,0);
});

test('RC1657: HTML / interrupted 500 cannot disclose body or fail the diagnostic collector',async()=>{
  const response={
    url:()=> 'https://example.invalid/api/exporthub-state?mode=read',
    json:async()=>{throw Error('PRIVATE raw document content');}
  };
  assert.equal(await stateReadErrorCodeFromResponse(response),'UNAVAILABLE');
});

test('RC1657: strict HTTP 5xx assertion remains present and no status is ignored',()=>{
  const source=fs.readFileSync('e2e/helpers/exporthub-browser.mjs','utf8');
  assert.match(source,/const serverFailure=status>=500&&\['xhr','fetch'\]\.includes\(type\)/);
  assert.match(source,/state\.httpErrors\.push\(/);
  assert.match(source,/await Promise\.allSettled\(state\.pendingHttpDetails\|\|\[\]\)/);
  assert.match(source,/expect\(payload\.httpErrors,'HTTP-5xx bei Kern-Requests'\)\.toEqual\(\[\]\)/);
  assert.doesNotMatch(source,/if\s*\(.*500.*\)\s*return\s*;/);
});

test('RC1657: sensitive response fields are never serialized in our browser diagnostic',()=>{
  const source=fs.readFileSync('e2e/helpers/rc1657-state-read-error-diagnostics.mjs','utf8');
  assert.doesNotMatch(source,/JSON\.stringify\(payload\)|payload\.message|payload\.details/);
  assert.match(source,/\^\[A-Z\]\[A-Z0-9_\]\{1,63\}\$/);
});
