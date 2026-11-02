import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Module=require('node:module');
const avCheck=require('../api/shared/av-check.js');

test('P0 AV: 1 Klick speichert Azure-AV, schließt Aufgabe trotz Graph User not found, REF-Download ist gebunden',async()=>{
 const previous={};const envKeys=['EXPORTHUB_STORAGE_CONNECTION_STRING','EXPORTHUB_GRAPH_TENANT_ID','EXPORTHUB_GRAPH_CLIENT_ID','EXPORTHUB_GRAPH_CLIENT_SECRET','EXPORTHUB_REFERENCE_DRIVE_USER','EXPORTHUB_REFERENCE_DRIVE_ID','EXPORTHUB_REFERENCE_FOLDER_ID'];
 for(const k of envKeys)previous[k]=process.env[k];
 const oldFetch=globalThis.fetch,oldLoad=Module._load,docBlobs=new Map();
 const token='AV-TEST-SESSION',hash=crypto.createHash('sha256').update(token).digest('hex');
 const state={shipments:[{id:'S1',ref:'ABC123',abdFiles:[{id:'ABD-1',name:'ABD_ABC123.pdf'}]}],
  tasks:[{id:'task:av-missing:ABC123',sourceType:'av_missing',sourceRef:'ABC123',linkedShipmentRef:'ABC123',status:'offen',done:false}]};
 const document={state,users:[{id:'U1',username:'warehouse',active:true,authVersion:0}]};
 const sessions={sessions:[{tokenHash:hash,userId:'U1',username:'warehouse',expiresAt:new Date(Date.now()+3600000).toISOString(),authVersion:0}]};
 const fakeBody=(x)=>({etag:'"fixture"',readableStreamBody:Readable.from([Buffer.from(JSON.stringify(x))])});
 const authBlob={download:async()=>fakeBody(sessions)};
 const teamBlob={download:async()=>fakeBody(document)};
 const archive={
  createIfNotExists:async()=>({}),
  getBlockBlobClient(name){return{
   async uploadData(buffer,opts){assert.equal(opts.conditions.ifNoneMatch,'*');docBlobs.set(name,{buffer:Buffer.from(buffer),type:opts.blobHTTPHeaders.blobContentType})},
   async downloadToBuffer(){const item=docBlobs.get(name);if(!item)throw new Error('Blob missing');return Buffer.from(item.buffer)}
  }},
  async *listBlobsFlat({prefix}){for(const [name,v] of docBlobs){if(name.startsWith(prefix))yield{name,properties:{contentLength:v.buffer.length,contentType:v.type}}}}
 };
 const sdk={BlobServiceClient:{fromConnectionString:()=>({getContainerClient(name){
  return name==='exporthub-documents'?archive:{getBlockBlobClient:path=>path==='auth-sessions.json'?authBlob:teamBlob};
 }})}};
 try{
  Object.assign(process.env,{EXPORTHUB_STORAGE_CONNECTION_STRING:'UseFakeStorage=true',
    EXPORTHUB_GRAPH_TENANT_ID:'tenant',EXPORTHUB_GRAPH_CLIENT_ID:'client',EXPORTHUB_GRAPH_CLIENT_SECRET:'secret',
    EXPORTHUB_REFERENCE_DRIVE_USER:'missing@example.invalid'});
  delete process.env.EXPORTHUB_REFERENCE_DRIVE_ID;delete process.env.EXPORTHUB_REFERENCE_FOLDER_ID;
  Module._load=function(request,parent,isMain){
   if(request==='@azure/storage-blob')return sdk;
   if(request==='../av-check/index'&&parent&&/api[/\\]reference-files[/\\]index\.js$/.test(parent.filename)){
    return{mutateTeamState:async(env,fn)=>{assert.equal(env,'production');return fn(state)}};
   }
   return oldLoad.call(this,request,parent,isMain);
  };
  delete require.cache[require.resolve('../api/shared/av-blob-store.js')];
  delete require.cache[require.resolve('../api/shared/reference-folder-upload.js')];
  delete require.cache[require.resolve('../api/reference-files/index.js')];
  const api=require('../api/reference-files/index.js');
  Module._load=oldLoad;
  const graphHits=[];
  globalThis.fetch=async url=>{
   const u=String(url);graphHits.push(u);
   return u.includes('login.microsoftonline.com')
    ?{ok:true,status:200,json:async()=>({access_token:'synthetic',expires_in:3600})}
    :{ok:false,status:404,json:async()=>({error:{message:'User not found'}})};
  };
  async function request(method,reference,extras={}){
   const context={res:null,log:{error(){}}};
   await api(context,{method,headers:{authorization:'Bearer '+token,host:'exporthub360.com'},
    query:{reference,...extras.query},body:extras.body||{}});
   return context.res;
  }
  const body={action:'upload-av',reference:'ABC123',fileName:'Ausgangsvermerk.pdf',
   data:Buffer.from('%PDF-1.4\nAV test\n%%EOF').toString('base64')};
  const uploaded=await request('POST','ABC123',{body});
  assert.equal(uploaded.status,200,uploaded.body);
  const success=JSON.parse(uploaded.body);
  assert.equal(success.ok,true);
  assert.equal(success.sharepointSaved,false);
  assert.equal(success.sharepointError,'GRAPH_REFERENCE_USER_NOT_FOUND');
  assert.equal(success.taskCompleted,true);
  assert.equal(success.closedTasks,1);
  assert.equal(state.tasks[0].done,true);
  assert.equal(state.tasks[0].status,'erledigt');
  assert.equal(docBlobs.size,1);
  assert.ok(graphHits.some(u=>u.includes('/users/')));
  const listed=await request('GET','ABC123');
  assert.equal(listed.status,200);
  const listing=JSON.parse(listed.body);
  assert.equal(listing.files.length,1);
  assert.equal(listing.files[0].id,success.file.id);
  assert.equal(listing.sharepointAvailable,false);
  const downloaded=await request('GET','ABC123',{query:{itemId:success.file.id}});
  assert.equal(downloaded.status,200);
  assert.equal(Buffer.from(downloaded.body).toString(),Buffer.from(body.data,'base64').toString());
  const archiveStore=require('../api/shared/av-blob-store.js');
  await assert.rejects(archiveStore.read('ABC123','testservice',success.file.id),e=>e.code==='AV_FILE_NOT_FOUND',
   'TESTSERVICE darf einen Produktions-AV nicht lesen');
  const crossRef=await request('GET','DEF456',{query:{itemId:success.file.id}});
  assert.equal(crossRef.status,404);
  assert.equal(JSON.parse(crossRef.body).code,'AV_FILE_NOT_FOUND');
  // Even with two required AVs, the first file must never falsely complete.
  const secondShipment=state.shipments[0];secondShipment.abdFiles.push({id:'ABD-2',name:'ABD_2.pdf'});
  state.tasks[0].done=false;state.tasks[0].completed=false;state.tasks[0].status='offen';
  const second=JSON.parse((await request('POST','ABC123',{body})).body);
  assert.equal(second.taskCompleted,true,'Two distinct AVs now satisfy two ABDs');
  assert.equal(docBlobs.size,2,'Same original filename must never overwrite earlier AV');
  assert.notEqual(success.file.id,second.file.id);
 }finally{
  Module._load=oldLoad;globalThis.fetch=oldFetch;
  for(const k of envKeys)previous[k]===undefined?delete process.env[k]:process.env[k]=previous[k];
  for(const path of ['../api/reference-files/index.js','../api/shared/av-blob-store.js','../api/shared/reference-folder-upload.js']){
   delete require.cache[require.resolve(path)];
  }
 }
});
