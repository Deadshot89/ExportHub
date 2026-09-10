import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const OLD_STORAGE = process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
process.env.EXPORTHUB_STORAGE_CONNECTION_STRING = 'rc1021-memory-store';

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
            const current=blobs.get(key), cond=options.conditions||{};
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

test('NEFF gehört nicht mehr zum freigegebenen Essentra-FIX-Startbestand', () => {
  const seed = require('../api/shared/rc1014-fixed-pickup-seed.js');
  assert.equal(seed.defaultsForCompany('ESSENTRA').some(item => item.siteLabel.toLowerCase() === 'neff'), false);
  assert.equal(seed.defaultsForCompany('legacy-default').some(item => item.siteLabel.toLowerCase() === 'neff'), false);
});

test('ein unberührter automatisch erzeugter NEFF-Eintrag wird bei der Migration entfernt', async () => {
  const memory=makeMemoryBlobRest();
  const store=loadStore(memory);
  const blob=store.blobName('production','legacy-default');
  const oldDoc={
    schemaVersion:1,
    seedVersion:4,
    environment:'production',
    companyKey:'legacy-default',
    revision:1,
    updatedAt:null,
    items:[
      {id:'FIX-RC1014-ESSENTRA-NEFF-MO',siteLabel:'Neff',weekday:1,note:'',active:true,createdBy:'System RC1014',updatedBy:'System RC1014'},
      {id:'FIX-RC1014-ESSENTRA-FR-MO',siteLabel:'Frankreich',weekday:1,note:'',active:true,createdBy:'System RC1014',updatedBy:'System RC1014'}
    ]
  };
  memory.blobs.set(`exporthub-data/${blob}`,{data:Buffer.from(JSON.stringify(oldDoc)),etag:'\"old\"'});
  const items=await store.list('production','legacy-default',{includeInactive:true});
  assert.equal(items.some(item => item.siteLabel.toLowerCase() === 'neff'), false);
  assert.equal(items.some(item => item.siteLabel === 'Frankreich'), true);
});

test('ein bewusst administrativ gepflegter gleichnamiger Eintrag wird nicht blind gelöscht', () => {
  const seed = require('../api/shared/rc1014-fixed-pickup-seed.js');
  const migrated=seed.mergeMissing([
    {id:'FIX-RC1014-ESSENTRA-NEFF-MO',siteLabel:'Neff',weekday:1,note:'manuell gepflegt',active:true,createdBy:'System RC1014',updatedBy:'Admin'}
  ],'essentra','2026-09-10T08:30:00.000Z');
  assert.equal(migrated.some(item => item.siteLabel === 'Neff' && item.updatedBy === 'Admin'), true);
});
