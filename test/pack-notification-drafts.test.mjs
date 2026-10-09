import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const packStore=require('../api/shared/pack-notification-store.js');
const api=require('../api/pack-notification/index.js');

function fixture(){
  const tokenA='PT01-draft-secret-token';
  const tokenB='PT02-draft-secret-token';
  let state={
    packStations:[
      {id:'PT01',name:'Packtisch 01',tokenHash:packStore.hashStationToken(tokenA),active:true},
      {id:'PT02',name:'Packtisch 02',tokenHash:packStore.hashStationToken(tokenB),active:true}
    ],
    packSessions:[],packNotifications:[],packDrafts:[],tasks:[]
  };
  const handler=api.createHandler({
    now:()=>new Date('2026-10-09T10:00:00.000Z'),
    rateLimit:()=>{},
    mutateState:async(_environment,mutator)=>{
      const result=await mutator(JSON.parse(JSON.stringify(state)));
      state=result.state;
      return result;
    }
  });
  return{tokenA,tokenB,handler,state:()=>state};
}
function request(action,body){return{method:'POST',query:{action},headers:{host:'www.exporthub360.de'},body};}
async function session(f,token){return(await f.handler(request('session',{stationToken:token}))).body.sessionId;}
function completePayload(token,sessionId,overrides={}){
  return{
    stationToken:token,sessionId,idempotencyKey:'idem-draft-001',customer:'BSH Hausgeräte',customerId:'bsh-1',customerAccount:'100200',customerSource:'master',
    deliveryNoteReference:'DNC3019222063',packageType:'Europalette',packageCount:2,totalWeight:680,
    packages:[{packageNo:1,length:120,width:80,height:140,unit:'cm'},{packageNo:2,length:120,width:80,height:140,unit:'cm'}],note:'',documents:[],...overrides
  };
}

test('draft-save persists an incomplete shipment without creating notification or task and another station can list it',async()=>{
  const f=fixture();
  const sid=await session(f,f.tokenA);
  const saved=await f.handler(request('draft-save',{
    stationToken:f.tokenA,sessionId:sid,
    draft:{customer:'BSH Hausgeräte',deliveryNoteReference:'DNC3019222063',packageType:'Europalette',packageCount:3,totalWeight:0,packages:[],documents:[]}
  }));
  assert.equal(saved.status,200);
  assert.match(saved.body.draft.id,/^[a-f0-9-]{32,}$/i);
  assert.equal(f.state().packNotifications.length,0);
  assert.equal(f.state().tasks.length,0);

  const listed=await f.handler(request('draft-list',{stationToken:f.tokenB}));
  assert.equal(listed.status,200);
  assert.equal(listed.body.drafts.length,1);
  assert.equal(listed.body.drafts[0].customer,'BSH Hausgeräte');
  assert.equal(listed.body.drafts[0].deliveryNoteReference,'DNC3019222063');
  assert.equal(listed.body.drafts[0].packageCount,3);
});

test('draft-save updates the same draft and draft-get restores the saved form data',async()=>{
  const f=fixture();
  const sid=await session(f,f.tokenA);
  const first=await f.handler(request('draft-save',{stationToken:f.tokenA,sessionId:sid,draft:{customer:'Kunde A',packageType:'Europalette',packageCount:1,totalWeight:100,packages:[],documents:[]}}));
  const id=first.body.draft.id;
  const second=await f.handler(request('draft-save',{stationToken:f.tokenA,sessionId:sid,draft:{id,customer:'Kunde A',deliveryNoteReference:'DNC999',packageType:'Europalette',packageCount:4,totalWeight:400,packages:[],documents:[]}}));
  assert.equal(second.body.draft.id,id);
  assert.equal(f.state().packDrafts.length,1);
  const loaded=await f.handler(request('draft-get',{stationToken:f.tokenB,draftId:id}));
  assert.equal(loaded.status,200);
  assert.equal(loaded.body.draft.packageCount,4);
  assert.equal(loaded.body.draft.deliveryNoteReference,'DNC999');
});

test('non-Essentra shipment can be submitted with typed DNC and without an uploaded delivery note',async()=>{
  const f=fixture();
  const sid=await session(f,f.tokenA);
  const res=await f.handler(request('submit',completePayload(f.tokenA,sid)));
  assert.equal(res.status,201);
  assert.equal(f.state().packNotifications[0].deliveryNoteReference,'DNC3019222063');
  assert.deepEqual(f.state().packNotifications[0].documents,[]);
});

test('non-Essentra shipment still requires either a DNC/reference or at least one document',async()=>{
  const f=fixture();
  const sid=await session(f,f.tokenA);
  const res=await f.handler(request('submit',completePayload(f.tokenA,sid,{deliveryNoteReference:'',documents:[]})));
  assert.equal(res.status,400);
  assert.equal(res.body.code,'PACK_DELIVERY_NOTE_OR_DOCUMENT_REQUIRED');
});

test('Essentra shipment can be submitted without DNC/reference and without delivery-note upload',async()=>{
  const f=fixture();
  const sid=await session(f,f.tokenA);
  const res=await f.handler(request('submit',completePayload(f.tokenA,sid,{
    customer:'Essentra Components GmbH',customerId:'essentra-de',customerAccount:'9000003004',deliveryNoteReference:'',documents:[]
  })));
  assert.equal(res.status,201);
  assert.equal(f.state().packNotifications[0].customer,'Essentra Components GmbH');
});

test('submitting an existing draft closes it so it disappears from the open-draft overview',async()=>{
  const f=fixture();
  const sid=await session(f,f.tokenA);
  const saved=await f.handler(request('draft-save',{stationToken:f.tokenA,sessionId:sid,draft:{customer:'BSH Hausgeräte',deliveryNoteReference:'DNC3019222063',packageType:'Europalette',packageCount:2,totalWeight:680,packages:[],documents:[]}}));
  const draftId=saved.body.draft.id;
  const res=await f.handler(request('submit',completePayload(f.tokenA,sid,{draftId})));
  assert.equal(res.status,201);
  const listed=await f.handler(request('draft-list',{stationToken:f.tokenB}));
  assert.equal(listed.body.drafts.length,0);
  assert.equal(f.state().packDrafts.find(x=>x.id===draftId).status,'submitted');
});

test('public QR page starts with a new-shipment action and warehouse-wide open-draft cards and keeps delivery-note upload optional',()=>{
  const html=fs.readFileSync('pack.html','utf8');
  const client=fs.readFileSync('assets/pack-notification.js','utf8');
  assert.match(html,/id="packHome"/);
  assert.match(html,/id="packNewShipment"/);
  assert.match(html,/id="packDraftGrid"/);
  assert.match(html,/id="packSaveDraft"/);
  assert.match(html,/id="packDeliveryNoteReference"/);
  assert.doesNotMatch(html,/id="packDocuments"[^>]*\srequired(?:\s|>)/);
  assert.match(client,/draft-list/);
  assert.match(client,/draft-save/);
  assert.match(client,/draft-get/);
  assert.match(client,/Anzahl Paletten/);
});
