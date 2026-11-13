import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
import {Readable} from 'node:stream';

const require=createRequire(import.meta.url);
function memoryAzure(){
 const blobs=new Map();let serial=1;
 function err(statusCode){return Object.assign(new Error('Blob condition'),{statusCode})}
 const container={
  async createIfNotExists(){},
  getBlockBlobClient(name){return{
   async download(){const b=blobs.get(name);if(!b)throw err(404);return{readableStreamBody:Readable.from([b.data]),etag:b.etag}},
   async upload(raw,_length,options={}){
    const old=blobs.get(name),c=options.conditions||{};
    if(c.ifNoneMatch==='*'&&old)throw err(412);
    if(c.ifMatch&&(!old||old.etag!==c.ifMatch))throw err(412);
    blobs.set(name,{data:Buffer.from(String(raw)),etag:'"e'+serial+++'"'});return{}
   }
  }}
 };
 return{BlobServiceClient:{fromConnectionString(){return{getContainerClient(){return container}}}}};
}
function load(azure){
 const modulePath=path.resolve('api/shared/public-access-store.js'),original=Module._load;
 Module._load=function(request,parent,isMain){
  if(request==='@azure/storage-blob')return azure;
  return original.call(this,request,parent,isMain)
 };
 delete require.cache[require.resolve(modulePath)];
 try{return require(modulePath)}finally{Module._load=original}
}
test('RC1349: known carrier token cannot be reused as a customer token',async()=>{
 const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
 const oldSecret=process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
 process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET='rc1349-test-only-audience-secret';
 const access=load(memoryAzure()),req={headers:{'x-exporthub-environment':'testservice',host:'exporthub-testservice.azurestaticapps.net'}};
 const subjectId='RC1349-TARGET-1',reference='ABC123';
 try{
  const meta={subjectId,shipmentId:subjectId,reference,actor:'Review test'};
  const carrier=await access.issue(req,'avis',{...meta,avisAudience:'carrier'},null,{environment:'testservice'});
  const carrierAgain=await access.issue(req,'avis',{...meta,avisAudience:'carrier'},null,{environment:'testservice',token:carrier.token});
  assert.equal(carrierAgain.token,carrier.token);
  assert.equal(carrierAgain.reused,true);
  const customer=await access.issue(req,'avis',{...meta,avisAudience:'customer'},null,{environment:'testservice',token:carrier.token});
  assert.notEqual(customer.token,carrier.token,'Carrier token must never become a customer token');
  assert.equal(customer.record.avisAudience,'customer');
  assert.equal((await access.resolve(req,'avis',carrier.token,{allowUsed:true},{environment:'testservice'})).record.avisAudience,'carrier');
  const customerAgain=await access.issue(req,'avis',{...meta,avisAudience:'customer'},null,{environment:'testservice',token:customer.token});
  assert.equal(customerAgain.token,customer.token);
  assert.equal(customerAgain.reused,true);
  const reversed=await access.issue(req,'avis',{...meta,avisAudience:'carrier'},null,{environment:'testservice',token:customer.token});
  assert.notEqual(reversed.token,customer.token,'Customer token must never become a carrier token');
  assert.equal(reversed.record.avisAudience,'carrier');

  // Browser-supplied token not in this shipment's index must not be copied verbatim.
  const browserToken='d'.repeat(48);
  const untrusted=await access.issue(req,'avis',{...meta,avisAudience:'customer'},null,{environment:'testservice',token:browserToken});
  assert.notEqual(untrusted.token,browserToken);
  assert.equal(untrusted.record.avisAudience,'customer');

  // Existing legacy access record remains an ordinary Avis link, not a customer-item permit.
  const legacy=await access.issue(req,'avis',meta,null,{environment:'testservice'});
  const converted=await access.issue(req,'avis',{...meta,avisAudience:'customer'},null,{environment:'testservice',token:legacy.token});
  assert.notEqual(converted.token,legacy.token);
  assert.equal((await access.resolve(req,'avis',legacy.token,{allowUsed:true},{environment:'testservice'})).record.avisAudience,'legacy');

  // Keep the historic pickup 48-hex client-token contract unchanged.
  const pickupToken='e'.repeat(48);
  const pickup=await access.issue(req,'pickup',{subjectId:'PICKUP-ABC',reference},3600000,{environment:'testservice',token:pickupToken});
  assert.equal(pickup.token,pickupToken);
 }finally{
  if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage;
  if(oldSecret===undefined)delete process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET;else process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET=oldSecret;
 }
});
