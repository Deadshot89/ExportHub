import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Readable} from 'node:stream';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const apiRequire=createRequire(new URL('../api/package.json',import.meta.url));
const handler=require('../api/shipment-evidence/index.js');
const {BlobServiceClient}=apiRequire('@azure/storage-blob');
const auth=require('../api/shared/auth-store.js');
const ID='DOK-20261111-5403D613';
const PREFIX='shipment-evidence/v1/';
const RECORD=PREFIX+'records/'+ID+'.json';
const FILE=PREFIX+'files/'+ID+'/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const OTHER=PREFIX+'records/DOK-20261111-AAAAAAAA.json';
const fields={shipmentNumber:'ABC-123',customer:'Example',dispatchDate:'2026-11-11'};
function missing(){const e=new Error('Missing');e.statusCode=404;return e}
function createStore(){
 const stored=new Map();
 let seq=0;
 const put=(key,bytes)=>stored.set(key,{bytes:Buffer.from(bytes),etag:'"mock-'+(++seq)+'"'});
 put(RECORD,JSON.stringify({id:ID,revision:2,fields,complaints:[],files:[{id:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',name:'Foto.jpg'}],
   history:[{action:'create',revision:1},{action:'admin-delete',revision:2}],deletedAt:'2026-11-11T14:00:00Z',deletedBy:'Admin',
   createdAt:'2026-11-11T13:00:00Z'},null,2)+'\n');
 put(FILE,Buffer.from('image-binary'));
 put(OTHER,JSON.stringify({id:'DOK-20261111-AAAAAAAA',revision:1,fields,complaints:[],files:[],history:[]}));
 const initial=Buffer.from(stored.get(RECORD).bytes),unrelated=Buffer.from(stored.get(OTHER).bytes),originalPhoto=Buffer.from(stored.get(FILE).bytes);
 function blob(key){return{
  async download(){
   const item=stored.get(key);if(!item)throw missing();
   return{etag:item.etag,readableStreamBody:Readable.from([item.bytes])};
  },
  async getProperties(){
   const item=stored.get(key);if(!item)throw missing();
   return{etag:item.etag,contentLength:item.bytes.length};
  },
  async uploadData(bytes,options={}){
   const previous=stored.get(key),conditions=options.conditions||{};
   if(conditions.ifNoneMatch==='*'&&previous)throw Object.assign(new Error('Conflict'),{statusCode:412});
   if(conditions.ifMatch&&(!previous||previous.etag!==conditions.ifMatch))
    throw Object.assign(new Error('Conflict'),{statusCode:412});
   put(key,bytes);return{etag:stored.get(key).etag};
  }
 }}
 const container={
  getBlockBlobClient:blob,
  listBlobsFlat(options){return{
   async *[Symbol.asyncIterator](){
    for(const key of stored.keys())if(key.startsWith(options.prefix))yield{name:key};
   },
   byPage:()=>({next:async()=>({value:{segment:{blobItems:[...stored.keys()].filter(k=>k.startsWith(options.prefix)).map(name=>({name}))},continuationToken:null}})})
  }}
 };
 return {stored,container,initial,unrelated,originalPhoto};
}
function responseBody(r){return JSON.parse(r.body)}
async function call(method,payload){
 const context={};await handler(context,{method,headers:{},query:method==='GET'?payload:{},body:method==='POST'?payload:undefined});
 return context.res;
}

test('RC1934 P0: exact lookup, verified tombstone restore, ETag and unrelated-data isolation',async t=>{
 const old=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='DefaultEndpointsProtocol=https;AccountName=exporthubdata89;AccountKey=DO_NOT_LOG_A_SECRET;EndpointSuffix=core.windows.net';
 t.after(()=>{if(old===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=old});
 const db=createStore();
 const user={role:'Administrator',rights:{documents:{level:'edit',read:true,edit:true}}};
 t.mock.method(auth,'validateSession',async()=>({user,session:{environment:'production'}}));
 t.mock.method(auth,'environmentFromRequest',()=> 'production');
 t.mock.method(auth,'loginStorageEnvironment',()=> 'production');
 t.mock.method(BlobServiceClient,'fromConnectionString',()=>({getContainerClient:()=>db.container}));
 const hidden=await call('GET',{action:'get',id:ID});
 assert.equal(hidden.status,404,'Deleted record must stay unavailable via normal get');
 const inspect=await call('GET',{action:'inspect',id:ID});
 assert.equal(inspect.status,200,inspect.body);
 assert.deepEqual({found:responseBody(inspect).found,deleted:responseBody(inspect).deleted,
   fileCount:responseBody(inspect).fileCount,canRestore:responseBody(inspect).canRestore},
  {found:true,deleted:true,fileCount:1,canRestore:true});
 assert.equal(responseBody(inspect).record,undefined,'Inspection must not disclose full contents');
 assert.deepEqual(responseBody(inspect).storageTarget,{environment:'production',accountName:'exporthubdata89',containerName:auth.TEAM_CONTAINER});
 assert.ok(!inspect.body.includes('AccountKey'),'Connection-string secrets must not be serialized');
 assert.ok(!inspect.body.includes('DO_NOT_LOG_A_SECRET'),'Connection-string values must never appear in response');
 const stale=await call('POST',{action:'restore',id:ID,expectedRevision:1});
 assert.equal(stale.status,409);
 assert.ok(![...db.stored.keys()].some(k=>k.includes('recovery-backups')));
 const restored=await call('POST',{action:'restore',id:ID,expectedRevision:2});
 assert.equal(restored.status,200,restored.body);
 assert.equal(responseBody(restored).restored,true);
 const obj=JSON.parse(db.stored.get(RECORD).bytes.toString('utf8'));
 assert.equal(obj.id,ID);
 assert.equal(obj.revision,3);
 assert.equal(obj.deletedAt,undefined);
 assert.deepEqual(obj.fields,fields);
 assert.equal(obj.files.length,1);
 assert.equal(obj.history.at(-1).action,'admin-restore');
 assert.equal(obj.lastDeletion.at,'2026-11-11T14:00:00Z');
 assert.deepEqual(db.stored.get(FILE).bytes,db.originalPhoto,'Photo must remain untouched');
 assert.deepEqual(db.stored.get(OTHER).bytes,db.unrelated,'Other record must remain untouched');
 const backups=[...db.stored.entries()].filter(([k])=>k.startsWith(PREFIX+'recovery-backups/'+ID+'/'));
 assert.equal(backups.length,1);
 assert.deepEqual(backups[0][1].bytes,db.initial,'Backup must be exact pre-restore JSON');
 const readBack=await call('GET',{action:'get',id:ID});
 assert.equal(readBack.status,200,'Restored record must reopen');
 const listed=await call('GET',{action:'list'});
 assert.ok(responseBody(listed).records.some(x=>x.id===ID),'Restored record must appear in list');
 const doubleRestore=await call('POST',{action:'restore',id:ID,expectedRevision:3});
 assert.equal(doubleRestore.status,409,'Active records must not be overwritten');
 const missingDoc=await call('GET',{action:'inspect',id:'DOK-20261111-BBBBBBBB'});
 assert.equal(missingDoc.status,200);
 assert.equal(responseBody(missingDoc).found,false);
});

test('RC1934 P0: recovery cannot proceed if original photo is missing',async t=>{
 const old=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
 t.after(()=>{if(old===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=old});
 const db=createStore();db.stored.delete(FILE);
 const user={role:'Administrator',rights:{documents:{level:'edit',read:true,edit:true}}};
 t.mock.method(auth,'validateSession',async()=>({user,session:{environment:'production'}}));
 t.mock.method(auth,'environmentFromRequest',()=> 'production');
 t.mock.method(auth,'loginStorageEnvironment',()=> 'production');
 t.mock.method(BlobServiceClient,'fromConnectionString',()=>({getContainerClient:()=>db.container}));
 const probe=await call('GET',{action:'inspect',id:ID});
 assert.equal(responseBody(probe).canRestore,false);
 assert.equal(responseBody(probe).missingFileCount,1);
 const restore=await call('POST',{action:'restore',id:ID,expectedRevision:2});
 assert.equal(restore.status,409);
 assert.equal(responseBody(restore).code,'MISSING_ORIGINAL_FILE');
 assert.deepEqual(db.stored.get(RECORD).bytes,db.initial);
 assert.ok(![...db.stored.keys()].some(k=>k.includes('recovery-backups')));
});

test('RC1934 P0: non-admin cannot inspect or restore hidden records',async t=>{
 const old=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
 t.after(()=>{if(old===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=old});
 const db=createStore();
 const user={role:'Export',rights:{documents:{level:'edit',read:true,edit:true}}};
 t.mock.method(auth,'validateSession',async()=>({user,session:{environment:'production'}}));
 t.mock.method(auth,'environmentFromRequest',()=> 'production');
 t.mock.method(auth,'loginStorageEnvironment',()=> 'production');
 t.mock.method(BlobServiceClient,'fromConnectionString',()=>({getContainerClient:()=>db.container}));
 for(const [method,payload] of [['GET',{action:'inspect',id:ID}],['POST',{action:'restore',id:ID,expectedRevision:2}]]){
  const r=await call(method,payload);
  assert.equal(r.status,403);
  assert.equal(responseBody(r).code,'ADMIN_REQUIRED');
 }
 assert.deepEqual(db.stored.get(RECORD).bytes,db.initial);
});

test('RC1934 P0: failed safety-copy readback never changes the original',async t=>{
 const old=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
 t.after(()=>{if(old===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=old});
 const db=createStore();
 const originalGet=db.container.getBlockBlobClient.bind(db.container);
 db.container.getBlockBlobClient=key=>{
  const blob=originalGet(key);
  if(key.includes('/recovery-backups/'))return{...blob,async download(){
   return{etag:'"fake"',readableStreamBody:Readable.from([Buffer.from('tampered')])};
  }};
  return blob;
 };
 const user={role:'Administrator',rights:{documents:{level:'edit',read:true,edit:true}}};
 t.mock.method(auth,'validateSession',async()=>({user,session:{environment:'production'}}));
 t.mock.method(auth,'environmentFromRequest',()=> 'production');
 t.mock.method(auth,'loginStorageEnvironment',()=> 'production');
 t.mock.method(BlobServiceClient,'fromConnectionString',()=>({getContainerClient:()=>db.container}));
 const r=await call('POST',{action:'restore',id:ID,expectedRevision:2});
 assert.equal(r.status,503);
 assert.equal(responseBody(r).code,'BACKUP_NOT_VERIFIED');
 assert.deepEqual(db.stored.get(RECORD).bytes,db.initial);
 assert.deepEqual(db.stored.get(FILE).bytes,db.originalPhoto);
});

test('RC1934 P0: TESTSERVICE lookup cannot restore a production DOK',async t=>{
 const old={storage:process.env.EXPORTHUB_STORAGE_CONNECTION_STRING,isolation:process.env.EXPORTHUB_TEST_AUTH_ISOLATION};
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
 delete process.env.EXPORTHUB_TEST_AUTH_ISOLATION;
 t.after(()=>{
  if(old.storage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=old.storage;
  if(old.isolation===undefined)delete process.env.EXPORTHUB_TEST_AUTH_ISOLATION;else process.env.EXPORTHUB_TEST_AUTH_ISOLATION=old.isolation;
 });
 const db=createStore();
 const user={role:'Administrator',rights:{documents:{level:'edit',read:true,edit:true}}};
 t.mock.method(auth,'validateSession',async()=>({user,session:{environment:'testservice'}}));
 t.mock.method(auth,'environmentFromRequest',()=> 'testservice');
 t.mock.method(auth,'loginStorageEnvironment',()=> 'testservice');
 t.mock.method(BlobServiceClient,'fromConnectionString',()=>({getContainerClient:()=>db.container}));
 const probe=await call('GET',{action:'inspect',id:ID});
 assert.equal(probe.status,200,probe.body);
 assert.equal(responseBody(probe).found,false);
 const restore=await call('POST',{action:'restore',id:ID,expectedRevision:2});
 assert.equal(restore.status,404);
 assert.deepEqual(db.stored.get(RECORD).bytes,db.initial);
 assert.ok(![...db.stored.keys()].some(k=>k.includes('recovery-backups')));
});

test('RC1934 P0: exact DOK lookup UI, translations and backup protection remain parsable',()=>{
 const ui=fs.readFileSync('assets/shipment-evidence.js','utf8');
 const i18n=fs.readFileSync('assets/i18n/shipment-evidence.js','utf8');
 const api=fs.readFileSync('api/shipment-evidence/index.js','utf8');
 assert.doesNotThrow(()=>new Function(ui));
 assert.doesNotThrow(()=>new Function(i18n));
 assert.doesNotThrow(()=>new Function('require','module',api));
 assert.match(ui,/action:'inspect',id/);
 assert.match(ui,/action:'restore',id,expectedRevision:probe\.revision/);
 assert.match(ui,/function openRecord\(id\)/);
 assert.match(api,/if\(!ctx\.isAdmin\)fail\('ADMIN_REQUIRED'/);
 assert.match(api,/ifMatch:etag/);
 assert.match(api,/ifNoneMatch:'\*'/);
 assert.match(api,/BACKUP_NOT_VERIFIED/);
 assert.match(i18n,/restoreConfirm/);
});
