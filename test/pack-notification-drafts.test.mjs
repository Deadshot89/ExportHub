import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const packStore=require('../api/shared/pack-notification-store.js');
const api=require('../api/pack-notification/index.js');

function fixture(){
  const tokenA='PT01-draft-secret-token',tokenB='PT02-draft-secret-token';
  let state={packStations:[{id:'PT01',name:'Packtisch 01',tokenHash:packStore.hashStationToken(tokenA),active:true},{id:'PT02',name:'Packtisch 02',tokenHash:packStore.hashStationToken(tokenB),active:true}],packSessions:[],packNotifications:[],packDrafts:[],tasks:[]};
  const handler=api.createHandler({now:()=>new Date('2026-10-09T10:00:00.000Z'),rateLimit:()=>{},readState:async()=>JSON.parse(JSON.stringify(state)),mutateState:async(_environment,mutator)=>{const result=await mutator(JSON.parse(JSON.stringify(state)));state=result.state;return result;}});
  return{tokenA,tokenB,handler,state:()=>state};
}
function request(action,body){return{method:'POST',query:{action},headers:{host:'www.exporthub360.de'},body};}
async function session(f,token){return(await f.handler(request('session',{stationToken:token}))).body.sessionId;}
function pdf(name='DNC3019222063.pdf'){return{id:'doc-1',name,mimeType:'application/pdf',size:14,data:'data:application/pdf;base64,JVBERi0xLjQKJSVFT0Y='};}
function completePayload(token,sessionId,overrides={}){return{stationToken:token,sessionId,idempotencyKey:'idem-draft-001',customer:'BSH Hausgeräte',customerId:'bsh-1',customerAccount:'100200',customerSource:'master',deliveryNoteReference:'DNC3019222063.pdf',packageType:'Europalette',packageCount:2,totalWeight:680,packages:[{packageNo:1,length:120,width:80,height:140,unit:'cm'},{packageNo:2,length:120,width:80,height:140,unit:'cm'}],note:'',documents:[pdf()],...overrides};}

test('draft-save persists an incomplete shipment without creating notification or task and another station can list it',async()=>{
  const f=fixture(),sid=await session(f,f.tokenA);
  const saved=await f.handler(request('draft-save',{stationToken:f.tokenA,sessionId:sid,draft:{customer:'BSH Hausgeräte',packageType:'Europalette',packageCount:3,totalWeight:0,packages:[],documents:[]}}));
  assert.equal(saved.status,200,JSON.stringify(saved.body));
  assert.match(saved.body.draft.id,/^[a-f0-9-]{32,}$/i);
  assert.equal(f.state().packNotifications.length,0);assert.equal(f.state().tasks.length,0);
  const listed=await f.handler(request('draft-list',{stationToken:f.tokenB}));
  assert.equal(listed.status,200,JSON.stringify(listed.body));assert.equal(listed.body.drafts.length,1);assert.equal(listed.body.drafts[0].customer,'BSH Hausgeräte');assert.equal(listed.body.drafts[0].packageCount,3);
});

test('draft-save updates the same draft and draft-get restores the saved form data',async()=>{
  const f=fixture(),sid=await session(f,f.tokenA);
  const first=await f.handler(request('draft-save',{stationToken:f.tokenA,sessionId:sid,draft:{customer:'Kunde A',packageType:'Europalette',packageCount:1,totalWeight:100,packages:[],documents:[]}}));
  assert.equal(first.status,200,JSON.stringify(first.body));const id=first.body.draft.id;
  const second=await f.handler(request('draft-save',{stationToken:f.tokenA,sessionId:sid,draft:{id,customer:'Kunde A',packageType:'Europalette',packageCount:4,totalWeight:400,packages:[],documents:[pdf('SIDE250071282.pdf')]}}));
  assert.equal(second.status,200,JSON.stringify(second.body));assert.equal(second.body.draft.id,id);assert.equal(f.state().packDrafts.length,1);
  const loaded=await f.handler(request('draft-get',{stationToken:f.tokenB,draftId:id}));
  assert.equal(loaded.status,200,JSON.stringify(loaded.body));assert.equal(loaded.body.draft.packageCount,4);assert.equal(loaded.body.draft.documents.length,1);
});

test('draft delivery-note files use the central blob document storage path',()=>{const documents=require('../api/shared/document-blob-store.js');assert.ok(documents.ROOT_COLLECTIONS.includes('packDrafts'));});

test('submit stays fail-closed when no delivery-note document is uploaded',async()=>{
  const f=fixture(),sid=await session(f,f.tokenA);
  const res=await f.handler(request('submit',completePayload(f.tokenA,sid,{documents:[],deliveryNoteReference:'DNC3019222063'})));
  assert.equal(res.status,400,JSON.stringify(res.body));assert.equal(res.body.code,'PACK_DOCUMENT_REQUIRED');
});

