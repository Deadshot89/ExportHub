import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createVerifiedSnapshot}=require('../api/shared/state-backup-lifecycle.js');

function fixture({historyOnly=false,tamper=false}={}){
 const rows=new Map(),stats={uploads:0,reads:0,lists:[]};
 const container={
  rows,stats,
  getBlockBlobClient(name){
   return{
    async upload(raw,len,o){
     assert.equal(o.conditions.ifNoneMatch,'*');
     const content=Buffer.from(raw);
     assert.equal(content.length,len);
     if(rows.has(name))throw Error('OVERWRITE_FORBIDDEN');
     const etag='"E'+(rows.size+1)+'"';
     rows.set(name,{buf:content,metadata:{...o.metadata},etag});
     stats.uploads++;
     return{etag};
    },
    async getProperties(){
     const r=rows.get(name);
     if(!r)throw Error('MISSING_BLOB');
     return{etag:r.etag,metadata:{...r.metadata}};
    },
    async download(){
     const r=rows.get(name);
     if(!r)throw Error('MISSING_BLOB');
     stats.reads++;
     const buf=Buffer.from(r.buf);
     if(tamper&&buf.length)buf[0]^=0x01;
     return{etag:r.etag,readableStreamBody:Readable.from([buf])};
    }
   };
  },
  async *listBlobsFlat(opts){
   stats.lists.push(opts);
   assert.equal(opts.includeMetadata,true);
   assert.equal(opts.includeVersions,true);
   for(const [name,row] of rows)if(name.startsWith(opts.prefix)){
    yield{name,versionId:'2026-10-22T01:17:00.0000000Z',
      isCurrentVersion:historyOnly?false:true,
      metadata:{...row.metadata},deleted:false};
   }
  }
 };
 return container;
}
test('RC1632: Azure current blob VersionId is eligible for verified TESTSERVICE same-day reuse',async()=>{
 const c=fixture(),doc={revision:7,state:{shipments:[{ref:'S12345'}]}};
 const first=await createVerifiedSnapshot(c,{environment:'testservice',tier:'daily',at:'2026-10-22T01:17:00.000Z',current:doc});
 const second=await createVerifiedSnapshot(c,{environment:'testservice',tier:'daily',at:'2026-10-22T12:22:00.000Z',current:doc});
 assert.equal(second.reusedVerifiedExisting,true);
 assert.equal(second.skippedUpload,true);
 assert.equal(second.sha256,first.sha256);
 assert.equal(second.backupBlob,first.backupBlob);
 assert.equal(second.backupReadBackVerified,true);
 assert.equal(c.stats.uploads,1);
 assert.equal(c.rows.size,1);
 assert.ok(c.stats.reads>=2,'same live blob is re-read and SHA-verified');
});
test('RC1632: historical version may never be reused as if it were current',async()=>{
 const c=fixture({historyOnly:true}),doc={revision:7};
 await createVerifiedSnapshot(c,{environment:'testservice',tier:'daily',at:'2026-10-22T01:17:00.000Z',current:doc});
 const second=await createVerifiedSnapshot(c,{environment:'testservice',tier:'daily',at:'2026-10-22T10:00:00.000Z',current:doc});
 assert.equal(second.reusedVerifiedExisting,undefined);
 assert.equal(c.stats.uploads,2);
 assert.equal(c.rows.size,2);
});
test('RC1632: production backup behavior unchanged, no same-day reuse',async()=>{
 const c=fixture(),doc={revision:7};
 await createVerifiedSnapshot(c,{environment:'production',tier:'daily',at:'2026-10-22T01:17:00.000Z',current:doc});
 const second=await createVerifiedSnapshot(c,{environment:'production',tier:'daily',at:'2026-10-22T11:17:00.000Z',current:doc});
 assert.equal(second.reusedVerifiedExisting,undefined);
 assert.equal(c.stats.uploads,2);
 assert.equal(c.stats.lists.length,0);
});
test('RC1632: corrupt Azure current-version read-back fails closed, never accepts cached backup',async()=>{
 const c=fixture({tamper:false}),doc={revision:7};
 await createVerifiedSnapshot(c,{environment:'testservice',tier:'daily',at:'2026-10-22T01:17:00.000Z',current:doc});
 // Change the stored payload AFTER its verified first upload without changing metadata.
 const row=[...c.rows.values()][0]; row.buf=Buffer.from('evil-payload');
 await assert.rejects(
  ()=>createVerifiedSnapshot(c,{environment:'testservice',tier:'daily',at:'2026-10-22T11:17:00.000Z',current:doc}),
  e=>e&&e.code==='BACKUP_VERIFY_FAILED'
 );
 assert.equal(c.stats.uploads,1);
});
