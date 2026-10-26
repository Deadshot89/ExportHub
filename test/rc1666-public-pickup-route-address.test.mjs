import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Readable} from 'node:stream';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const Module=require('node:module');
const config=JSON.parse(fs.readFileSync('staticwebapp.config.json','utf8'));
const pickup=fs.readFileSync('pickup.html','utf8');
const storeSource=fs.readFileSync('api/shared/pickup-store.js','utf8');

function pickupStore(){
 const original=Module._load;
 Module._load=function(name,parent,isMain){
  if(name==='@azure/storage-blob')return {BlobServiceClient:{fromConnectionString(){throw new Error('Pure address helper must not access storage')}}};
  return original.call(this,name,parent,isMain);
 };
 const id=require.resolve('../api/shared/pickup-store.js');
 delete require.cache[id];
 try{return require(id)}finally{Module._load=original}
}

test('RC1666: public QR route never falls back to either authenticated SPA',()=>{
 const testConfig=JSON.parse(fs.readFileSync('staticwebapp.testservice.config.json','utf8'));
 for(const [name,site] of [['PRODUCTION',config],['TESTSERVICE',testConfig]]){
  for(const route of ['/pickup','/pickup.html','/pickup/*','/pickup.html/*']){
   const entry=site.routes.find(r=>r.route===route);
   assert.ok(entry,name+': missing explicit public route '+route);
   assert.deepEqual(entry.allowedRoles,['anonymous']);
   if(route!=='/pickup.html')assert.equal(entry.rewrite,'/pickup.html');
   assert.ok(site.navigationFallback.exclude.includes(route),name+': index fallback for '+route);
   assert.match(entry.headers['Cache-Control'],/no-store/);
  }
 }
});

