import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Readable} from 'node:stream';
const require = createRequire(import.meta.url);
const {createStore} = require('../api/shared/sop-store.js');
const {appendEvent, verifyChain} = require('../api/shared/hash-chain.js');
const ID='SOP-EH-020';
const AT='2026-11-13T11:00:00.000Z';
function blobError(statusCode, code) {return Object.assign(new Error(code),{statusCode,code});}
function fakeStorage() {
  const data=new Map();
  let revision=0;
  let alwaysConflict=false;
  const requests=[];
  const container={
    getBlockBlobClient(name){return {
      async download(){const entry=data.get(name);if(!entry)throw blobError(404,'BlobNotFound');return {etag:entry.etag,readableStreamBody:Readable.from([Buffer.from(entry.raw,'utf8')])};},
      async upload(raw,length,options){
        requests.push({name,conditions:structuredClone(options.conditions)});
        if(alwaysConflict)throw blobError(412,'ConditionNotMet');
        const existing=data.get(name);
        if(options.conditions.ifNoneMatch==='*' && existing)throw blobError(412,'ConditionNotMet');
        if(options.conditions.ifMatch && (!existing || existing.etag!==options.conditions.ifMatch))throw blobError(412,'ConditionNotMet');
        assert.equal(Buffer.byteLength(raw),length);
        data.set(name,{raw,etag:'"'+(++revision)+'"'});
      }
    };},
    async *listBlobsFlat({prefix}) {for(const name of [...data.keys()].sort())if(name.startsWith(prefix))yield {name};}
  };
  const store=createStore(()=>({container,prefix:''}));
  return {data,container,store,requests,setConflict(value){alwaysConflict=value}};
}
function event(history,action='EDITED') {return appendEvent(history,{at:AT,actor:'anna',action,data:{change:action}});}
function draft(id=ID){return {schemaVersion:1,id,revision:1,title:'Sample',area:'Versand',functionId:'shipment',versions:[{version:'0.1',status:'draft',author:'anna',lastEditor:'anna',content:{de:{},en:{}}}],events:[event([],'CREATED')]};}
function advance(doc,label='EDITED') {return {...doc,title:label,revision:doc.revision+1,events:[...doc.events,event(doc.events,label)]};}
async function create(f,id=ID){return f.store.mutateDoc('production',id,()=>draft(id),{create:true});}

