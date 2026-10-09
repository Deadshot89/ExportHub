import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const packStore=require('../api/shared/pack-notification-store.js');

function fixture(){
  const token='PT01-api-secret-token';
  let state={
    packStations:[{id:'PT01',name:'Packtisch 01',tokenHash:packStore.hashStationToken(token),active:true}],
    packSessions:[],packNotifications:[],tasks:[]
  };
  const api=require('../api/pack-notification/index.js');
  const handler=api.createHandler({
    now:()=>new Date('2026-10-08T10:00:00.000Z'),
    mutateState:async(_environment,mutator)=>{
      const result=await mutator(JSON.parse(JSON.stringify(state)));
      state=result.state;
      return result;
    }
  });
  return{token,handler,state:()=>state};
}

function request(action,body,extra={}){
  return{method:'POST',query:{action},headers:{host:'www.exporthub360.de',...(extra.headers||{})},body};
}

function validSubmit(token,sessionId,overrides={}){
  return{
    stationToken:token,sessionId,idempotencyKey:'idem-001',customer:'BSH Hausgeräte',deliveryNoteReference:'LS123456.pdf',packageType:'Europalette',packageCount:1,totalWeight:480,
    packages:[{packageNo:1,length:120,width:80,height:140,unit:'cm'}],note:'',
    documents:[{id:'doc-1',name:'LS123456.pdf',mimeType:'application/pdf',size:14,data:'data:application/pdf;base64,JVBERi0xLjQKJSVFT0Y='}],
    ...overrides
  };
}

test('session action creates a login-free isolated server session for a valid station token',async()=>{
  const f=fixture();
  const res=await f.handler(request('session',{stationToken:f.token}));
  assert.equal(res.status,201);
  assert.equal(res.body.ok,true);
  assert.equal(res.body.stationName,'Packtisch 01');
  assert.match(res.body.sessionId,/^[a-f0-9-]{32,}$/i);
  assert.equal(f.state().packSessions.length,1);
});

test('invalid and deactivated station tokens are rejected',async()=>{
  const f=fixture();
  let res=await f.handler(request('session',{stationToken:'wrong'}));
  assert.equal(res.status,404);
  f.state().packStations[0].active=false;
  res=await f.handler(request('session',{stationToken:f.token}));
  assert.equal(res.status,403);
});

test('submit rejects missing fields and non-positive dimensions or weight',async()=>{
  const f=fixture();
  const session=await f.handler(request('session',{stationToken:f.token}));
  let res=await f.handler(request('submit',validSubmit(f.token,session.body.sessionId,{customer:''})));
  assert.equal(res.status,400);assert.equal(res.body.code,'PACK_CUSTOMER_REQUIRED');
  res=await f.handler(request('submit',validSubmit(f.token,session.body.sessionId,{totalWeight:0})));
  assert.equal(res.status,400);assert.equal(res.body.code,'PACK_WEIGHT_INVALID');
  res=await f.handler(request('submit',validSubmit(f.token,session.body.sessionId,{packages:[{packageNo:1,length:120,width:0,height:140,unit:'cm'}]})));
  assert.equal(res.status,400);assert.equal(res.body.code,'PACK_DIMENSIONS_INVALID');
});

test('submit accepts PDF JPEG and PNG but rejects extension/MIME mismatch',async()=>{
  const api=require('../api/pack-notification/index.js');
  for(const doc of [
    {name:'a.pdf',mimeType:'application/pdf',data:'data:application/pdf;base64,JVBERi0xLjQ='},
    {name:'a.jpg',mimeType:'image/jpeg',data:'data:image/jpeg;base64,/9j/2Q=='},
    {name:'a.png',mimeType:'image/png',data:'data:image/png;base64,iVBORw0KGgo='}
  ]) assert.equal(api.validateDocuments([doc],1024).length,1);
  assert.throws(()=>api.validateDocuments([{name:'fake.pdf',mimeType:'image/png',data:'data:image/png;base64,iVBORw0KGgo='}],1024),e=>e&&e.code==='PACK_DOCUMENT_TYPE_MISMATCH');
});

test('submit rejects forged client size when decoded payload exceeds limit',()=>{
  const api=require('../api/pack-notification/index.js');
  const bytes=Buffer.concat([Buffer.from('%PDF-1.4\n'),Buffer.alloc(2048,65)]);
  const data='data:application/pdf;base64,'+bytes.toString('base64');
  assert.throws(()=>api.validateDocuments([{name:'a.pdf',mimeType:'application/pdf',size:10,data}],1024),e=>e&&e.code==='PACK_DOCUMENT_TOO_LARGE');
});

test('submit validates actual file signature and rejects MIME-correct fake content',()=>{
  const api=require('../api/pack-notification/index.js');
  const fake='data:application/pdf;base64,'+Buffer.from('NOT A PDF').toString('base64');
  assert.throws(()=>api.validateDocuments([{name:'fake.pdf',mimeType:'application/pdf',data:fake}],1024),e=>e&&e.code==='PACK_DOCUMENT_SIGNATURE_INVALID');
});

test('submit rejects an expired session',async()=>{
  const f=fixture();
  const session=await f.handler(request('session',{stationToken:f.token}));
  const row=f.state().packSessions.find(x=>x.id===session.body.sessionId);row.status='expired';
  const res=await f.handler(request('submit',validSubmit(f.token,session.body.sessionId)));
  assert.equal(res.status,409);assert.equal(res.body.code,'PACK_SESSION_EXPIRED');
});

test('same idempotency key submitted twice returns one notification and one task',async()=>{
  const f=fixture();
  const session=await f.handler(request('session',{stationToken:f.token}));
  const payload=validSubmit(f.token,session.body.sessionId);
  const first=await f.handler(request('submit',payload));
  const second=await f.handler(request('submit',payload));
  assert.equal(first.status,201);assert.equal(first.body.created,true);
  assert.equal(second.status,200);assert.equal(second.body.created,false);
  assert.equal(second.body.notificationId,first.body.notificationId);
  assert.equal(f.state().packNotifications.length,1);
  assert.equal(f.state().tasks.filter(t=>t.sourceType==='pack_notification').length,1);
});
