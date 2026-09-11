import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
import {Readable} from 'node:stream';

const require=createRequire(import.meta.url);
const read=p=>fs.readFileSync(p,'utf8');

function makeAzureMemory(){
  const blobs=new Map();let serial=1;
  function notFound(){const e=new Error('Blob not found');e.statusCode=404;e.code='BlobNotFound';return e}
  function conflict(){const e=new Error('Condition not met');e.statusCode=412;e.code='ConditionNotMet';return e}
  function client(name){return{name,
    async download(){const item=blobs.get(name);if(!item)throw notFound();return{readableStreamBody:Readable.from([item.data]),etag:item.etag}},
    async upload(raw,_len,opt={}){const current=blobs.get(name),conditions=opt.conditions||{};if(conditions.ifMatch&&(!current||current.etag!==conditions.ifMatch))throw conflict();if(conditions.ifNoneMatch==='*'&&current)throw conflict();const item={data:Buffer.from(String(raw)),etag:'"e'+serial+++'"'};blobs.set(name,item);return{etag:item.etag}}
  }}
  const container={async createIfNotExists(){},getBlockBlobClient:client};
  return{blobs,azure:{BlobServiceClient:{fromConnectionString(){return{getContainerClient(){return container}}}}}};
}
function loadAccess(azure){
  const absolute=path.resolve('api/shared/public-access-store.js'),original=Module._load;
  Module._load=function(request,parent,isMain){if(request==='@azure/storage-blob')return azure;return original.call(this,request,parent,isMain)};
  delete require.cache[require.resolve(absolute)];
  try{return require(absolute)}finally{Module._load=original}
}
function req(environment='testservice'){return{headers:{'x-exporthub-environment':environment,host:'exporthub-testservice.azurestaticapps.net'}}}

test('RC1045: historische QR-Linkformen bleiben auf pickup.html lesbar',()=>{
  const html=read('pickup.html');
  assert.match(html,/\[A-Za-z0-9_-\]\{6,160\}/);
  assert.match(html,/searchParams\.get\('pickup'\)/);
  assert.match(html,/searchParams\.get\('token'\)/);
  assert.match(html,/searchParams\.get\('qr'\)/);
  assert.match(html,/searchParams\.get\('ehcmd'\)/);
  assert.match(html,/searchParams\.get\('ref'\)/);
  assert.match(html,/__EXPORTHUB_PICKUP_ROUTE_TOKEN__/);
  assert.doesNotMatch(html,/\[a-f0-9\]\{48\}.*Dieser QR-Code ist veraltet/i);
});

test('RC1045: alter und neuer QR derselben Sendung bleiben aktiv und teilen resourceKey',async()=>{
  const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING,oldSecret=process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET;
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET='rc1045-stable-qr-secret';
  const mem=makeAzureMemory(),access=loadAccess(mem.azure),request=req();
  try{
    const firstToken='a'.repeat(48),secondToken='b'.repeat(48);
    const first=await access.issue(request,'pickup',{subjectId:'SHIP-1045',shipmentId:'SHIP-1045',reference:'QR1045'},86400000,{token:firstToken,environment:'testservice'});
    const second=await access.issue(request,'pickup',{subjectId:'SHIP-1045',shipmentId:'SHIP-1045',reference:'QR1045'},86400000,{token:secondToken,environment:'testservice'});
    assert.notEqual(first.tokenHash,second.tokenHash);
    assert.equal(second.resourceKey,first.tokenHash);
    assert.equal((await access.resolve(request,'pickup',firstToken,{}, {environment:'testservice'})).resourceKey,first.tokenHash);
    assert.equal((await access.resolve(request,'pickup',secondToken,{}, {environment:'testservice'})).resourceKey,first.tokenHash);
  }finally{
    if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage;
    if(oldSecret===undefined)delete process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET;else process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET=oldSecret;
  }
});

