import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const OLD_STORAGE = process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
process.env.EXPORTHUB_STORAGE_CONNECTION_STRING = 'rc1014-memory-store';
test.after(() => {
  if (OLD_STORAGE === undefined) delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING = OLD_STORAGE;
});

function makeMemoryBlobRest(){
  const blobs = new Map();
  let serial = 1;
  function notFound(){ const e = new Error('Blob not found'); e.statusCode = 404; return e; }
  function conflict(){ const e = new Error('Condition not met'); e.statusCode = 412; return e; }
  return {
    blobs,
    createBlobServiceClient(){
      return { getContainerClient(containerName){ return { getBlockBlobClient(name){
        const key = `${containerName}/${name}`;
        return {
          async download(){ const item=blobs.get(key); if(!item) throw notFound(); return {etag:item.etag,readableStreamBody:(async function*(){yield item.data;})()}; },
          async upload(raw,_length,options={}){
            const current=blobs.get(key); const cond=options.conditions||{};
            if(cond.ifMatch&&(!current||current.etag!==cond.ifMatch)) throw conflict();
            if(cond.ifNoneMatch==='*'&&current) throw conflict();
            const etag=`\"e${serial++}\"`; blobs.set(key,{data:Buffer.from(String(raw)),etag}); return {etag};
          }
        };
      }}; }};
    }
  };
}

function loadStore(memory){
  const target=require.resolve('../api/shared/fixed-pickup-store.js');
  const seedTarget=require.resolve('../api/shared/rc1014-fixed-pickup-seed.js');
  const original=Module._load;
  Module._load=function(request,parent,isMain){ if(request==='./blob-rest') return memory; return original.call(this,request,parent,isMain); };
  delete require.cache[target]; delete require.cache[seedTarget];
  try{return require(target);} finally{Module._load=original;}
}

const expected = [
  ['Frankreich',1],
  ['Italien',1],
  ['O’Hare',1],
  ['Faurecia',2],
  ['BMP',3]
];
function canonical(list){ return list.map(([label,day])=>`${label}|${day}`).sort(); }

test('Essentra erhält die freigegebenen FIX-Abholtage ohne NEFF', async()=>{
  const store=loadStore(makeMemoryBlobRest());
  const items=await store.list('production','ESSENTRA',{includeInactive:true});
  assert.equal(items.length,5);
  assert.deepEqual(canonical(items.map(x=>[x.siteLabel,x.weekday])),canonical(expected));
  assert.equal(items.some(x=>/NEFF/i.test(x.siteLabel)),false);
  assert.equal(items.find(x=>x.siteLabel==='O’Hare')?.weekday,1);
  assert.equal(items.find(x=>x.siteLabel==='BMP')?.weekday,3);
});

test('Essentra-Seed ist idempotent und bleibt administrativ editierbar', async()=>{
  const memory=makeMemoryBlobRest(); const store=loadStore(memory);
  const first=await store.list('production','essentra',{includeInactive:true});
  const second=await store.list('production','essentra',{includeInactive:true});
  assert.equal(first.length,5); assert.equal(second.length,5);
  const france=first.find(x=>x.siteLabel==='Frankreich');
  await store.update('production','essentra',france.id,{active:false},'Admin');
  assert.equal((await store.list('production','essentra',{})).some(x=>x.id===france.id),false);
  assert.equal((await store.list('production','essentra',{includeInactive:true})).filter(x=>x.id===france.id).length,1);
});

test('Seed-Version 4 entfernt einen unberührten systemseitigen NEFF-Eintrag dauerhaft', async()=>{
  const memory=makeMemoryBlobRest(); const store=loadStore(memory);
  const blob=store.blobName('production','essentra');
  const oldItems=[
    {id:'FIX-RC1014-ESSENTRA-FR-MO',siteLabel:'Frankreich',weekday:1,note:'',active:true,createdBy:'System RC1014',updatedBy:'System RC1014'},
    {id:'FIX-RC1014-ESSENTRA-NEFF-MO',siteLabel:'Neff',weekday:1,note:'',active:true,createdBy:'System RC1014',updatedBy:'System RC1014'}
  ];
  const doc={schemaVersion:1,seedVersion:4,environment:'production',companyKey:'essentra',revision:1,updatedAt:null,items:oldItems};
  memory.blobs.set(`exporthub-data/${blob}`,{data:Buffer.from(JSON.stringify(doc)),etag:'\"old\"'});
  const items=await store.list('production','essentra',{includeInactive:true});
  assert.equal(items.some(x=>/NEFF/i.test(x.siteLabel)),false);
  assert.deepEqual(canonical(items.map(x=>[x.siteLabel,x.weekday])),canonical(expected));
});

test('Andere Firmen werden nicht mit Essentra-Abholungen befüllt', async()=>{
  const store=loadStore(makeMemoryBlobRest());
  assert.deepEqual(await store.list('production','kontur',{}),[]);
});

test('Produktions- und Testservice-Seeds bleiben getrennt', async()=>{
  const memory=makeMemoryBlobRest(); const store=loadStore(memory);
  const prod=await store.list('production','essentra',{includeInactive:true});
  const testItems=await store.list('testservice','essentra',{includeInactive:true});
  assert.equal(prod.length,5); assert.equal(testItems.length,5); assert.equal(memory.blobs.size,2);
});
