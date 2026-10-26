import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Readable} from 'node:stream';
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

test('RC1666: tokenized pickup QR routes never fall through to the login application',()=>{
 for(const route of ['/pickup','/pickup.html','/pickup/*','/pickup.html/*']){
  const entry=config.routes.find(r=>r.route===route);
  assert.ok(entry,'Missing explicit public route: '+route);
  assert.deepEqual(entry.allowedRoles,['anonymous']);
  if(route!=='/pickup.html')assert.equal(entry.rewrite,'/pickup.html');
  assert.ok(config.navigationFallback.exclude.includes(route),'Index fallback for '+route);
  assert.match(entry.headers['Cache-Control'],/no-store/);
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
  assert.match(section,/if\(sid&&xid&&sid!==xid\)return false/);
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
