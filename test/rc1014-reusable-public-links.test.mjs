import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
import {Readable} from 'node:stream';

const require=createRequire(import.meta.url);

function makeAzureMemory(){
  const blobs=new Map();let serial=1;
  function notFound(){const e=new Error('Blob not found');e.statusCode=404;e.code='BlobNotFound';return e}
  function conflict(){const e=new Error('Condition not met');e.statusCode=412;e.code='ConditionNotMet';return e}
  function client(name){return{name,
    async download(){const item=blobs.get(name);if(!item)throw notFound();return{readableStreamBody:Readable.from([item.data]),etag:item.etag}},
    async upload(raw,_len,opt={}){const current=blobs.get(name),conditions=opt.conditions||{};if(conditions.ifMatch&&(!current||current.etag!==conditions.ifMatch))throw conflict();if(conditions.ifNoneMatch==='*'&&current)throw conflict();const item={data:Buffer.from(String(raw)),etag:'"e'+serial+++'"'};blobs.set(name,item);return{etag:item.etag}}
  }}
  const container={async createIfNotExists(){},getBlockBlobClient:client};
  return{BlobServiceClient:{fromConnectionString(){return{getContainerClient(){return container}}}}};
}

function loadAccess(azure){
  const absolute=path.resolve('api/shared/public-access-store.js'),original=Module._load;
  Module._load=function(request,parent,isMain){if(request==='@azure/storage-blob')return azure;return original.call(this,request,parent,isMain)};
  delete require.cache[require.resolve(absolute)];
  try{return require(absolute)}finally{Module._load=original}
}

function request(environment='testservice'){
  return{headers:{'x-exporthub-environment':environment,host:'exporthub-testservice.azurestaticapps.net'}};
}

test('RC1014: Abhol- und Avis-Link bleiben auch nach usedAt erneut auflösbar',async()=>{
  const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  const oldSecret=process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET;
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET='rc1014-reusable-public-links-test-secret';
  const access=loadAccess(makeAzureMemory()),req=request();

  try{
    for(const kind of ['pickup','avis']){
      const subjectId=kind==='pickup'?'PICKUP-1014':'AVIS-1014';
      const issued=await access.issue(req,kind,{subjectId,shipmentId:subjectId,reference:'ABC123'},kind==='avis'?null:3600000,{environment:'testservice'});
      await access.consume('testservice',kind,issued.tokenHash,{reason:'rc1014-regression'});
      const reopened=await access.resolve(req,kind,issued.token,{allowUsed:false},{environment:'testservice'});
      assert.equal(reopened.record.subjectId,subjectId);
      assert.ok(reopened.record.usedAt,`${kind}: usedAt bleibt als Auditspur erhalten`);
    }
  }finally{
    if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage;
    if(oldSecret===undefined)delete process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET;else process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET=oldSecret;
  }
});