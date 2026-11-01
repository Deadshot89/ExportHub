import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const MODULE='../api/shared/reference-folder-upload.js';
const KEYS=[
 'EXPORTHUB_GRAPH_TENANT_ID','EXPORTHUB_GRAPH_CLIENT_ID','EXPORTHUB_GRAPH_CLIENT_SECRET',
 'EXPORTHUB_REFERENCE_DRIVE_ID','EXPORTHUB_REFERENCE_FOLDER_ID'
];
const config={EXPORTHUB_GRAPH_TENANT_ID:'synthetic-tenant',
 EXPORTHUB_GRAPH_CLIENT_ID:'synthetic-client',
 EXPORTHUB_GRAPH_CLIENT_SECRET:'test',
 EXPORTHUB_REFERENCE_DRIVE_ID:'sharepoint-drive-verified',
 EXPORTHUB_REFERENCE_FOLDER_ID:'shipment-root-verified'};
const reference='ABC123',fileName='POD_photo.jpg',pdf=Buffer.alloc(2048,7);
const REF={id:'ref-folder-verified',name:reference,folder:{},parentReference:{id:config.EXPORTHUB_REFERENCE_FOLDER_ID}};
const ITEM={id:'photo-verified',name:fileName,size:pdf.length,file:{mimeType:'image/jpeg'},parentReference:{id:REF.id}};
const response=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});

test('RC1723: exact SharePoint library mode uploads and independently reads back the real REF child without user drive',async()=>{
 const before=KEYS.map(k=>process.env[k]),oldFetch=globalThis.fetch,paths=[];
 try{
  for(const [key,value] of Object.entries(config))process.env[key]=value;
  const moduleFile=require.resolve(MODULE);delete require.cache[moduleFile];
  const store=require(moduleFile);
  globalThis.fetch=async(url,options={})=>{
   const u=String(url),method=options.method||'GET';paths.push(method+' '+u);
   if(u.includes('/oauth2/'))return response(200,{access_token:'synthetic',expires_in:3600});
   if(method==='PUT')return response(201,ITEM);
   if(u.includes('/items/'+encodeURIComponent(ITEM.id)+'?'))return response(200,ITEM);
   if(u.includes('/items/'+encodeURIComponent(REF.id)+'/children'))return response(200,{value:[{id:ITEM.id,name:fileName,file:{}}]});
   if(u.includes('/items/'+encodeURIComponent(config.EXPORTHUB_REFERENCE_FOLDER_ID)+':/ABC123?'))return response(200,REF);
   throw Error('Unexpected Graph URL '+u);
  };
  const result=await store.upload(reference,fileName,pdf,'image/jpeg');
  assert.equal(result.id,ITEM.id);
  const files=await store.listFiles(reference);
  assert.deepEqual(files.map(x=>x.name),[fileName]);
  assert.ok(paths.some(x=>x.includes('/drives/sharepoint-drive-verified/items/shipment-root-verified:/ABC123?')));
  assert.ok(paths.some(x=>x.includes('PUT ')&&x.includes('/drives/sharepoint-drive-verified/items/ref-folder-verified:/POD_photo.jpg:/content')));
  assert.ok(paths.some(x=>x.includes('/drives/sharepoint-drive-verified/items/photo-verified?')));
  assert.ok(paths.every(x=>!x.includes('/users/')),'exact drive mode must never silently use personal OneDrive');
 }finally{
  globalThis.fetch=oldFetch;
  KEYS.forEach((key,i)=>before[i]===undefined?delete process.env[key]:process.env[key]=before[i]);
  delete require.cache[require.resolve(MODULE)];
 }
});

test('RC1723: half-configured exact target fails closed without Graph requests',async()=>{
 const before=KEYS.map(k=>process.env[k]),oldFetch=globalThis.fetch;
 let calls=0;
 try{
  for(const [key,value] of Object.entries(config))process.env[key]=value;
  delete process.env.EXPORTHUB_REFERENCE_FOLDER_ID;
  const moduleFile=require.resolve(MODULE);delete require.cache[moduleFile];
  const store=require(moduleFile);
  globalThis.fetch=async()=>{calls++;throw Error('must not contact Graph');};
  await assert.rejects(store.upload(reference,fileName,pdf,'image/jpeg'),e=>e.code==='GRAPH_REFERENCE_EXACT_TARGET_INCOMPLETE');
  assert.equal(calls,0);
 }finally{
  globalThis.fetch=oldFetch;
  KEYS.forEach((key,i)=>before[i]===undefined?delete process.env[key]:process.env[key]=before[i]);
  delete require.cache[require.resolve(MODULE)];
 }
});

test('RC1723: unreadable exact root must not be mistaken for missing shipment; no folder writes',async()=>{
 const before=KEYS.map(k=>process.env[k]),oldFetch=globalThis.fetch,methods=[];
 try{
  for(const [key,value] of Object.entries(config))process.env[key]=value;
  const moduleFile=require.resolve(MODULE);delete require.cache[moduleFile];
  const store=require(moduleFile);
  globalThis.fetch=async(url,options={})=>{
   const method=options.method||'GET';
   // OAuth token acquisition uses POST; only Graph data writes are forbidden.
   if(String(url).includes('/oauth2/'))return response(200,{access_token:'synthetic',expires_in:3600});
   methods.push(method);
   return response(404,{error:{code:'ResourceNotFound'}});
  };
  await assert.rejects(store.upload(reference,fileName,pdf,'image/jpeg'),e=>e.code==='GRAPH_REFERENCE_EXACT_TARGET_UNREADABLE');
  await assert.rejects(store.listFiles(reference),e=>e.code==='GRAPH_REFERENCE_EXACT_TARGET_UNREADABLE');
  assert.ok(methods.every(method=>method!=='PUT'&&method!=='POST'),'unverified SharePoint root must block mutations');
 }finally{
  globalThis.fetch=oldFetch;
  KEYS.forEach((key,i)=>before[i]===undefined?delete process.env[key]:process.env[key]=before[i]);
  delete require.cache[require.resolve(MODULE)];
 }
});

test('RC1723: legacy user-drive mode remains the default when exact IDs are absent',async()=>{
 const before=KEYS.map(k=>process.env[k]),oldFetch=globalThis.fetch,urls=[];
 try{
  for(const [key,value] of Object.entries(config))process.env[key]=value;
  delete process.env.EXPORTHUB_REFERENCE_DRIVE_ID;
  delete process.env.EXPORTHUB_REFERENCE_FOLDER_ID;
  const moduleFile=require.resolve(MODULE);delete require.cache[moduleFile];
  const store=require(moduleFile);
  globalThis.fetch=async(url,options={})=>{
   const u=String(url);urls.push(u);
   if(u.includes('/oauth2/'))return response(200,{access_token:'synthetic',expires_in:3600});
   if(options.method==='PUT')return response(201,ITEM);
   if(u.includes('/drive/items/'+ITEM.id))return response(200,ITEM);
   if(u.includes('/drive/root:/')&&u.includes('/children'))return response(200,{value:[]});
   return response(200,REF);
  };
  const result=await store.upload(reference,fileName,pdf,'image/jpeg');
  assert.equal(result.id,ITEM.id);
  assert.ok(urls.some(x=>x.includes('/users/')&&x.includes('/drive/root:/')));
  assert.ok(urls.every(x=>!x.includes('/drives/sharepoint-drive-verified/')));
 }finally{
  globalThis.fetch=oldFetch;
  KEYS.forEach((key,i)=>before[i]===undefined?delete process.env[key]:process.env[key]=before[i]);
  delete require.cache[require.resolve(MODULE)];
 }
});
