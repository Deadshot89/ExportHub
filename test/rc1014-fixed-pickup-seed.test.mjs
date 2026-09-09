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
  const original=Module._load;
  Module._load=function(request,parent,isMain){ if(request==='./blob-rest') return memory; return original.call(this,request,parent,isMain); };
  delete require.cache[target];
  try{return require(target);} finally{Module._load=original;}
}

const expected = [
  ['Frankreich',1],
  ['Spanien',2],['Spanien',5],
  ['BMP',3],
  ['Italien',3],['Italien',5],
  ['Luftfracht China / Indien / Australien / Singapore / Shenzhen-HK / Thailand',4],
  ['Polen',5],['Schweden',5],
  ['UK',1],['UK',2],['UK',3],['UK',4],['UK',5],
  ['O’Hare',4],['O’Hare',5]
];
function canonical(list){ return list.map(([label,day])=>`${label}|${day}`).sort(); }

test('Essentra erhält die freigegebene FIX-Abholliste automatisch', async()=>{
  const store=loadStore(makeMemoryBlobRest());
  const items=await store.list('production','ESSENTRA',{includeInactive:true});
  assert.equal(items.length,16);
  assert.deepEqual(canonical(items.map(x=>[x.siteLabel,x.weekday])),canonical(expected));
  assert.match(items.find(x=>x.siteLabel==='O’Hare'&&x.weekday===4)?.note||'',/alternativ|oder/i);
  assert.match(items.find(x=>x.siteLabel==='O’Hare'&&x.weekday===5)?.note||'',/alternativ|oder/i);
});

test('Essentra-Seed ist idempotent und bleibt administrativ editierbar', async()=>{
  const memory=makeMemoryBlobRest(); const store=loadStore(memory);
  const first=await store.list('production','essentra',{includeInactive:true});
  const second=await store.list('production','essentra',{includeInactive:true});
  assert.equal(first.length,16); assert.equal(second.length,16);
  const france=first.find(x=>x.siteLabel==='Frankreich');
  await store.update('production','essentra',france.id,{active:false},'Admin');
  assert.equal((await store.list('production','essentra',{})).some(x=>x.id===france.id),false);
  assert.equal((await store.list('production','essentra',{includeInactive:true})).filter(x=>x.id===france.id).length,1);
});

test('Andere Firmen werden nicht mit Essentra-Abholungen befüllt', async()=>{
  const store=loadStore(makeMemoryBlobRest());
  assert.deepEqual(await store.list('production','kontur',{}),[]);
});

test('Produktions- und Testservice-Seeds bleiben getrennt', async()=>{
  const memory=makeMemoryBlobRest(); const store=loadStore(memory);
  const prod=await store.list('production','essentra',{includeInactive:true});
  const testItems=await store.list('testservice','essentra',{includeInactive:true});
  assert.equal(prod.length,16); assert.equal(testItems.length,16); assert.equal(memory.blobs.size,2);
});
