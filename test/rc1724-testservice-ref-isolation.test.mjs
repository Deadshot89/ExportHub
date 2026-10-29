import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const moduleId=require.resolve('../api/shared/reference-folder-upload.js');
const keys=[
 'EXPORTHUB_GRAPH_TENANT_ID','EXPORTHUB_GRAPH_CLIENT_ID','EXPORTHUB_GRAPH_CLIENT_SECRET',
 'EXPORTHUB_REFERENCE_DRIVE_ID','EXPORTHUB_REFERENCE_FOLDER_ID',
 'EXPORTHUB_TEST_REFERENCE_DRIVE_ID','EXPORTHUB_TEST_REFERENCE_FOLDER_ID'
];
const image=Buffer.alloc(2048,1),fileName='01_Geladener_Container_ABC123.jpg';
const data=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});

test('RC1724: test photos never write to a production or implicit OneDrive root',async()=>{
 const envBefore=keys.map(key=>process.env[key]),oldFetch=globalThis.fetch;
 let calls=[];
 try{
  process.env.EXPORTHUB_GRAPH_TENANT_ID='synthetic-tenant';
  process.env.EXPORTHUB_GRAPH_CLIENT_ID='synthetic-client';
  process.env.EXPORTHUB_GRAPH_CLIENT_SECRET='test';
  process.env.EXPORTHUB_REFERENCE_DRIVE_ID='production-drive';
  process.env.EXPORTHUB_REFERENCE_FOLDER_ID='production-ref-root';
  delete process.env.EXPORTHUB_TEST_REFERENCE_DRIVE_ID;
  delete process.env.EXPORTHUB_TEST_REFERENCE_FOLDER_ID;
  delete require.cache[moduleId];
  const store=require(moduleId);
  globalThis.fetch=async(url,options={})=>{
   calls.push({url:String(url),method:options.method||'GET'});
   if(String(url).includes('/oauth2/'))return data(200,{access_token:'synthetic',expires_in:3600});
   const urlText=String(url);
   if(options.method==='PUT')return data(201,{id:'test-photo-item',name:fileName,size:image.length});
   if(urlText.includes('/items/test-ref-child/children'))return data(200,{value:[{id:'test-photo-item',name:fileName,file:{}}]});
   if(urlText.includes('/items/test-photo-item?'))return data(200,{
     id:'test-photo-item',name:fileName,size:image.length,
     parentReference:{id:'test-ref-child'},file:{mimeType:'image/jpeg'}
   });
   return data(200,{id:'test-ref-child',name:'ABC123',folder:{},parentReference:{id:'test-ref-root'}});
  };
  await assert.rejects(store.upload('ABC123',fileName,image,'image/jpeg','testservice'),
   e=>e.code==='GRAPH_TEST_REFERENCE_TARGET_NOT_CONFIGURED');
  assert.equal(calls.length,0,'missing test config must not request even an OAuth token');

  process.env.EXPORTHUB_TEST_REFERENCE_DRIVE_ID='production-drive';
  process.env.EXPORTHUB_TEST_REFERENCE_FOLDER_ID='production-ref-root';
  await assert.rejects(store.upload('ABC123',fileName,image,'image/jpeg','testservice'),
   e=>e.code==='GRAPH_TEST_REFERENCE_TARGET_NOT_ISOLATED');
  assert.equal(calls.length,0,'matching prod root must not touch Graph');

  process.env.EXPORTHUB_TEST_REFERENCE_DRIVE_ID='test-drive';
  process.env.EXPORTHUB_TEST_REFERENCE_FOLDER_ID='test-ref-root';
  const receipt=await store.upload('ABC123',fileName,image,'image/jpeg','testservice');
  assert.equal(receipt.id,'test-photo-item');
  assert.equal(receipt.reference,'ABC123');
  assert.ok(calls.some(x=>x.method==='PUT'&&x.url.includes('/drives/test-drive/items/test-ref-child:/')));
  assert.ok(calls.some(x=>x.method==='GET'&&x.url.includes('/drives/test-drive/items/test-photo-item?')));
  const listed=await store.listFiles('ABC123','testservice');
  assert.deepEqual(listed.map(item=>item.name),[fileName]);
  assert.ok(calls.some(x=>x.method==='GET'&&x.url.includes('/drives/test-drive/items/test-ref-child/children')));
  assert.ok(calls.filter(x=>x.url.includes('graph.microsoft.com')).every(x=>x.url.includes('/drives/test-drive/')),
   'every Graph data operation must use the test drive, never production or a personal OneDrive');
 }finally{
  globalThis.fetch=oldFetch;
  keys.forEach((key,i)=>envBefore[i]===undefined?delete process.env[key]:process.env[key]=envBefore[i]);
  delete require.cache[moduleId];
 }
});

test('RC1724: Container photo writer supplies its authoritative environment to REF storage',()=>{
 const source=fs.readFileSync(require.resolve('../api/shared/container-document-store.js'),'utf8');
 assert.match(source,/referenceFolder\.upload\(ref,name,parsed\.buffer,parsed\.mimeType,env\)/);
});

test('RC1724: missing isolated test target stops before writing an Azure blob',async()=>{
 const Module=require('node:module'),realLoad=Module._load,sourceId=require.resolve('../api/shared/container-document-store.js');
 const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
 let azureCalled=false;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='synthetic-connection';
 Module._load=function(id,parent,isMain){
  if(id==='@azure/storage-blob')return{BlobServiceClient:{fromConnectionString(){azureCalled=true;throw Error('no Azure access allowed')}}};
  if(id==='./reference-folder-upload')return{
   assertTargetForEnvironment(){const error=new Error('isolated test root required');error.code='GRAPH_TEST_REFERENCE_TARGET_NOT_CONFIGURED';error.status=503;throw error;},
   async upload(){throw Error('Graph upload must not run')}
  };
  return realLoad.call(this,id,parent,isMain);
 };
 try{
  delete require.cache[sourceId];
  const store=require(sourceId);
  await assert.rejects(store.savePhoto({
   environment:'testservice',reference:'ABC123',kind:'loaded',
   dataUrl:'data:image/jpeg;base64,'+image.toString('base64'),shipmentId:'E2E-SHIPMENT'
  }),error=>error.code==='GRAPH_TEST_REFERENCE_TARGET_NOT_CONFIGURED');
  assert.equal(azureCalled,false,'no orphan Azure photo must be created on misconfiguration');
 }finally{
  Module._load=realLoad;delete require.cache[sourceId];
  if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage;
 }
});
