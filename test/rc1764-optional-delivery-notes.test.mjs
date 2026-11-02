import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const api=require('../api/pack-notification/index.js');
const packStore=require('../api/shared/pack-notification-store.js');
const read=path=>fs.readFileSync(path,'utf8');

function fixture(){
 const token='RC1764-VALID-QR',initial={
  packStations:[{id:'P1',name:'Packtisch 1',tokenHash:packStore.hashStationToken(token),active:true}],
  packagingTypes:[{id:'EURO',name:'Euro Palette',code:'EURO',active:true,l:120,w:80,h:145}],
  packSessions:[],packDrafts:[],packNotifications:[],tasks:[]
 };
 let state=initial;
 const handler=api.createHandler({now:()=>new Date('2026-11-02T11:00:00Z'),notifyPush:null,
  mutateState:async(_environment,mutator)=>{const result=await mutator(JSON.parse(JSON.stringify(state)));state=result.state;return result;}
 });
 const post=(action,body)=>handler({method:'POST',query:{action},headers:{host:'www.exporthub360.de'},body});
 return{token,post,state:()=>state};
}
function shipment(token,sessionId,additional={}){
 return{stationToken:token,sessionId,idempotencyKey:'RC1764-NODOC',customer:'Demo Kunde',customerSource:'manual',
  packageType:'Euro Palette',packageTypeId:'EURO',packageCount:1,totalWeight:120,
  packages:[{packageType:'Euro Palette',packageTypeId:'EURO',length:120,width:80,height:145}],
  documents:[],deliveryNoteReference:'',...additional};
}
test('RC1764: submit without a Lieferschein still creates a Packmeldung and a task',async()=>{
 const f=fixture(),session=await f.post('session',{stationToken:f.token});
 assert.equal(session.status,201);
 const result=await f.post('submit',shipment(f.token,session.body.sessionId));
 assert.equal(result.status,201,JSON.stringify(result.body));
 assert.equal(result.body.created,true);
 assert.equal(f.state().packNotifications.length,1);
 assert.deepEqual(f.state().packNotifications[0].documents,[]);
 assert.equal(f.state().packNotifications[0].deliveryNoteReference,'');
 assert.equal(f.state().tasks.filter(x=>x.sourceType==='pack_notification').length,1);
});
test('RC1764: optional Lieferscheine work for saved drafts and omitted documents property',async()=>{
 const f=fixture(),session=await f.post('session',{stationToken:f.token});
 const draft={customer:'Demo Kunde',packageType:'Euro Palette',packageTypeId:'EURO',packageCount:1,totalWeight:120,
 packages:[{packageType:'Euro Palette',packageTypeId:'EURO',length:120,width:80,height:145}]};
 const saved=await f.post('draft-save',{stationToken:f.token,sessionId:session.body.sessionId,draft});
 assert.equal(saved.status,200,JSON.stringify(saved.body));
 assert.deepEqual(saved.body.draft.documents,[]);
 const reopened=await f.post('draft-get',{stationToken:f.token,draftId:saved.body.draft.id});
 assert.equal(reopened.status,200);
 const payload=shipment(f.token,session.body.sessionId,{draftId:saved.body.draft.id});
 delete payload.documents;
 const submitted=await f.post('submit',payload);
 assert.equal(submitted.status,201,JSON.stringify(submitted.body));
 assert.deepEqual(f.state().packNotifications[0].documents,[]);
 assert.equal(f.state().packDrafts[0].status,'submitted');
});
test('RC1764: optional does not disable document type or original-content validation',async()=>{
 const f=fixture(),session=await f.post('session',{stationToken:f.token});
 const metadata=await f.post('submit',shipment(f.token,session.body.sessionId,{documents:[{
   name:'LS.pdf',size:2500,mimeType:'application/pdf'
 }]}));
 assert.equal(metadata.status,400,JSON.stringify(metadata.body));
 assert.notEqual(metadata.body.code,'PACK_DOCUMENT_REQUIRED');
 assert.equal(f.state().packNotifications.length,0);
 const mismatch=await f.post('submit',shipment(f.token,session.body.sessionId,{documents:[{
   name:'LS.pdf',mimeType:'image/png',data:'data:image/png;base64,'+Buffer.from('not a pdf').toString('base64')
 }]}));
 assert.equal(mismatch.status,400,JSON.stringify(mismatch.body));
 assert.equal(mismatch.body.code,'PACK_DOCUMENT_TYPE_MISMATCH');
 assert.equal(f.state().packNotifications.length,0);
});
test('RC1764: pack pages and all translations describe delivery notes as optional',()=>{
 for(const path of ['pack.html','assets/pack.html']){
  const html=read(path);
  assert.match(html,/id="packDocumentsOptional"/);
  assert.doesNotMatch(html,/id="packDocuments"[^>]*\\srequired(?:\\s|>)/);
 }
 const js=read('assets/pack-notification.js');
 assert.match(js,/function valid\\(\\)/);
 assert.doesNotMatch(js,/return state\\.documents\\.length>0/);
 assert.doesNotMatch(js,/if\\(!documentsOk\\)items\\.push/);
 assert.match(js,/els\\.deliveryHelp\\.textContent=tr\\('pack\\.deliveryNotesHelp'\\)/);
 const root={};
 vm.runInNewContext(read('assets/i18n/pack-notification.js'),{window:root,globalThis:root});
 vm.runInNewContext(read('assets/i18n/pack-notification-draft-bridge.js'),{window:root,globalThis:root});
 vm.runInNewContext(read('assets/i18n/pack-notification-drafts.js'),{window:root,globalThis:root});
 vm.runInNewContext(read('assets/i18n/pack-notification-draft-contract.js'),{window:root,globalThis:root});
 for(const lang of ['de','en','pl','es','fr','it']){
  assert.ok(root.ExportHUBPackI18n.packs[lang]['pack.deliveryNotesHelp']);
  assert.ok(root.ExportHUBPackI18n.packs[lang]['pack.draft.deliveryRequirement']);
 }
});
