'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path');
const {Readable}=require('node:stream');

function makeAzureMemory(){
 const blobs=new Map();let serial=1;
 function nf(){const e=new Error('Blob not found');e.statusCode=404;return e}
 function conflict(){const e=new Error('Condition not met');e.statusCode=412;return e}
 function client(name){return{name,
  async download(){const x=blobs.get(name);if(!x)throw nf();return{readableStreamBody:Readable.from([x.data]),etag:x.etag}},
  async upload(raw,_len,opt={}){const old=blobs.get(name),c=opt.conditions||{};if(c.ifMatch&&(!old||old.etag!==c.ifMatch))throw conflict();if(c.ifNoneMatch==='*'&&old)throw conflict();const x={data:Buffer.from(String(raw)),etag:'"e'+serial+++'"'};blobs.set(name,x);return{etag:x.etag}}
 }}
 const container={async createIfNotExists(){},getBlockBlobClient:client};
 return{BlobServiceClient:{fromConnectionString(){return{getContainerClient(){return container}}}}};
}
function loadAccess(azure){
 const abs=path.resolve(__dirname,'../../api/shared/public-access-store.js'),orig=Module._load;
 Module._load=function(req,parent,isMain){if(req==='@azure/storage-blob')return azure;return orig.call(this,req,parent,isMain)};
 delete require.cache[require.resolve(abs)];
 try{return require(abs)}finally{Module._load=orig}
}
function req(){return{headers:{host:'wonderful-forest-0f315e310-testservice.centralus.7.azurestaticapps.net'}}}

test('RC1000: erneutes Erzeugen eines Pickup-QR liefert einen wirklich neuen aktiven Token',async()=>{
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
 process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET='rc1000-test-secret';
 const access=loadAccess(makeAzureMemory()),firstToken='a'.repeat(48);
 const first=await access.issue(req(),'pickup',{subjectId:'SHIP-1',shipmentId:'SHIP-1',reference:'ABC123' },86400000,{token:firstToken});
 assert.equal(first.token,firstToken);
 const second=await access.issue(req(),'pickup',{subjectId:'SHIP-1',shipmentId:'SHIP-1',reference:'ABC123'},86400000,{token:firstToken});
 assert.match(second.token,/^[a-f0-9]{48}$/);
 assert.notEqual(second.token,firstToken,'ein widerrufener Token darf beim neuen QR nicht reaktiviert werden');
 await assert.rejects(()=>access.resolve(req(),'pickup',firstToken),e=>e&&e.status===410);
 const live=await access.resolve(req(),'pickup',second.token);
 assert.equal(live.record.subjectId,'SHIP-1');
});