test('submit accepts the current upload contract and persists the notification',async()=>{
  const f=fixture(),sid=await session(f,f.tokenA);
  const res=await f.handler(request('submit',completePayload(f.tokenA,sid)));
  assert.equal(res.status,201,JSON.stringify(res.body));assert.equal(f.state().packNotifications.length,1);assert.equal(f.state().packNotifications[0].documents.length,1);
});

test('Essentra submit also keeps the current mandatory delivery-note upload contract',async()=>{
  const f=fixture(),sid=await session(f,f.tokenA);
  const res=await f.handler(request('submit',completePayload(f.tokenA,sid,{customer:'Essentra Components GmbH',customerId:'essentra-de',customerAccount:'9000003004',documents:[],deliveryNoteReference:''})));
  assert.equal(res.status,400,JSON.stringify(res.body));assert.equal(res.body.code,'PACK_DOCUMENT_REQUIRED');
});

test('submitting an existing draft closes it so it disappears from the open-draft overview',async()=>{
  const f=fixture(),sid=await session(f,f.tokenA);
  const saved=await f.handler(request('draft-save',{stationToken:f.tokenA,sessionId:sid,draft:{customer:'BSH Hausgeräte',packageType:'Europalette',packageCount:2,totalWeight:680,packages:[],documents:[pdf()]}}));
  assert.equal(saved.status,200,JSON.stringify(saved.body));const draftId=saved.body.draft.id;
  const res=await f.handler(request('submit',completePayload(f.tokenA,sid,{draftId})));
  assert.equal(res.status,201,JSON.stringify(res.body));const listed=await f.handler(request('draft-list',{stationToken:f.tokenB}));assert.equal(listed.body.drafts.length,0);assert.equal(f.state().packDrafts.find(x=>x.id===draftId).status,'submitted');
});

test('public QR page keeps draft actions while preserving the current mandatory delivery-note upload contract',()=>{
  const html=fs.readFileSync('pack.html','utf8'),client=fs.readFileSync('assets/pack-notification.js','utf8'),draftI18n=fs.readFileSync('assets/i18n/pack-notification-drafts.js','utf8');
  assert.match(html,/id="packHome"/);assert.match(html,/id="packNewShipment"/);assert.match(html,/id="packDraftGrid"/);assert.match(html,/id="packSaveDraft"/);
  assert.doesNotMatch(html,/id="packDeliveryNoteReference"/);
  assert.match(html,/id="packDocuments"[^>]*\srequired(?:\s|>)/);
  assert.doesNotMatch(client,/packDeliveryNoteReference/);
  assert.match(client,/draft-list/);assert.match(client,/draft-save/);assert.match(client,/draft-get/);assert.match(draftI18n,/Anzahl Paletten/);
});

test('RC1499 read-only pack actions do not write the shared team state',async()=>{
  const token='PT01-read-only-token';
  const state={
    packStations:[{id:'PT01',name:'Packtisch 01',tokenHash:packStore.hashStationToken(token),active:true}],
    packDrafts:[{id:'draft-read-1',status:'draft',customer:'Kunde A',packageType:'Europalette',packageCount:2,totalWeight:680,packages:[],documents:[]}],
    customers:[{id:'c-1',account:'100200',name:'Kunde A'}],
    colliTypes:[{name:'Europalette',length:120,width:80,height:140}]
  };
  let writes=0;
  const handler=api.createHandler({
    now:()=>new Date('2026-10-13T08:00:00.000Z'),
    rateLimit:()=>{},
    readState:async()=>JSON.parse(JSON.stringify(state)),
    mutateState:async()=>{writes++;throw Object.assign(new Error('read path attempted a state write'),{status:500,statusCode:500,code:'UNEXPECTED_WRITE'});}
  });
  const cases=[
    request('customer-search',{stationToken:token,query:'Kunde'}),
    request('packaging-list',{stationToken:token}),
    request('draft-list',{stationToken:token}),
    request('draft-get',{stationToken:token,draftId:'draft-read-1'})
  ];
  for(const req of cases){const res=await handler(req);assert.equal(res.status,200,JSON.stringify(res.body));}
  assert.equal(writes,0,'read-only pack actions must not increment the shared-state revision or contend on its ETag');
});

test('RC1499 storage precondition conflicts are returned as a stable pack concurrency error, not raw Azure 412',async()=>{
  const token='PT01-conflict-token';
  const conflict=Object.assign(new Error('ConditionNotMet'),{status:412,statusCode:412,code:'ConditionNotMet'});
  const handler=api.createHandler({now:()=>new Date('2026-10-13T08:00:00.000Z'),rateLimit:()=>{},mutateState:async()=>{throw conflict;}});
  const res=await handler(request('session',{stationToken:token}));
  assert.equal(res.status,409,JSON.stringify(res.body));
  assert.equal(res.body.code,'PACK_CONCURRENT_UPDATE');
});
