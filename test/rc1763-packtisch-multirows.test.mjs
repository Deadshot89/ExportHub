import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const api=require('../api/pack-notification/index.js');
const store=require('../api/shared/pack-notification-store.js');
const file=path=>fs.readFileSync(path,'utf8');

test('RC1763 packers can explicitly add multiple separately typed packing rows on both public pack pages',()=>{
 const versions=[];
 for(const path of ['pack.html','assets/pack.html']){
  const html=file(path);
  assert.match(html,/id="packAddPackage"/,'the add row button must be visible');
  const tag=html.match(/<script\b[^>]*\bsrc="\/assets\/pack-notification\.js\?v=(\d+)"[^>]*><\/script>/);
  assert.ok(tag,'the current pack-notification client must be loaded with a versioned URL');
  const version=Number(tag[1]);
  assert.ok(Number.isSafeInteger(version)&&version>=7,'client cache version must never regress below RC1763 v7');
  versions.push(version);
 }
 assert.equal(versions[0],versions[1],'both public pack pages must load the same client revision');
 const js=file('assets/pack-notification.js');
 assert.match(js,/data-pack-type/,'each row needs its own canonical package selector');
 assert.match(js,/data-pack-remove/,'each line can be removed');
 assert.match(js,/els\.addPackage\.addEventListener\('click'/,'button must append a row');
 assert.match(js,/snapshotPackageRows\(\)/,'existing dimensions and selections must be preserved on add/remove');
 assert.match(js,/packageTypeId:entry\?entry\.id:''/,'per-line packaging master ID must reach backend');
});

test('RC1763 shipment creation carries each pack row type into the shipment editor',async()=>{
 const vm=await import('node:vm'),window={};
 vm.runInNewContext(file('assets/pack-notification-shipment.js'),{window,globalThis:window});
 const bridge=window.ExportHUBPackShipment;
 assert.ok(bridge,'shipment prefill bridge must be available');
 const prefill=bridge.shipmentPrefill({packageType:'Euro Palette',packageCount:2,totalWeight:150,packages:[
  {packageNo:1,packageType:'Euro Palette',length:120,width:80,height:140},
  {packageNo:2,packageType:'Transportkiste',length:60,width:40,height:50}
 ]});
 assert.deepEqual(Array.from(prefill.rows,x=>x.packaging),['Euro Palette','Transportkiste']);
 const grouped=bridge.shipmentRows(prefill);
 assert.deepEqual(Array.from(grouped,x=>x.type),['Euro Palette','Transportkiste']);
 assert.equal(grouped.length,2,'different packaging cannot be merged into one shipment row');
});

test('RC1763 API draft and submit normalize each row without losing packaging selection',()=>{
 const base={packageType:'Euro Palette',packageTypeId:'P1',packageCount:2,totalWeight:150,customer:'Testkunde',stationToken:'X',sessionId:'S',idempotencyKey:'I',documents:[{name:'ls.pdf',mimeType:'application/pdf',data:'data:application/pdf;base64,'+Buffer.from('%PDF-1.4\n%%EOF').toString('base64')}],packages:[
  {packageType:'Euro Palette',packageTypeId:'P1',length:120,width:80,height:140},
  {packageType:'Transportkiste',packageTypeId:'P2',length:60,width:40,height:50}
 ]};
 const draft=api.validateDraftPayload(base);
 const submit=api.validateSubmitPayload(base);
 for(const data of [draft,submit]){
  assert.equal(data.packages.length,2);
  assert.equal(data.packages[0].packageTypeId,'P1');
  assert.equal(data.packages[1].packageType,'Transportkiste');
  assert.equal(data.packages[1].packageTypeId,'P2');
 }
});

function setup(){
 const token='RC1763-PACK-QR',initial={packagingTypes:[
  {id:'P1',name:'Euro Palette',code:'E1',active:true,l:120,w:80,h:140},
  {id:'P2',name:'Transportkiste',code:'K2',active:true,l:60,w:40,h:50}
 ],packStations:[{id:'S1',name:'Packtisch 1',active:true,tokenHash:store.hashStationToken(token)}],packSessions:[],packNotifications:[],packDrafts:[],tasks:[]};
 let state=initial;
 const handler=api.createHandler({now:()=>new Date('2026-11-02T10:00:00Z'),notifyPush:null,
  mutateState:async(_env,mutator)=>{const output=await mutator(JSON.parse(JSON.stringify(state)));state=output.state;return output;}
 });
 const post=(action,body)=>handler({method:'POST',query:{action},headers:{host:'www.exporthub360.de'},body});
 return{token,post,state:()=>state};
}
test('RC1763 a draft reopens with two distinct canonical packaging rows and submit preserves them',async()=>{
 const f=setup(),s=await f.post('session',{stationToken:f.token});
 assert.equal(s.status,201,JSON.stringify(s.body));
 const packages=[{packageType:'Euro Palette',packageTypeId:'P1',length:120,width:80,height:140},{packageType:'Transportkiste',packageTypeId:'P2',length:60,width:40,height:50}];
 const draftPayload={customer:'Demo',packageType:'Euro Palette',packageTypeId:'P1',packageCount:2,totalWeight:150,packages,documents:[]};
 const saved=await f.post('draft-save',{stationToken:f.token,sessionId:s.body.sessionId,draft:draftPayload});
 assert.equal(saved.status,200,JSON.stringify(saved.body));
 assert.equal(saved.body.draft.packages[0].packageType,'Euro Palette');
 assert.equal(saved.body.draft.packages[1].packageType,'Transportkiste');
 assert.equal(saved.body.draft.packages[1].packagingTypeId,'P2');
 assert.ok(saved.body.draft.packages[1].packagingSnapshot,'server must snapshot package master data');
 const opened=await f.post('draft-get',{stationToken:f.token,draftId:saved.body.draft.id});
 assert.equal(opened.status,200);
 assert.deepEqual(opened.body.draft.packages.map(x=>x.packageType),['Euro Palette','Transportkiste']);
 const submitted=await f.post('submit',{stationToken:f.token,sessionId:s.body.sessionId,idempotencyKey:'RC1763',draftId:saved.body.draft.id,
  customer:'Demo',customerSource:'manual',packageType:'Euro Palette',packageTypeId:'P1',packageCount:2,totalWeight:150,packages,
  documents:[{name:'Lieferschein.pdf',mimeType:'application/pdf',data:'data:application/pdf;base64,'+Buffer.from('%PDF-1.4\n%%EOF').toString('base64')}]});
 assert.equal(submitted.status,201,JSON.stringify(submitted.body));
 assert.deepEqual(f.state().packNotifications[0].packages.map(x=>x.packageType),['Euro Palette','Transportkiste']);
 assert.equal(f.state().packNotifications[0].packages[1].packagingSnapshot.name,'Transportkiste');
});
test('RC1763 inactive packaging on an individual row cannot bypass server authorization',async()=>{
 const f=setup(),s=await f.post('session',{stationToken:f.token});
 const state=f.state();state.packagingTypes[1].active=false;
 const result=await f.post('draft-save',{stationToken:f.token,sessionId:s.body.sessionId,draft:{
  packageType:'Euro Palette',packageTypeId:'P1',packageCount:2,packages:[
   {packageType:'Euro Palette',packageTypeId:'P1',length:120,width:80,height:140},
   {packageType:'Transportkiste',packageTypeId:'P2',length:60,width:40,height:50}
  ]
 }});
 assert.equal(result.status,409,JSON.stringify(result.body));
 assert.equal(result.body.code,'PACK_PACKAGE_TYPE_INACTIVE');
 assert.equal(f.state().packDrafts.length,0);
});