test('new document writes conditional ifNoneMatch and read/list returns the stored draft',async()=>{
  const f=fakeStorage();const made=await create(f);
  assert.equal(made.revision,1);
  assert.equal(f.requests[0].conditions.ifNoneMatch,'*');
  assert.deepEqual(await f.store.getDoc('production',ID),made);
  assert.deepEqual(await f.store.listDocs('production'),[made]);
  assert.deepEqual(verifyChain(made.events),{ok:true,brokenAt:0});
});
test('update uses ETag ifMatch, increments revision and keeps history append-only',async()=>{
  const f=fakeStorage();await create(f);
  const updated=await f.store.mutateDoc('production',ID,advance);
  assert.equal(updated.revision,2);
  assert.equal(updated.events.length,2);
  assert.equal(f.requests[1].conditions.ifMatch,'"1"');
});
test('two parallel writes retry against current ETag, no lost update',async()=>{
  const f=fakeStorage();await create(f);
  let release;const gate=new Promise(resolve=>{release=resolve;});let started=0;
  const edit=label=>f.store.mutateDoc('production',ID,async doc=>{if(doc.revision===1){if(++started===2)release();await gate;}return advance(doc,label);});
  const outputs=await Promise.all([edit('A'),edit('B')]);
  assert.deepEqual(outputs.map(x=>x.revision).sort(),[2,3]);
  const stored=await f.store.getDoc('production',ID);
  assert.equal(stored.revision,3);
  assert.equal(stored.events.length,3);
  assert.equal(verifyChain(stored.events).ok,true);
  assert.equal(f.requests.length,4);
});
test('stale updater that refuses the new revision cannot overwrite a newer draft',async()=>{
  const f=fakeStorage();await create(f);
  let release;const gate=new Promise(resolve=>{release=resolve;});let reads=0;
  const edit=label=>f.store.mutateDoc('production',ID,async doc=>{if(++reads<=2){if(reads===2)release();await gate;}if(doc.revision!==1)throw Object.assign(new Error('CONFLICT'),{status:409});return advance(doc,label);});
  const all=await Promise.allSettled([edit('A'),edit('B')]);
  assert.equal(all.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(all.filter(x=>x.status==='rejected').length,1);
  assert.equal((await f.store.getDoc('production',ID)).revision,2);
});
test('tampered hash on existing document blocks both reads and writes',async()=>{
  const f=fakeStorage();await create(f);
  const raw=f.data.get('sop2/docs/'+ID+'.json');
  const changed=JSON.parse(raw.raw);changed.events[0].actor='attacker';raw.raw=JSON.stringify(changed);
  await assert.rejects(f.store.getDoc('production',ID),e=>e.code==='HISTORY_BROKEN'&&e.status===409);
  await assert.rejects(f.store.mutateDoc('production',ID,advance),e=>e.code==='HISTORY_BROKEN'&&e.status===409);
});
test('truncated audit history is detected using revision/event count',async()=>{
  const f=fakeStorage();await create(f);await f.store.mutateDoc('production',ID,advance);
  const saved=f.data.get('sop2/docs/'+ID+'.json');const value=JSON.parse(saved.raw);value.events.pop();saved.raw=JSON.stringify(value);
  await assert.rejects(f.store.getDoc('production',ID),e=>e.code==='HISTORY_BROKEN');
});
test('updater cannot rewrite, remove, or append multiple existing events',async()=>{
  const f=fakeStorage();await create(f);
  await assert.rejects(f.store.mutateDoc('production',ID,doc=>{const x=advance(doc);x.events[0].actor='bad';return x;}),e=>e.code==='HISTORY_BROKEN');
  await assert.rejects(f.store.mutateDoc('production',ID,doc=>{const x=advance(doc);x.events=[event([],'FORGED')];x.events.push(event(x.events));return x;}),e=>e.code==='HISTORY_NOT_APPEND_ONLY');
  await assert.rejects(f.store.mutateDoc('production',ID,doc=>({...advance(doc),revision:3})),e=>e.code==='HISTORY_BROKEN');
});
test('testservice and production have different paths even with same storage account',async()=>{
  const f=fakeStorage();await create(f);
  assert.equal(await f.store.getDoc('testservice',ID),null);
  await f.store.mutateDoc('testservice',ID,()=>draft(),{create:true});
  assert.ok(f.data.has('testservice/sop2/docs/'+ID+'.json'));
  assert.ok(f.data.has('sop2/docs/'+ID+'.json'));
  assert.equal((await f.store.listDocs('testservice')).length,1);
  assert.equal((await f.store.listDocs('production')).length,1);
});
test('malicious IDs and unrecognized environments are rejected without storage I/O',async()=>{
  const f=fakeStorage();for(const id of ['../x','SOP-EH-0','SOP-EH-0000','SOP-EH-020/abc',ID+'.json']){
    await assert.rejects(f.store.getDoc('production',id),e=>e.code==='INVALID_SOP_ID'&&e.status===400);
  }
  await assert.rejects(f.store.getDoc('staging',ID),e=>e.code==='INVALID_ENVIRONMENT'&&e.status===400);
  assert.equal(f.data.size,0);
});
test('existing null JSON and invalid JSON cannot be overwritten as new SOPs',async()=>{
  const f=fakeStorage();f.data.set('sop2/docs/'+ID+'.json',{raw:'null',etag:'"1"'});
  await assert.rejects(create(f),e=>e.code==='STORAGE_DATA_INVALID');
  f.data.set('sop2/docs/'+ID+'.json',{raw:'{invalid',etag:'"1"'});
  await assert.rejects(create(f),e=>e.code==='STORAGE_DATA_INVALID');
  assert.equal(f.requests.length,0);
});
test('create does not overwrite existing SOP; update does not create missing SOP',async()=>{
  const f=fakeStorage();await create(f);
  await assert.rejects(create(f),e=>e.code==='SOP_EXISTS'&&e.status===409);
  await assert.rejects(f.store.mutateDoc('production','SOP-EH-099',advance),e=>e.code==='SOP_NOT_FOUND'&&e.status===404);
});
test('persistent ETag contention returns bounded 409 instead of false success',async()=>{
  const f=fakeStorage();await create(f);f.setConflict(true);
  await assert.rejects(f.store.mutateDoc('production',ID,advance),e=>e.code==='CONCURRENT_UPDATE'&&e.status===409);
  assert.equal(f.requests.length,8);
  assert.equal((await f.store.getDoc('production',ID)).revision,1);
});
test('unavailable container 404 is not mistaken for missing document',async()=>{
  const container={getBlockBlobClient(){return {async download(){throw blobError(404,'ContainerNotFound');}}}};
  const store=createStore(()=>({container,prefix:''}));
  await assert.rejects(store.getDoc('production',ID),e=>e.code==='ContainerNotFound');
});
test('corrupt SOP cannot be hidden by listing and production reads remain untouched',async()=>{
  const f=fakeStorage();await create(f);
  const saved=f.data.get('sop2/docs/'+ID+'.json');saved.raw='{}';
  await assert.rejects(f.store.listDocs('production'),e=>e.code==='STORAGE_DATA_INVALID');
  assert.deepEqual(await f.store.listDocs('testservice'),[]);
});
test('storage paths reject traversal and unexpected prefix characters',async()=>{
  const f=fakeStorage();
  for(const prefix of ['../other','/production/','a\\b','x//y']){
    const store=createStore(()=>({container:f.container,prefix}));
    await assert.rejects(store.getDoc('production',ID),e=>e.code==='INVALID_STORAGE_PREFIX');
  }
});