test('RC1666: public pickup page provides seal, three photos and ABD handover after counting',()=>{
 assert.match(pickup,/id="form" hidden/);
 assert.match(pickup,/pickup-status\?token=/);
 assert.match(pickup,/var pm=String\(u.pathname/);
 assert.match(pickup,/id="sealNumber"/);
 for(const id of ['containerPhotoLoaded','containerPhotoNumber','containerPhotoSealed','customsDocumentsConfirmed']){
  assert.ok(pickup.includes('id="'+id+'"'),id);
 }
 assert.ok(pickup.indexOf('id="colliSection"')<pickup.indexOf('id="containerSection"'));
 assert.match(pickup,/\[hidden\]\{display:none!important\}/);
});

test('RC1666: lookup of saved shipments rejects contradictory ID/reference',()=>{
 const address=storeSource.slice(storeSource.indexOf('async function resolveShipmentAddress'),storeSource.indexOf('function normalizeTransportMode'));
 const container=storeSource.slice(storeSource.indexOf('async function resolveShipmentContainerConfig'),storeSource.indexOf('function abdPresent'));
 for(const section of [address,container]){
  assert.match(section,/state\.savedShipments/);
  assert.match(section,/sid!==xid&&\!\(ref&&sid\.toUpperCase\(\)===ref\)/);
  assert.match(section,/if\(ref&&xref&&ref!==xref\)return false/);
 }
 assert.match(storeSource,/address:addressFromSource\(r\)\|\|''/);
});

test('RC1666: delivery address never degrades to a dash or standalone country',()=>{
 const store=pickupStore();
 assert.equal(store.addressFromSource({recipientAddress:'-',deliveryAddress:'Tor 2, Am Lager 5, 41334 Nettetal'}),'Tor 2, Am Lager 5, 41334 Nettetal');
 assert.equal(store.addressFromSource({address:'—',locationData:{street:'Hafenstraße 9',zip:'41460',city:'Neuss'}}),'Hafenstraße 9, 41460 Neuss');
 assert.equal(store.addressFromSource({recipientAddress:{street:'Logistikweg 8',postalCode:'47906',city:'Kempen'}}),'Logistikweg 8, 47906 Kempen');
 assert.equal(store.addressFromSource({address:'-',country:'DE'}),'');
 assert.equal(store.addressFromSource({address:'Alte Hauptadresse 1',locationData:{street:'Zustellort 7',postalCode:'41334',city:'Nettetal'}}),'Zustellort 7, 41334 Nettetal');
 assert.equal(store.addressFromSource({address:'Alte Hauptadresse 1',deliveryAddress:'Lieferweg 3'}),'Lieferweg 3');
});


test('RC1666: stale shipment copy does not mask valid saved address or required container evidence',async()=>{
 const team={
  state:{
   shipments:[
    {id:'SHIP-1',ref:'TEST123',recipientAddress:'-',containerDocumentationRequired:false},
    {id:'WRONG-SHIP',ref:'TEST123',recipientAddress:'Falsche Straße 99',containerDocumentationRequired:true}
   ],
   savedShipments:[
    {id:'SHIP-1',ref:'TEST123',deliveryAddress:{street:'Richtiger Weg 4',zip:'41334',city:'Nettetal'},transportMode:'sea',containerDocumentationRequired:true}
   ],
   customers:[{id:'C-1',name:'Kunde',address:'Hauptstraße 1'}]
  }
 };
 const original=Module._load;
 const previous=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='mock-only-for-test';
 const fakeBlob={
  async download(){return{readableStreamBody:Readable.from([Buffer.from(JSON.stringify(team))]),etag:'mock-1'}}
 };
 Module._load=function(name,parent,isMain){
  if(name==='@azure/storage-blob')return {
   BlobServiceClient:{fromConnectionString(){return{
    getContainerClient(){return{async createIfNotExists(){},getBlockBlobClient(){return fakeBlob}}}
   }}}
  };
  return original.call(this,name,parent,isMain)
 };
 const id=require.resolve('../api/shared/pickup-store.js');
 delete require.cache[id];
 let store;
 try{store=require(id)}finally{Module._load=original}
 try{
  const record={shipmentId:'SHIP-1',reference:'TEST123',address:'-'};
  assert.equal(await store.resolveShipmentAddress(record,'testservice'),'Richtiger Weg 4, 41334 Nettetal');
  const cfg=await store.resolveShipmentContainerConfig(record,'testservice');
  assert.equal(cfg.containerDocumentationRequired,true);
  assert.equal(cfg.transportMode,'sea');
 }finally{
  if(previous===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=previous;
 }
});


test('RC1666: already printed /?pickup=TOKEN QR bypasses the login SPA on both sites',()=>{
 const redirect=fs.readFileSync('assets/rc1666-public-pickup-query-redirect.js','utf8');
 const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 assert.match(builder,/if\(file==='index.html'\|\|file==='TESTVERSION.html'\)/);
 assert.match(builder,/injectImmediateRuntimeAfterHead\(html,'<script id="exporthub-rc1666-public-pickup-redirect">'\+redirect/);
 const lastFeaturePatch=builder.indexOf('html=patchTaskPlannerV2UiCutover(html,file);');
 const redirectInsertion=builder.indexOf("const redirect=fs.readFileSync(path.join(ROOT,'assets/rc1666-public-pickup-query-redirect.js')");
 const finalWrite=builder.indexOf('fs.writeFileSync(target,html);',lastFeaturePatch);
 assert.ok(lastFeaturePatch>=0&&lastFeaturePatch<redirectInsertion&&redirectInsertion<finalWrite,'QR redirect must be inserted after auth and other head modifications');
 assert.match(builder,/redirect not first executable head script/);
 const cases=[
  {base:'https://www.exporthub360.de',query:'/?pickup='+'a'.repeat(48),token:'a'.repeat(48)},
  {base:'https://example-testservice.azurestaticapps.net',query:'/?pickup='+'b'.repeat(48)+'&environment=testservice',token:'b'.repeat(48),env:'testservice'},
  {base:'https://www.exporthub360.de',query:'/?ehcmd=pickup&ref=ABCDEF12',token:'ABCDEF12'},
  {base:'https://www.exporthub360.de',query:'/?pickup=bad',token:'invalid'}
 ];
 for(const c of cases){
  const navigations=[];
  const location={href:c.base+c.query,replace(url){navigations.push(url)}};
  vm.runInNewContext(redirect,{window:{location},URL},{timeout:1000});
  assert.equal(navigations.length,1,c.query+': QR must be redirected');
  const target=new URL(navigations[0]);
  assert.equal(target.origin,c.base);
  assert.equal(target.pathname,'/pickup.html');
  assert.equal(target.searchParams.get('token'),c.token);
  assert.equal(target.searchParams.get('environment'),c.env||null);
 }
 for(const query of ['/', '/?view=dashboard', '/?token=unrelated-password-reset']){
  const navigations=[],location={href:'https://www.exporthub360.de'+query,replace(x){navigations.push(x)}};
  vm.runInNewContext(redirect,{window:{location},URL},{timeout:1000});
  assert.equal(navigations.length,0,'ordinary website login must be unchanged: '+query);
 }
});


test('RC1666: container photo and seal sync into saved-only shipment without touching duplicate reference',async()=>{
 const initial={revision:1,state:{
  shipments:[{id:'ANOTHER-SHIPMENT',ref:'TEST123',containerPhotos:[]}],
  savedShipments:[{id:'SHIP-1',ref:'TEST123',containerPhotos:[],subShipments:[{subShipmentId:'SUB-A',containerPhotos:[]}]}]
 }};
 let serialized=Buffer.from(JSON.stringify(initial)),writes=0;
 const blob={
  async download(){return{etag:'"etag-1"',readableStreamBody:Readable.from([serialized])}},
  async upload(raw){serialized=Buffer.from(raw);writes++;return{etag:'"etag-2"'}}
 };
 const previous=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING,original=Module._load;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='mock-only-for-test';
 Module._load=function(name,parent,isMain){
  if(name==='@azure/storage-blob')return{BlobServiceClient:{fromConnectionString(){return{
   getContainerClient(){return{async createIfNotExists(){},getBlockBlobClient(){return blob}}}
  }}}};
  return original.call(this,name,parent,isMain)
 };
 const id=require.resolve('../api/shared/pickup-store.js');delete require.cache[id];
 let store;try{store=require(id)}finally{Module._load=original}
 try{
  const result=await store.updateTeamContainerDocumentation({
   environment:'testservice',reference:'TEST123',shipmentId:'SHIP-1',subShipmentId:'SUB-A',
   sealNumber:'SEAL-123',containerDocumentationRequired:true,
   containerPhotos:[{kind:'loaded',blobName:'safe-photo-1'}]
  });
  assert.equal(writes,1);
  assert.equal(result.state.shipments[0].containerPhotos.length,0,'conflicting shipment ID must stay intact');
  const main=result.state.savedShipments[0],sub=main.subShipments[0];
  assert.equal(main.sealNumber,'SEAL-123');
  assert.equal(main.containerPhotos[0].blobName,'safe-photo-1');
  assert.equal(sub.containerPhotos[0].blobName,'safe-photo-1');
  assert.equal(main.containerDocumentationRequired,true);
  assert.equal(sub.containerDocumentationRequired,true);
  assert.equal(JSON.parse(serialized).revision,2);
  const stale=await store.updateTeamContainerDocumentation({
   environment:'testservice',reference:'TEST123',shipmentId:'SHIP-1',subShipmentId:'SUB-A',
   containerDocumentationRequired:false,containerPhotos:[]
  });
  assert.equal(writes,2);
  assert.equal(stale.state.savedShipments[0].containerDocumentationRequired,true,'stale QR snapshot cannot clear mandatory photo proof');
  assert.equal(stale.state.savedShipments[0].subShipments[0].containerDocumentationRequired,true);
 }finally{
  if(previous===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=previous;
 }
});

test('RC1666: container upload API accepts properly linked saved-only shipment',async()=>{
 const photo={kind:'loaded',blobName:'photos/safe-1'};
 const team={state:{shipments:[{id:'WRONG',ref:'TEST123',containerPhotos:[]}],savedShipments:[
  {id:'SHIP-1',ref:'TEST123',containerPhotos:[photo]}
 ]}};
 const real=Module._load,abs=require.resolve('../api/pickup-container-document/index.js');
 const mocked={
  '../shared/public-access-store':{resolve:async()=>({resourceKey:'test-access',environment:'testservice'})},
  '../shared/pickup-store':{
   body:()=>({token:'test-token',kind:'loaded',dataUrl:'image-placeholder'}),
   getRecord:async()=>({record:{shipmentId:'SHIP-1',reference:'TEST123'}}),
   expired:()=>false,
   now:()=>new Date().toISOString(),
   err:(code,message,status)=>Object.assign(new Error(message),{code,status}),
   mutateRecord:async(_key,_env,fn)=>fn({shipmentId:'SHIP-1',reference:'TEST123',environment:'testservice'}),
   updateTeamContainerDocumentation:async()=>team,
   json:(status,body)=>({status,body})
  },
  '../shared/container-document-store':{kindOf:v=>v,savePhoto:async()=>photo,publicPhoto:p=>p},
  '../shared/i18n':{t:(_req,v)=>v}
 };
 Module._load=function(request,parent,isMain){
  if(Object.prototype.hasOwnProperty.call(mocked,request))return mocked[request];
  return real.call(this,request,parent,isMain)
 };
 delete require.cache[abs];let handle;
 try{handle=require(abs)}finally{Module._load=real}
 const ctx={res:null},req={method:'POST'};
 await handle(ctx,req);
 assert.equal(ctx.res.status,200);
 assert.equal(ctx.res.body.linkedToShipment,true);
 assert.equal(ctx.res.body.storedUnderReference,true);
 // The same reference without a matching shipment ID must not pass verification.
 team.state.savedShipments[0].id='WRONG-SAVED-ID';
 const bad={res:null};await handle(bad,req);
 assert.equal(bad.res.status,503);
 assert.equal(bad.res.body.code,'CONTAINER_TEAM_SYNC_FAILED');
});


test('RC1666: confirmed pickup updates saved-only shipment, not a conflicting reference',async()=>{
 const initial={revision:4,state:{
  shipments:[{id:'UNRELATED',reference:'TEST123',status:'Erstellt'}],
  savedShipments:[{id:'SHIP-1',reference:'TEST123',status:'Bereit zur Abholung'}],
  tasks:[]
 }};
 let serialized=Buffer.from(JSON.stringify(initial)),writes=0;
 const blob={
  async download(){return{etag:'"old-etag"',readableStreamBody:Readable.from([serialized])}},
  async upload(raw){serialized=Buffer.from(raw);writes++;return{etag:'"new-etag"'}}
 };
 const original=Module._load,previous=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='mock-only-for-test';
 Module._load=function(name,parent,isMain){
  if(name==='@azure/storage-blob')return{BlobServiceClient:{fromConnectionString(){return{
   getContainerClient(){return{async createIfNotExists(){},getBlockBlobClient(){return blob}}}
  }}}};
  return original.call(this,name,parent,isMain)
 };
 const id=require.resolve('../api/shared/pickup-store.js');delete require.cache[id];
 let store;try{store=require(id)}finally{Module._load=original}
 try{
  await store.updateTeam({
   environment:'testservice',shipmentId:'SHIP-1',reference:'TEST123',expectedColliCount:1,
   pickupHistory:[{sequence:1,colliCount:1,confirmedAt:'2026-10-26T14:00:00Z',signatureBlobName:'pod/signed.png',complete:true}]
  });
  assert.equal(writes,1);
  const state=JSON.parse(serialized).state;
  assert.equal(state.shipments[0].status,'Erstellt','unrelated reused reference must remain unchanged');
  assert.equal(state.savedShipments[0].status,'Abgeholt','saved-only shipment must receive pickup state');
  assert.equal(state.savedShipments[0].pickupQrUsed,true);
  assert.equal(state.savedShipments[0].signatureAvailable,true);
 }finally{
  if(previous===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=previous;
 }
});


test('RC1666: legacy QR reference remains usable only with an unambiguous shipment identity',async()=>{
 let document={state:{shipments:[],savedShipments:[
  {id:'INTERNAL-UUID',ref:'LEGACY1',deliveryAddress:'Lagerweg 12, 47906 Kempen',containerDocumentationRequired:true}
 ]}};
 const blob={async download(){return{etag:'"etag"',readableStreamBody:Readable.from([Buffer.from(JSON.stringify(document))])}}};
 const orig=Module._load,previous=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='mock-only-for-test';
 Module._load=function(name,parent,isMain){
  if(name==='@azure/storage-blob')return{BlobServiceClient:{fromConnectionString(){return{
   getContainerClient(){return{async createIfNotExists(){},getBlockBlobClient(){return blob}}}
  }}}};
  return orig.call(this,name,parent,isMain)
 };
 const id=require.resolve('../api/shared/pickup-store.js');delete require.cache[id];let store;
 try{store=require(id)}finally{Module._load=orig}
 try{
  const legacy={environment:'testservice',shipmentId:'LEGACY1',reference:'LEGACY1',expectedColliCount:1,
   pickupHistory:[{colliCount:1,confirmedAt:'2026-10-26T14:00:00Z',signatureBlobName:'signed',complete:true}]};
  assert.equal(await store.resolveShipmentAddress(legacy,'testservice'),'Lagerweg 12, 47906 Kempen');
  assert.equal((await store.resolveShipmentContainerConfig(legacy,'testservice')).containerDocumentationRequired,true);
  document.state.shipments.push({id:'OTHER-UUID',ref:'LEGACY1',deliveryAddress:'Wrong Customer Street'});
  assert.equal(await store.resolveShipmentAddress(legacy,'testservice'),'','ambiguous old QR must not expose another shipment address');
  await assert.rejects(()=>store.updateTeam(legacy),x=>x&&x.code==='TEAM_SHIPMENT_AMBIGUOUS'&&x.status===409);
 }finally{
  if(previous===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=previous;
 }
});


test('RC1666: full pickup status and signed POD synchronize to both active and saved copies, never to another shipment',async()=>{
 const initial={revision:2,state:{
  shipments:[
   {id:'SHIP-1',ref:'MATCH88',status:'Erstellt',processStatus:'Erstellt'},
   {id:'OTHER-ID',ref:'MATCH88',status:'Erstellt',processStatus:'Erstellt'}
  ],
  savedShipments:[{id:'SHIP-1',ref:'MATCH88',status:'Erstellt',processStatus:'Erstellt'}],
  tasks:[
   {area:'Abholtag',linkedShipmentId:'SHIP-1',linkedShipmentRef:'MATCH88',status:'offen'},
   {area:'Abholtag',linkedShipmentId:'OTHER-ID',linkedShipmentRef:'MATCH88',status:'offen'}
  ]
 }};
 let serialized=Buffer.from(JSON.stringify(initial)),writes=0;
 const blob={
  async download(){return{etag:'"source"',readableStreamBody:Readable.from([serialized])}},
  async upload(raw){serialized=Buffer.from(raw);writes++;return{etag:'"dest"'}}
 };
 const original=Module._load,previous=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='mock-only-for-test';
 Module._load=function(name,parent,isMain){
  if(name==='@azure/storage-blob')return{BlobServiceClient:{fromConnectionString(){return{
   getContainerClient(){return{async createIfNotExists(){},getBlockBlobClient(){return blob}}}
  }}}};
  return original.call(this,name,parent,isMain)
 };
 const id=require.resolve('../api/shared/pickup-store.js');delete require.cache[id];
 let store;try{store=require(id)}finally{Module._load=original}
 try{
  await store.updateTeam({
   environment:'testservice',shipmentId:'SHIP-1',reference:'MATCH88',expectedColliCount:1,
   pickupHistory:[{sequence:1,colliCount:1,complete:true,confirmedAt:'2026-10-26T14:00:00Z',signatureBlobName:'pod/signed.png'}]
  });
  assert.equal(writes,1);
  const state=JSON.parse(serialized).state;
  assert.equal(state.shipments[0].status,'Abgeholt');
  assert.equal(state.savedShipments[0].status,'Abgeholt','saved copy no longer displays obsolete status');
  assert.equal(state.shipments[0].signatureAvailable,true);
  assert.equal(state.savedShipments[0].signatureAvailable,true);
  assert.equal(state.shipments[1].status,'Erstellt','other shipment with same reference must remain unchanged');
  assert.equal(state.tasks[0].status,'erledigt');
  assert.equal(state.tasks[1].status,'offen','other shipment task must not be completed');
 }finally{
  if(previous===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=previous;
 }
});


test('RC1666: exact multi-truck photo sync never writes to a missing or unrelated sub-shipment',async()=>{
 const initial={revision:1,state:{
  shipments:[{id:'SHIP-1',ref:'TRUCK55',containerPhotos:[],subShipments:[{subShipmentId:'SUB-A',containerPhotos:[]}]}],
  savedShipments:[
   {id:'SHIP-1',ref:'TRUCK55',containerPhotos:[],subShipments:[{subShipmentId:'SUB-A',containerPhotos:[]}]},
   {id:'OTHER-PARENT',ref:'OTHERREF',containerPhotos:[],subShipments:[{subShipmentId:'OTHER-TRUCK',containerPhotos:[]}]}
  ]
 }};
 let bytes=Buffer.from(JSON.stringify(initial)),writes=0;
 const blob={
  async download(){return{etag:'"v1"',readableStreamBody:Readable.from([bytes])}},
  async upload(data){bytes=Buffer.from(data);writes++;return{etag:'"v2"'}}
 };
 const orig=Module._load,previous=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='mock-only-for-test';
 Module._load=function(request,parent,isMain){
  if(request==='@azure/storage-blob')return{BlobServiceClient:{fromConnectionString(){return{
   getContainerClient(){return{async createIfNotExists(){},getBlockBlobClient(){return blob}}}
  }}}};
  return orig.call(this,request,parent,isMain)
 };
 const id=require.resolve('../api/shared/pickup-store.js');
 delete require.cache[id];
 let store;try{store=require(id)}finally{Module._load=orig}
 try{
  const photo={kind:'loaded',blobName:'photos/truck-A'};
  const record={environment:'testservice',shipmentId:'SHIP-1',reference:'TRUCK55',subShipmentId:'OTHER-TRUCK',containerPhotos:[photo]};
  await assert.rejects(()=>store.updateTeamContainerDocumentation(record),e=>e&&e.code==='SUBSHIPMENT_NOT_FOUND'&&e.status===409);
  assert.equal(writes,0,'wrong truck must not alter parent or sibling documents');
  assert.equal(JSON.parse(bytes).state.savedShipments[1].containerPhotos.length,0,'other parent must remain unchanged');
  record.subShipmentId='SUB-A';
  const result=await store.updateTeamContainerDocumentation(record);
  assert.equal(writes,1);
  for(const sh of [result.state.shipments[0],result.state.savedShipments[0]]){
   assert.equal(sh.containerPhotos[0].blobName,photo.blobName);
   assert.equal(sh.subShipments[0].containerPhotos[0].blobName,photo.blobName);
  }
 }finally{
  if(previous===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=previous;
 }
});

test('RC1666: container-upload API rejects parent-only proof when sub-shipment is missing',async()=>{
 const photo={kind:'loaded',blobName:'photos/sub-A'};
 const team={state:{shipments:[{
  id:'SHIP-1',ref:'TRUCK55',containerPhotos:[photo],
  subShipments:[{subShipmentId:'OTHER-TRUCK',containerPhotos:[]}]
 }]}};
 const real=Module._load,abs=require.resolve('../api/pickup-container-document/index.js');
 const mocked={
  '../shared/public-access-store':{resolve:async()=>({resourceKey:'test-access',environment:'testservice'})},
  '../shared/pickup-store':{
   body:()=>({token:'test-token',kind:'loaded',dataUrl:'placeholder'}),
   getRecord:async()=>({record:{shipmentId:'SHIP-1',reference:'TRUCK55',subShipmentId:'SUB-A'}}),
   expired:()=>false,now:()=>new Date().toISOString(),
   err:(code,message,status)=>Object.assign(new Error(message),{code,status}),
   mutateRecord:async(_key,_env,fn)=>fn({shipmentId:'SHIP-1',reference:'TRUCK55',subShipmentId:'SUB-A',environment:'testservice'}),
   updateTeamContainerDocumentation:async()=>team,
   json:(status,body)=>({status,body})
  },
  '../shared/container-document-store':{kindOf:v=>v,savePhoto:async()=>photo,publicPhoto:p=>p},
  '../shared/i18n':{t:(_req,v)=>v}
 };
 Module._load=function(request,parent,isMain){
  if(Object.prototype.hasOwnProperty.call(mocked,request))return mocked[request];
  return real.call(this,request,parent,isMain)
 };
 delete require.cache[abs];
 let handler;try{handler=require(abs)}finally{Module._load=real}
 const req={method:'POST'};
 const missing={res:null};await handler(missing,req);
 assert.equal(missing.res.status,503,'a parent photo must not confirm the wrong truck');
 assert.equal(missing.res.body.code,'CONTAINER_TEAM_SYNC_FAILED');
 team.state.shipments[0].subShipments[0].subShipmentId='SUB-A';
 const unlinked={res:null};await handler(unlinked,req);
 assert.equal(unlinked.res.status,503,'the correct truck must contain the exact uploaded photo');
 team.state.shipments[0].subShipments[0].containerPhotos=[photo];
 const verified={res:null};await handler(verified,req);
 assert.equal(verified.res.status,200);
 assert.equal(verified.res.body.linkedToShipment,true);
});
