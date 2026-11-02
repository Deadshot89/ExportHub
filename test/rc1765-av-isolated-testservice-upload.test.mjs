import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Module=require('node:module');

test('RC1765: isolated TESTSERVICE login uploads and closes AV task only in test storage',async()=>{
 const envKeys=['EXPORTHUB_STORAGE_CONNECTION_STRING','EXPORTHUB_TEST_STORAGE_CONNECTION_STRING','EXPORTHUB_TEST_AUTH_ISOLATION','EXPORTHUB_TEST_AUTH_BLOB','EXPORTHUB_TEST_STORAGE_BLOB','EXPORTHUB_TEST_STORAGE_CONTAINER','EXPORTHUB_GRAPH_TENANT_ID','EXPORTHUB_GRAPH_CLIENT_ID','EXPORTHUB_GRAPH_CLIENT_SECRET','EXPORTHUB_TEST_REFERENCE_DRIVE_ID','EXPORTHUB_TEST_REFERENCE_FOLDER_ID'];
 const previous=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 const originalLoad=Module._load, originalFetch=globalThis.fetch;
 const prodCs='DefaultEndpointsProtocol=https;AccountName=exporthubprodtest;AccountKey=fixture;EndpointSuffix=core.windows.net';
 const testCs='DefaultEndpointsProtocol=https;AccountName=exporthubisolatedtest;AccountKey=fixture;EndpointSuffix=core.windows.net';
 const files=new Map(),used=[];
 const key=(cs,container,name)=>cs+'|'+container+'|'+name;
 const put=(cs,container,name,value)=>files.set(key(cs,container,name),{
  bytes:Buffer.isBuffer(value)?Buffer.from(value):Buffer.from(JSON.stringify(value)),
  etag:'"fixture-'+crypto.randomBytes(4).toString('hex')+'"',
  type:Buffer.isBuffer(value)?'application/pdf':'application/json'
 });
 const token='ISOLATED-AV-SESSION',hash=crypto.createHash('sha256').update(token).digest('hex');
 put(testCs,'exporthub-data','testservice/auth-sessions.json',{sessions:[{
  tokenHash:hash,userId:'TEST-USER',username:'testworker',
  expiresAt:new Date(Date.now()+60*60*1000).toISOString(),authVersion:0,environment:'testservice'
 }]});
 put(testCs,'exporthub-data','testservice/team-state.json',{
  schemaVersion:3,revision:1,users:[{id:'TEST-USER',user:'testworker',name:'Testworker',active:true,authVersion:0}],
  state:{shipments:[{id:'TEST-SHIP',ref:'ABC123',abdFiles:[{id:'ABD-TEST-1',name:'ABD_ABC123.pdf'}]}],
    tasks:[{id:'task:av-missing:ABC123',sourceType:'av_missing',sourceRef:'ABC123',linkedShipmentRef:'ABC123',status:'offen',done:false,completed:false}]}
 });
 put(prodCs,'exporthub-data','auth-sessions.json',{sessions:[]});
 put(prodCs,'exporthub-data','team-state.json',{
  schemaVersion:3,users:[{id:'PROD-USER',user:'prodworker',active:true,authVersion:0}],
  state:{shipments:[],tasks:[]}
 });
 const sdk={BlobServiceClient:{fromConnectionString(cs){return{getContainerClient(container){return{
  async createIfNotExists(){return{}},
  getBlockBlobClient(name){
   const path=key(cs,container,name);
   return{
    name,
    async download(){used.push({operation:'read',cs,container,name});const x=files.get(path);
      if(!x){const e=new Error('Blob not found');e.statusCode=404;throw e}
      return{etag:x.etag,readableStreamBody:Readable.from([Buffer.from(x.bytes)])}},
    async downloadToBuffer(){used.push({operation:'downloadBytes',cs,container,name});const x=files.get(path);
      if(!x){const e=new Error('Blob not found');e.statusCode=404;throw e}return Buffer.from(x.bytes)},
    async upload(text,length,opts){assert.equal(Buffer.byteLength(text),length);
      used.push({operation:'write',cs,container,name});put(cs,container,name,Buffer.from(text))},
    async uploadData(bytes,opts){assert.equal(opts.conditions.ifNoneMatch,'*');
      used.push({operation:'writeBytes',cs,container,name});put(cs,container,name,Buffer.from(bytes))}
   }
  },
  async *listBlobsFlat({prefix}){used.push({operation:'list',cs,container,prefix});
   for(const [k,v] of files){const front=cs+'|'+container+'|';
     if(k.startsWith(front)&&k.slice(front.length).startsWith(prefix))
      yield{name:k.slice(front.length),properties:{contentLength:v.bytes.length,contentType:v.type}}}
  }
 }}}}}};
 try{
  Object.assign(process.env,{
   EXPORTHUB_STORAGE_CONNECTION_STRING:prodCs,EXPORTHUB_TEST_STORAGE_CONNECTION_STRING:testCs,
   EXPORTHUB_TEST_AUTH_ISOLATION:'enabled'
  });
  for(const k of ['EXPORTHUB_TEST_AUTH_BLOB','EXPORTHUB_TEST_STORAGE_BLOB','EXPORTHUB_TEST_STORAGE_CONTAINER','EXPORTHUB_TEST_REFERENCE_DRIVE_ID','EXPORTHUB_TEST_REFERENCE_FOLDER_ID'])delete process.env[k];
  Module._load=function(request,parent,isMain){
   if(request==='@azure/storage-blob')return sdk;
   return originalLoad.call(this,request,parent,isMain);
  };
  const modulePaths=['../api/shared/auth-store.js','../api/shared/av-blob-store.js','../api/av-check/index.js','../api/reference-files/index.js'];
  modulePaths.forEach(p=>delete require.cache[require.resolve(p)]);
  const api=require('../api/reference-files/index.js');
  Module._load=originalLoad;
  globalThis.fetch=async()=>{throw new Error('Graph should not be contacted for isolated TESTSERVICE without target')};
  async function request(host,method,query={},body={}){
   const context={res:null,log:{error(){}}};
   await api(context,{method,headers:{host,'x-exporthub-token':token},query,body});
   return context.res;
  }
  const testHost='ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';
  const productionHost='wonderful-forest-0f315e310.7.azurestaticapps.net';
  const payload={action:'upload-av',reference:'ABC123',fileName:'AV_ABC123.pdf',
   data:Buffer.from('%PDF-1.4\nIsolated AV test\n%%EOF').toString('base64')};
  const response=await request(testHost,'POST',{},payload);
  assert.equal(response.status,200,response.body);
  const body=JSON.parse(response.body);
  assert.equal(body.ok,true);
  assert.equal(body.reference,'ABC123');
  assert.equal(body.taskCompleted,true);
  assert.equal(body.closedTasks,1);
  assert.equal(body.sharepointSaved,false);
  const testTeam=JSON.parse(files.get(key(testCs,'exporthub-data','testservice/team-state.json')).bytes.toString());
  assert.equal(testTeam.state.tasks[0].done,true);
  const prodTeam=JSON.parse(files.get(key(prodCs,'exporthub-data','team-state.json')).bytes.toString());
  assert.deepEqual(prodTeam.state.tasks,[]);
  assert.equal([...files.keys()].filter(k=>k.startsWith(testCs+'|exporthub-documents|av-v1/testservice/ABC123/')).length,1);
  assert.equal([...files.keys()].filter(k=>k.startsWith(prodCs+'|exporthub-documents|')).length,0);
  const get=await request(testHost,'GET',{reference:'ABC123'});
  assert.equal(get.status,200,get.body);
  assert.equal(JSON.parse(get.body).files[0].id,body.file.id);
  const download=await request(testHost,'GET',{reference:'ABC123',itemId:body.file.id});
  assert.equal(download.status,200);
  assert.equal(Buffer.from(download.body).toString(),Buffer.from(payload.data,'base64').toString());
  const denied=await request(productionHost,'GET',{reference:'ABC123'});
  assert.equal(denied.status,401,'A TESTSERVICE session must not authorize production');
  assert.ok(used.every(x=>x.cs===testCs||x.operation==='read'),
    'Production storage must not be modified by isolated TESTSERVICE uploads');
 }finally{
  Module._load=originalLoad;globalThis.fetch=originalFetch;
  for(const k of envKeys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k]}
  for(const p of ['../api/shared/auth-store.js','../api/shared/av-blob-store.js','../api/av-check/index.js','../api/reference-files/index.js']){
   delete require.cache[require.resolve(p)];
  }
 }
});