test('RC1045: vor RC1045 wegen reissued gesperrter Alt-QR wird auf den aktuellen Datensatz umgebogen',async()=>{
  const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING,oldSecret=process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET;
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET='rc1045-legacy-reissued-secret';
  const mem=makeAzureMemory(),access=loadAccess(mem.azure),request=req();
  try{
    const firstToken='c'.repeat(48),secondToken='d'.repeat(48);
    const first=await access.issue(request,'pickup',{subjectId:'LEGACY-1045',shipmentId:'LEGACY-1045',reference:'LG1045'},86400000,{token:firstToken,environment:'testservice'});
    const second=await access.issue(request,'pickup',{subjectId:'LEGACY-1045',shipmentId:'LEGACY-1045',reference:'LG1045'},86400000,{token:secondToken,environment:'testservice'});
    const recordKey=[...mem.blobs.keys()].find(k=>k.endsWith('/records/'+first.tokenHash+'.json'));
    const subjectKey=[...mem.blobs.keys()].find(k=>k.includes('/subjects/'));
    assert.ok(recordKey&&subjectKey);
    const oldRecord=JSON.parse(mem.blobs.get(recordKey).data.toString('utf8'));
    oldRecord.revokedAt=new Date().toISOString();oldRecord.revokedReason='reissued';delete oldRecord.resourceKey;
    mem.blobs.set(recordKey,{data:Buffer.from(JSON.stringify(oldRecord)),etag:mem.blobs.get(recordKey).etag});
    const legacyIndex={schemaVersion:1,kind:'pickup',environment:'testservice',subjectId:'LEGACY-1045',tokenHash:second.tokenHash,active:true,issuedAt:new Date().toISOString(),expiresAt:second.expiresAt};
    mem.blobs.set(subjectKey,{data:Buffer.from(JSON.stringify(legacyIndex)),etag:mem.blobs.get(subjectKey).etag});
    const restored=await access.resolve(request,'pickup',firstToken,{}, {environment:'testservice'});
    assert.equal(restored.legacyReissued,true);
    assert.equal(restored.resourceKey,second.tokenHash);
  }finally{
    if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage;
    if(oldSecret===undefined)delete process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET;else process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET=oldSecret;
  }
});

test('RC1045: alle Pickup-Endpunkte verwenden den stabilen resourceKey für Sendungsdaten',()=>{
  for(const file of ['api/pickup-init/index.js','api/pickup-status/index.js','api/pickup-confirm-v2/index.js','api/pickup-pod/index.js']){
    const source=read(file);
    assert.match(source,/resourceKey/);
  }
  assert.match(read('api/pickup-status/index.js'),/store\.getRecord\(accessKey,resolved\.environment\)/);
  assert.match(read('api/pickup-confirm-v2/index.js'),/store\.mutateRecord\(accessKey,resolved\.environment/);
  assert.match(read('api/pickup-pod/index.js'),/store\.getRecord\(accessKey,resolved\.environment\)/);
});

test('RC1045: explizites Deaktivieren sperrt weiterhin alle neu verwalteten QR-Aliase',async()=>{
  const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING,oldSecret=process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET;
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET='rc1045-disable-secret';
  const mem=makeAzureMemory(),access=loadAccess(mem.azure),request=req();
  try{
    const a='e'.repeat(48),b='f'.repeat(48);
    await access.issue(request,'pickup',{subjectId:'DISABLE-1045',shipmentId:'DISABLE-1045',reference:'DS1045'},86400000,{token:a,environment:'testservice'});
    await access.issue(request,'pickup',{subjectId:'DISABLE-1045',shipmentId:'DISABLE-1045',reference:'DS1045'},86400000,{token:b,environment:'testservice'});
    const out=await access.revokeSubject(request,'pickup','DISABLE-1045','disabled','RC1045-Test',{environment:'testservice'});
    assert.equal(out.revokedTokens,2);
    await assert.rejects(()=>access.resolve(request,'pickup',a,{}, {environment:'testservice'}),e=>e&&e.status===410);
    await assert.rejects(()=>access.resolve(request,'pickup',b,{}, {environment:'testservice'}),e=>e&&e.status===410);
  }finally{
    if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage;
    if(oldSecret===undefined)delete process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET;else process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET=oldSecret;
  }
});
