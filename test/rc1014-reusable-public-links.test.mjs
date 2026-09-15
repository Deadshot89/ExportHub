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

test('RC1117: Pickup bleibt wiederverwendbar, Legacy-Avis kompatibel und neue Avis-Links einmalig',async()=>{
  const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  const oldSecret=process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET;
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET='rc1117-public-links-test-secret';
  const access=loadAccess(makeAzureMemory()),req=request();

  try{
    const pickup=await access.issue(req,'pickup',{subjectId:'PICKUP-1117',shipmentId:'PICKUP-1117',reference:'ABC123'},3600000,{environment:'testservice'});
    await access.consume('testservice','pickup',pickup.tokenHash,{reason:'rc1117-regression'});
    const pickupReopened=await access.resolve(req,'pickup',pickup.token,{allowUsed:false},{environment:'testservice'});
    assert.ok(pickupReopened.record.usedAt,'Pickup usedAt bleibt reine Auditspur');

    const legacy=await access.issue(req,'avis',{subjectId:'AVIS-LEGACY',shipmentId:'AVIS-LEGACY',reference:'LEG123'},null,{environment:'testservice'});
    assert.equal(legacy.record.singleUse,false);
    await access.consume('testservice','avis',legacy.tokenHash,{reason:'legacy-compat'});
    const legacyReopened=await access.resolve(req,'avis',legacy.token,{allowUsed:false},{environment:'testservice'});
    assert.ok(legacyReopened.record.usedAt,'bereits ausgegebene Avis-Links ohne singleUse bleiben kompatibel');

    const once=await access.issue(req,'avis',{subjectId:'AVIS-ONCE',shipmentId:'AVIS-ONCE',reference:'ONE123',singleUse:true},null,{environment:'testservice'});
    assert.equal(once.record.singleUse,true);
    await access.consume('testservice','avis',once.tokenHash,{reason:'avis-authorized'});
    await assert.rejects(
      ()=>access.resolve(req,'avis',once.token,{allowUsed:false},{environment:'testservice'}),
      e=>e&&e.code==='ACCESS_USED'
    );
    const sessionRead=await access.getByHash('testservice','avis',once.tokenHash,{allowUsed:true});
    assert.ok(sessionRead.record.usedAt,'signierte Avis-Sitzungen dürfen den verbrauchten Datensatz weiter lesen');
  }finally{
    if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage;
    if(oldSecret===undefined)delete process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET;else process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET=oldSecret;
  }
});
