import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {collectStateSaveEvidence,sanitizeStateSaveResponse} from '../e2e/helpers/rc1171-save-evidence.mjs';

test('RC1171: only known API error codes and HTTP statuses survive redaction',()=>{
  assert.deepEqual(sanitizeStateSaveResponse(409,'CONCURRENT_UPDATE',false),{httpStatus:409,code:'CONCURRENT_UPDATE'});
  assert.deepEqual(sanitizeStateSaveResponse(503,'STORAGE_UNREACHABLE',false),{httpStatus:503,code:'STORAGE_UNREACHABLE'});
  assert.deepEqual(sanitizeStateSaveResponse(200,'',true),{httpStatus:200,code:'OK'});
  assert.deepEqual(sanitizeStateSaveResponse(500,'customer@secret.test Ref ABCDEF',false),{httpStatus:500,code:'UNRECOGNIZED'});
  assert.deepEqual(sanitizeStateSaveResponse(999,'anything',false),{httpStatus:null,code:'UNRECOGNIZED'});
});

test('RC1171: recorder includes only state-save responses, never URL, session or backend message',async()=>{
  const page=new EventEmitter();
  const recorder=collectStateSaveEvidence(page);
  page.emit('response',{
    url:()=> 'https://example.test/api/exporthub-state?mode=read&token=secret',
    status:()=>200,
    json:async()=>({ok:true})
  });
  page.emit('response',{
    url:()=> 'https://example.test/api/exporthub-state?mode=save&ack=1&token=private-token',
    status:()=>409,
    json:async()=>({ok:false,code:'CONCURRENT_UPDATE',message:'private@example.test'})
  });
  page.emit('requestfailed',{
    url:()=> 'https://example.test/api/exporthub-state?mode=save&token=private-token',
    failure:()=>({errorText:'private@example.test'})
  });
  const result=await recorder.snapshot();
  recorder.dispose();
  assert.equal(result.responses.length,2);
  assert.ok(result.responses.some(item=>item.httpStatus===409&&item.code==='CONCURRENT_UPDATE'));
  assert.ok(result.responses.some(item=>item.httpStatus===null&&item.code==='NETWORK_FAILED'));
  assert.equal(result.networkFailures,1);
  assert.doesNotMatch(JSON.stringify(result),/private|secret|example.test|token/);
  for(const kind of ['request','response','requestfinished','requestfailed'])assert.equal(page.listenerCount(kind),0);
});

test('RC1171: unknown API code and response errors stay sanitized and fail-closed',async()=>{
  const page=new EventEmitter();
  const recorder=collectStateSaveEvidence(page);
  page.emit('response',{
    url:()=> 'https://example.test/api/exporthub-state?mode=save',
    status:()=>500,
    json:async()=>({code:'SENSITIVE_SHIPMENT_XYZ',message:'private'})
  });
  page.emit('response',{
    url:()=> 'https://example.test/api/exporthub-state?mode=save',
    status:()=>502,
    json:async()=>{throw new Error('secret network body')}
  });
  const result=await recorder.snapshot();
  recorder.dispose();
  assert.deepEqual(result.responses,[
    {httpStatus:500,code:'UNRECOGNIZED'},
    {httpStatus:502,code:'UNRECOGNIZED'}
  ]);
});

test('RC1171: an in-flight save is visible without leaking request body or URL',async()=>{
  const page=new EventEmitter();
  const recorder=collectStateSaveEvidence(page);
  const request={url:()=> 'https://example.test/api/exporthub-state?mode=save&token=SHOULD_NEVER_LEAK',postData:()=> 'private data'};
  page.emit('request',request);
  let snapshot=await recorder.snapshot();
  assert.deepEqual({started:snapshot.started,finished:snapshot.finished,inFlight:snapshot.inFlight},{started:1,finished:0,inFlight:1});
  assert.equal(snapshot.responses.length,0);
  assert.doesNotMatch(JSON.stringify(snapshot),/SHOULD_NEVER_LEAK|private data|example.test/);
  page.emit('response',{url:request.url,status:()=>200,json:async()=>({ok:true,content:'secret'})});
  page.emit('requestfinished',request);
  snapshot=await recorder.snapshot();
  recorder.dispose();
  assert.deepEqual({started:snapshot.started,finished:snapshot.finished,inFlight:snapshot.inFlight},{started:1,finished:1,inFlight:0});
  assert.deepEqual(snapshot.responses,[{httpStatus:200,code:'OK'}]);
});


