import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const modulePath=require.resolve('../api/shared/reference-folder-upload.js');
const names=['EXPORTHUB_GRAPH_TENANT_ID','EXPORTHUB_GRAPH_CLIENT_ID','EXPORTHUB_GRAPH_CLIENT_SECRET','EXPORTHUB_REFERENCE_DRIVE_ID','EXPORTHUB_REFERENCE_FOLDER_ID','EXPORTHUB_REFERENCE_DRIVE_USER'];

test('P0 AV: fehlender Graph-User wird vor dem Upload als REF-Zielkonfigurationsfehler erkannt',async()=>{
 const before=names.map(n=>process.env[n]),originalFetch=globalThis.fetch,urls=[];
 try{
  Object.assign(process.env,{EXPORTHUB_GRAPH_TENANT_ID:'test',EXPORTHUB_GRAPH_CLIENT_ID:'test',EXPORTHUB_GRAPH_CLIENT_SECRET:'test',EXPORTHUB_REFERENCE_DRIVE_USER:'missing@example.invalid'});
  delete process.env.EXPORTHUB_REFERENCE_DRIVE_ID;
  delete process.env.EXPORTHUB_REFERENCE_FOLDER_ID;
  delete require.cache[modulePath];
  const store=require(modulePath);
  globalThis.fetch=async url=>{
   const u=String(url);urls.push(u);
   if(u.includes('login.microsoftonline.com'))return{ok:true,status:200,json:async()=>({access_token:'synthetic',expires_in:3600})};
   return{ok:false,status:404,json:async()=>({error:{code:'Request_ResourceNotFound',message:'User not found'}})};
  };
  await assert.rejects(store.upload('ABC123','AV_ABC123.pdf',Buffer.from('%PDF-1.4'),'application/pdf'),e=>{
   assert.equal(e.code,'GRAPH_REFERENCE_USER_NOT_FOUND');
   assert.equal(e.status,503);
   assert.match(e.message,/SharePoint-Ziel/);
   return true;
  });
  assert.ok(urls.some(u=>u.includes('/users/')));
  assert.ok(urls.every(u=>!u.includes(':/content')),'ein ungültiger Benutzer darf keinen Dateischreibversuch auslösen');
 }finally{
  globalThis.fetch=originalFetch;
  names.forEach((n,i)=>before[i]===undefined?delete process.env[n]:process.env[n]=before[i]);
  delete require.cache[modulePath];
 }
});

test('P0 AV: API übergibt beim AV-Upload die Umgebung und bei REF-Downloads die SharePoint-Drive-ID',()=>{
 const api=fs.readFileSync('api/reference-files/index.js','utf8');
 assert.match(api,/referenceFolder\.upload\(ref,file\.name,file\.buffer,file\.mimeType,publicAccess\.environment\(req,payload\)\)/);
 assert.match(api,/url=target\?GRAPH_BASE\+'\/drives\/'\+encodeURIComponent\(target\.driveId\)/);
 assert.match(api,/referenceFolder\.getFolder\(ref,environment\)/);
});

test('P0 AV: Zuordnung der SharePoint-REF-Ziele bleibt eindeutig und TESTSERVICE getrennt',()=>{
 const store=require(modulePath);
 const before=names.map(n=>process.env[n]);
 const tests=['EXPORTHUB_TEST_REFERENCE_DRIVE_ID','EXPORTHUB_TEST_REFERENCE_FOLDER_ID'];
 const oldTest=tests.map(n=>process.env[n]);
 try{
  process.env.EXPORTHUB_REFERENCE_DRIVE_ID='prod-drive';
  process.env.EXPORTHUB_REFERENCE_FOLDER_ID='prod-folder';
  delete process.env.EXPORTHUB_TEST_REFERENCE_DRIVE_ID;
  delete process.env.EXPORTHUB_TEST_REFERENCE_FOLDER_ID;
  assert.deepEqual(store.exactTarget('production'),{driveId:'prod-drive',folderId:'prod-folder'});
  assert.throws(()=>store.exactTarget('testservice'),e=>e.code==='GRAPH_TEST_REFERENCE_TARGET_NOT_CONFIGURED');
  process.env.EXPORTHUB_TEST_REFERENCE_DRIVE_ID='prod-drive';
  process.env.EXPORTHUB_TEST_REFERENCE_FOLDER_ID='prod-folder';
  assert.throws(()=>store.exactTarget('testservice'),e=>e.code==='GRAPH_TEST_REFERENCE_TARGET_NOT_ISOLATED');
 }finally{
  names.forEach((n,i)=>before[i]===undefined?delete process.env[n]:process.env[n]=before[i]);
  tests.forEach((n,i)=>oldTest[i]===undefined?delete process.env[n]:process.env[n]=oldTest[i]);
 }
});
