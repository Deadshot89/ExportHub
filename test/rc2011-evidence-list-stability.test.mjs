import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Readable} from 'node:stream';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const apiRequire=createRequire(new URL('../api/package.json',import.meta.url));
const evidence=require('../api/shipment-evidence/index.js');
const {BlobServiceClient}=apiRequire('@azure/storage-blob');
const auth=require('../api/shared/auth-store.js');
const prefix='shipment-evidence/v1/records/';

function setup(t){
 const old=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
 t.after(()=>{if(old===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=old});
 const user={role:'Export',rights:{documents:{level:'view',read:true}}};
 t.mock.method(auth,'validateSession',async()=>({user,session:{environment:'production'}}));
 t.mock.method(auth,'environmentFromRequest',()=> 'production');
 t.mock.method(auth,'loginStorageEnvironment',()=> 'production');
 const records=[];
 for(let i=0;i<126;i++){
  const day=1+Math.floor(i/6);
  const date='202611'+String(day).padStart(2,'0');
  const id='DOK-'+date+'-'+i.toString(16).toUpperCase().padStart(8,'0');
  const modified=new Date(Date.UTC(2026,10,day,12,i%6)).toISOString();
  records.push({id,revision:1,fields:{shipmentNumber:i>=124?'SAME-SHIPMENT':'S-'+i,customer:'Kunde '+i,
   dispatchDate:'2026-11-01'},files:[],complaints:[],history:[],updatedAt:modified,createdAt:modified});
 }
 // The most recently created DOK is logically deleted, but the next one is
 // active and must be immediately visible without manual pagination.
 records.at(-1).deletedAt='2026-11-13T09:00:00Z';
 const initialBytes=new Map(records.map(x=>[prefix+x.id+'.json',Buffer.from(JSON.stringify(x))]));
 let metadataPages=0,detailsRead=0,writes=0;
 const container={
  listBlobsFlat(opts){
   assert.equal(opts.prefix,prefix);
   return{byPage({continuationToken}){return{async next(){
    metadataPages++;
    // Simulate Azure's alphabetical ASCENDING paging with a hard limit of 40.
    const begin=continuationToken?Number(continuationToken):0,end=Math.min(begin+40,records.length);
    const blobItems=records.slice(begin,end).map(x=>({name:prefix+x.id+'.json',
     properties:{lastModified:new Date(x.updatedAt)}}));
    return{value:{segment:{blobItems},continuationToken:end<records.length?String(end):null}};
   }};}};
  },
  getBlockBlobClient(path){return{
   async download(){
    detailsRead++;
    const bytes=initialBytes.get(path);
    if(!bytes)throw Object.assign(new Error('Missing'),{statusCode:404});
    return{etag:'"e1"',readableStreamBody:Readable.from([bytes])};
   },
   async uploadData(){writes++;throw new Error('Read-only test cannot mutate storage')}
  }}
 };
 t.mock.method(BlobServiceClient,'fromConnectionString',()=>({
  url:'https://unitstorage.blob.core.windows.net',getContainerClient:()=>container
 }));
 return{records,initialBytes,metrics:()=>({metadataPages,detailsRead,writes})};
}
async function get(params){
 const context={};
 await evidence(context,{method:'GET',query:{action:'list',...params},headers:{}});
 return{status:context.res.status,...JSON.parse(context.res.body)};
}

test('P0 evidence: initial list shows newest of 126 blobs, preserving same-shipment duplicates',async t=>{
 const db=setup(t);
 const first=await get({});
 assert.equal(first.status,200);
 assert.equal(first.records.length,50);
 assert.equal(first.records[0].id,db.records.at(-2).id,
  'Newest ACTIVE DOK must be on first page, not the first alphabetic blob');
 assert.ok(first.records.some(r=>r.fields.shipmentNumber==='SAME-SHIPMENT'),
  'Same shipment number must not erase or merge a DOK');
 assert.ok(!first.records.some(r=>r.id===db.records.at(-1).id),'Tombstone hidden only in normal list');
 assert.match(first.continuation,/^v2:\d{13}:DOK-/);
 const second=await get({continuation:first.continuation});
 assert.equal(second.status,200);
 assert.equal(second.records.length,50);
 const both=new Set([...first.records,...second.records].map(x=>x.id));
 assert.equal(both.size,100,'No duplicate records between sorted pages');
 const third=await get({continuation:second.continuation});
 assert.equal(third.status,200);
 assert.equal(third.records.length,25);
 assert.equal(third.continuation,null);
 assert.equal(new Set([...first.records,...second.records,...third.records].map(x=>x.id)).size,125);
 assert.equal(db.metrics().writes,0,'Listing is strictly read-only');
 assert.ok(db.metrics().metadataPages>=4,'Must scan all metadata pages, not just the first 50');
 assert.equal(db.metrics().detailsRead,126,'Only the 125 live summaries and one tombstone are opened');
 for(const [key,bytes] of db.initialBytes)assert.ok(bytes.equals(db.initialBytes.get(key)));
});

test('P0 evidence: malformed cursor fails closed; nothing is modified',async t=>{
 const db=setup(t);
 const invalid=await get({continuation:'storage-internal-token'});
 assert.equal(invalid.status,400);
 assert.equal(invalid.code,'BAD_CONTINUATION');
 assert.equal(db.metrics().writes,0);
 assert.equal(db.metrics().detailsRead,0);
});

test('P0 evidence: failed list refresh does not discard previously displayed DOK or REF',()=>{
 const ui=fs.readFileSync('assets/shipment-evidence.js','utf8');
 const from=ui.indexOf('async function loadList(reset){'),to=ui.indexOf('\nasync function loadLegacyList(reset){',from);
 assert.ok(from>0&&to>from);
 const body=ui.slice(from,to);
 assert.doesNotMatch(body,/state\.records=\[\]|state\.legacyRecords=\[\]/);
 assert.match(body,/reset\?\[\]:state\.records/);
 assert.match(body,/state\.records=\[\.\.\.merged\.values\(\)\]/);
 assert.match(body,/catch\(e\).*state\.dokError=e\.message/s);
 assert.match(body,/loadLegacyList\(true\)/,'Both reads continue independently');
 assert.doesNotThrow(()=>new Function(ui));
});
