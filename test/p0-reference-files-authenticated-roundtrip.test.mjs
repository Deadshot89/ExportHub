import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Module=require('node:module');

test('P0: authenticated REF list and nested PDF download work end-to-end, without cross-REF access',async()=>{
 const token='LOCAL-TEST-TOKEN-ONLY',hash=crypto.createHash('sha256').update(token).digest('hex');
 const pdf=Buffer.from('%PDF-1.4\nP0-9WX5K6-READONLY\n%%EOF');
 const expiry=new Date(Date.now()+3600000).toISOString();
 const auth={sessions:[{tokenHash:hash,userId:'U1',username:'warehouse',expiresAt:expiry,authVersion:0}]};
 const team={state:{},users:[{id:'U1',username:'warehouse',authVersion:0,active:true}]};
 const envKeys=['EXPORTHUB_STORAGE_CONNECTION_STRING','EXPORTHUB_GRAPH_TENANT_ID','EXPORTHUB_GRAPH_CLIENT_ID','EXPORTHUB_GRAPH_CLIENT_SECRET','EXPORTHUB_REFERENCE_FOLDER','EXPORTHUB_REFERENCE_DRIVE_USER'];
 const previous=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
 const oldFetch=globalThis.fetch,oldLoad=Module._load;
 const hits=[];
 const blob={download:async()=>({etag:'\"fixture\"',readableStreamBody:Readable.from([Buffer.from(JSON.stringify(auth))])})};
 const teamBlob={download:async()=>({etag:'\"fixture\"',readableStreamBody:Readable.from([Buffer.from(JSON.stringify(team))])})};
 const mockContainer={getBlockBlobClient:name=>name==='auth-sessions.json'?blob:teamBlob};
 const sdk={BlobServiceClient:{fromConnectionString:()=>({getContainerClient:()=>mockContainer})}};
 const res=(status,body)=>({status,ok:status>=200&&status<300,json:async()=>body,headers:{get:()=>null}});
 try{
  Object.assign(process.env,{
   EXPORTHUB_STORAGE_CONNECTION_STRING:'UseDevelopmentStorage=true',
   EXPORTHUB_GRAPH_TENANT_ID:'test-tenant',
   EXPORTHUB_GRAPH_CLIENT_ID:'test-client',
   EXPORTHUB_GRAPH_CLIENT_SECRET:'test-secret',
   EXPORTHUB_REFERENCE_FOLDER:'003 Export/ExportHub/Sendungen',
   EXPORTHUB_REFERENCE_DRIVE_USER:'service@example.invalid'
  });
  Module._load=function(name,parent,isMain){
   if(name==='@azure/storage-blob')return sdk;
   return oldLoad.call(this,name,parent,isMain);
  };
  delete require.cache[require.resolve('../api/reference-files/index.js')];
  const handler=require('../api/reference-files/index.js');
  Module._load=oldLoad;
  globalThis.fetch=async (url,options={})=>{
   url=String(url);hits.push(url);
   if(url.includes('login.microsoftonline.com/'))return res(200,{access_token:'test-graph-access',expires_in:3600});
   if(url.includes('/drive/root:/')&&url.includes('9WX5K6')&&url.includes('/children')){
    return res(200,{value:[{id:'SUBFOLDER',name:'Lieferscheine',folder:{}}]});
   }
   if(url.includes('/drive/items/SUBFOLDER/children'))return res(200,{value:[{id:'DOC-9WX5K6',name:'SIDE250071804.pdf',size:pdf.length,file:{mimeType:'application/pdf'}}]});
   if(url.includes('/drive/root:/')&&url.includes('OTHER1'))return res(200,{value:[]});
   if(url.includes('/drive/items/DOC-9WX5K6/content'))return {status:200,ok:true,arrayBuffer:async()=>Uint8Array.from(pdf).buffer,headers:{get:()=> 'application/pdf'}};
   throw new Error('Unexpected remote request: '+url);
  };
  async function request(reference,itemId){
   const context={res:null,log:{error(){}}};
   await handler(context,{method:'GET',headers:{authorization:'Bearer '+token},query:{reference,...itemId?{itemId,mode:'inline'}:{}}});
   return context.res;
  }
  const listed=await request('9WX5K6');
  assert.equal(listed.status,200);
  const parsed=JSON.parse(listed.body);
  assert.equal(parsed.available,true);
  assert.equal(parsed.folderMissing,false);
  assert.deepEqual(parsed.files.map(file=>file.name),['SIDE250071804.pdf']);
  const downloaded=await request('9WX5K6','DOC-9WX5K6');
  assert.equal(downloaded.status,200);
  assert.equal(downloaded.headers['Content-Type'],'application/pdf');
  assert.deepEqual(Buffer.from(downloaded.body),pdf);
  const denied=await request('OTHER1','DOC-9WX5K6');
  assert.equal(denied.status,404);
  assert.equal(JSON.parse(denied.body).code,'FILE_NOT_FOUND');
  assert.ok(hits.some(u=>u.includes('/drive/items/SUBFOLDER/children')));
  assert.ok(hits.some(u=>u.includes('/drive/items/DOC-9WX5K6/content')));
  assert.equal(hits.filter(u=>u.includes('/drive/items/DOC-9WX5K6/content')).length,1,'Cross-reference request may not download the other document');
 }finally{
  Module._load=oldLoad;
  globalThis.fetch=oldFetch;
  for(const key of envKeys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key]}
  delete require.cache[require.resolve('../api/reference-files/index.js')];
 }
});
