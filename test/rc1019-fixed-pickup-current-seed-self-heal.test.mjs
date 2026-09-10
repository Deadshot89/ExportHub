import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const OLD_STORAGE = process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;

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
      return { getContainerClient(containerName){
        return { getBlockBlobClient(name){
          const key = `${containerName}/${name}`;
          return {
            async download(){
              const item = blobs.get(key);
              if (!item) throw notFound();
              return { etag:item.etag, readableStreamBody:(async function*(){ yield item.data; })() };
            },
            async upload(raw,_length,options={}){
              const current = blobs.get(key), cond = options.conditions || {};
              if (cond.ifMatch && (!current || current.etag !== cond.ifMatch)) throw conflict();
              if (cond.ifNoneMatch === '*' && current) throw conflict();
              const etag = `\"e${serial++}\"`;
              blobs.set(key,{data:Buffer.from(String(raw)),etag});
              return {etag};
            }
          };
        }};
      }};
    }
  };
}

function loadFixedStore(memory){
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING = 'rc1019-memory';
  const target = require.resolve('../api/shared/fixed-pickup-store.js');
  const seed = require.resolve('../api/shared/rc1014-fixed-pickup-seed.js');
  const original = Module._load;
  Module._load = function(request,parent,isMain){
    if (request === './blob-rest') return memory;
    return original.call(this,request,parent,isMain);
  };
  delete require.cache[target];
  delete require.cache[seed];
  try { return require(target); }
  finally { Module._load = original; }
}

const expectedFixes=[
  'Adolf Würth|2','Adolf Würth|4','BMP|3','BSH Hausgeräte|3','Barcelona|1','Barcelona|4',
  'Contitech|3','Esysco|1','Faurecia|2','Frankreich|1','Gaggenau|1','Gorenje Slovenien|2',
  'Italien|1','Madrid|1','Madrid|4','O’Hare|1','Polen|4','Schweden|5'
].sort();

test('Essentra FIX-Speicher heilt sich auch bei aktueller seedVersion und leerer Liste selbst', async () => {
  const memory = makeMemoryBlobRest();
  const store = loadFixedStore(memory);
  const blob = store.blobName('production','essentra');
  const doc = {
    schemaVersion:1,
    seedVersion:5,
    environment:'production',
    companyKey:'essentra',
    revision:8,
    updatedAt:'2026-09-10T07:55:00.000Z',
    items:[]
  };
  memory.blobs.set(`exporthub-data/${blob}`,{data:Buffer.from(JSON.stringify(doc)),etag:'\"old\"'});

  const items = await store.list('production','essentra',{includeInactive:true});

  assert.deepEqual(items.map(x=>`${x.siteLabel}|${x.weekday}`).sort(),expectedFixes);
  assert.equal(items.some(x=>/NEFF/i.test(x.siteLabel)),false);
});