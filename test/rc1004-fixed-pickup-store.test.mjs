import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const OLD_STORAGE = process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
process.env.EXPORTHUB_STORAGE_CONNECTION_STRING = 'rc1004-memory-store';
test.after(() => {
  if (OLD_STORAGE === undefined) delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING = OLD_STORAGE;
});

function makeMemoryBlobRest() {
  const blobs = new Map();
  let serial = 1;
  function notFound(){ const e = new Error('Blob not found'); e.statusCode = 404; e.code = 'BlobNotFound'; return e; }
  function conflict(){ const e = new Error('Condition not met'); e.statusCode = 412; e.code = 'ConditionNotMet'; return e; }
  return {
    blobs,
    createBlobServiceClient(){
      return {
        getContainerClient(containerName){
          return {
            getBlockBlobClient(name){
              const key = `${containerName}/${name}`;
              return {
                async download(){
                  const item = blobs.get(key);
                  if (!item) throw notFound();
                  return { etag: item.etag, readableStreamBody: (async function*(){ yield item.data; })() };
                },
                async upload(raw, _length, options = {}){
                  const current = blobs.get(key);
                  const cond = options.conditions || {};
                  if (cond.ifMatch && (!current || current.etag !== cond.ifMatch)) throw conflict();
                  if (cond.ifNoneMatch === '*' && current) throw conflict();
                  const data = Buffer.isBuffer(raw) ? Buffer.from(raw) : Buffer.from(String(raw));
                  const etag = `\"e${serial++}\"`;
                  blobs.set(key, { data, etag });
                  return { etag };
                }
              };
            }
          };
        }
      };
    }
  };
}

function loadStore(memory){
  const target = require.resolve('../api/shared/fixed-pickup-store.js');
  const original = Module._load;
  Module._load = function(request, parent, isMain){
    if (request === './blob-rest') return memory;
    return original.call(this, request, parent, isMain);
  };
  delete require.cache[target];
  try { return require(target); }
  finally { Module._load = original; }
}

test('FIX-Modell akzeptiert Montag bis Freitag und verbietet Uhrzeitfelder', () => {
  const store = loadStore(makeMemoryBlobRest());
  assert.equal(store.validateInput({ siteLabel: 'Teststandort', weekday: 1, note: '' }, { partial: false }).weekday, 1);
  assert.throws(() => store.validateInput({ siteLabel: 'Teststandort', weekday: 6 }, { partial: false }), /Montag bis Freitag/);
  assert.throws(() => store.validateInput({ siteLabel: 'Teststandort', weekday: 2, time: '10:00' }, { partial: false }), e => e.code === 'TIME_FIELDS_NOT_ALLOWED');
  assert.throws(() => store.validateInput({ siteLabel: 'Teststandort', weekday: 2, pickupStart: '10:00' }, { partial: false }), e => e.code === 'TIME_FIELDS_NOT_ALLOWED');
});

test('Produktions- und Testservice-FIX-Daten sind getrennt', async () => {
  const memory = makeMemoryBlobRest();
  const store = loadStore(memory);
  await store.create('production', 'firma-a', { siteLabel: 'Produktion', weekday: 1 }, 'Admin');
  await store.create('testservice', 'firma-a', { siteLabel: 'Testservice', weekday: 1 }, 'Admin');
  assert.deepEqual((await store.list('production','firma-a',{})).map(x=>x.siteLabel), ['Produktion']);
  assert.deepEqual((await store.list('testservice','firma-a',{})).map(x=>x.siteLabel), ['Testservice']);
  assert.equal(memory.blobs.size, 2);
});

test('Firmen erhalten getrennte FIX-Dokumente', async () => {
  const memory = makeMemoryBlobRest();
  const store = loadStore(memory);
  await store.create('testservice', 'firma-a', { siteLabel: 'A', weekday: 2 }, 'Admin');
  await store.create('testservice', 'firma-b', { siteLabel: 'B', weekday: 2 }, 'Admin');
  assert.deepEqual((await store.list('testservice','firma-a',{})).map(x=>x.siteLabel), ['A']);
  assert.deepEqual((await store.list('testservice','firma-b',{})).map(x=>x.siteLabel), ['B']);
  assert.equal(memory.blobs.size, 2);
});

test('Deaktivieren ist soft und reaktivierbar', async () => {
  const store = loadStore(makeMemoryBlobRest());
  const created = await store.create('testservice','firma-a',{siteLabel:'A',weekday:3},'Admin');
  await store.update('testservice','firma-a',created.id,{active:false},'Admin');
  assert.equal((await store.list('testservice','firma-a',{})).length, 0);
  assert.equal((await store.list('testservice','firma-a',{includeInactive:true}))[0].active, false);
  const active = await store.update('testservice','firma-a',created.id,{active:true},'Admin');
  assert.equal(active.active, true);
});

test('öffentliche FIX-Daten enthalten keine internen Firmen- oder Actor-Felder', async () => {
  const store = loadStore(makeMemoryBlobRest());
  const created = await store.create('production','firma-a',{siteLabel:'Standort',weekday:5,note:'Hinweis'},'Admin');
  const item = store.publicItem(created);
  assert.deepEqual(Object.keys(item).sort(), ['active','createdAt','id','note','siteLabel','updatedAt','weekday'].sort());
});
