import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
import {Readable} from 'node:stream';

const require=createRequire(import.meta.url);
const read=p=>fs.readFileSync(p,'utf8');

for(const file of ['index.html','TESTVERSION.html']){
  test(`${file}: lokal erzeugter Pickup-Token gilt nicht als registriert`,()=>{
    const html=read(file);
    const start=html.indexOf('function historicalQr(sh)');
    assert.ok(start>=0,'historicalQr fehlt');
    const chunk=html.slice(start,start+700);
    assert.match(chunk,/pickupQrRegistered===true/);
    assert.match(chunk,/pickupQrRegisteredAt/);
    assert.doesNotMatch(chunk,/pickupQrCreatedAt/,'lokale Token-Erzeugung darf den QR nicht freigeben');
  });
}

test('Public-Access übernimmt neuen 48-Hex-Token des Clients',()=>{
  const source=read('api/shared/public-access-store.js');
  assert.match(source,/requestedToken/);
  assert.match(source,/payload&&payload\.token/);
  assert.match(source,/\^\[a-f0-9\]\{48\}\$/);
});

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
  const abs=path.resolve('api/shared/public-access-store.js'),orig=Module._load;
  Module._load=function(req,parent,isMain){if(req==='@azure/storage-blob')return azure;return orig.call(this,req,parent,isMain)};
  delete require.cache[require.resolve(abs)];
  try{return require(abs)}finally{Module._load=orig}
}
function req(){return{headers:{host:'wonderful-forest-0f315e310.azurestaticapps.net'}}}

test('erneutes QR-Erzeugen hält bereits ausgegebene QR-Codes aktiv und teilt den Pickup-Datensatz',async()=>{
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET='rc1045-production-test-secret';
  const access=loadAccess(makeAzureMemory()),firstToken='a'.repeat(48),secondToken='b'.repeat(48);
  const first=await access.issue(req(),'pickup',{subjectId:'SHIP-1',shipmentId:'SHIP-1',reference:'ABC123'},86400000,{token:firstToken});
  const second=await access.issue(req(),'pickup',{subjectId:'SHIP-1',shipmentId:'SHIP-1',reference:'ABC123'},86400000,{token:secondToken});
  assert.equal(first.token,firstToken);
  assert.equal(second.token,secondToken);
  assert.notEqual(second.tokenHash,first.tokenHash);
  assert.equal(second.resourceKey,first.tokenHash,'neuer QR muss denselben Pickup-Datensatz verwenden');
  const oldStillLive=await access.resolve(req(),'pickup',firstToken);
  const newStillLive=await access.resolve(req(),'pickup',secondToken);
  assert.equal(oldStillLive.resourceKey,first.tokenHash);
  assert.equal(newStillLive.resourceKey,first.tokenHash);
  await access.revokeSubject(req(),'pickup','SHIP-1','disabled','RC1045-Test');
  await assert.rejects(()=>access.resolve(req(),'pickup',firstToken),e=>e&&e.status===410);
  await assert.rejects(()=>access.resolve(req(),'pickup',secondToken),e=>e&&e.status===410);
});
