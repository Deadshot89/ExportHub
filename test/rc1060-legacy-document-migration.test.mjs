import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const store=require('../api/shared/document-blob-store.js');

function dataUrl(text,mime='application/pdf'){
  return `data:${mime};base64,${Buffer.from(text).toString('base64')}`;
}

function mockContainer({failNames=[]}={}){
  const blobs=new Map();
  return {
    blobs,
    async createIfNotExists(){return {succeeded:true}},
    getBlockBlobClient(name){
      return {
        async uploadData(buffer){
          if(failNames.some(v=>name.includes(v))){const e=new Error('simulated upload failure');e.code='UPLOAD_FAILED';throw e}
          blobs.set(name,Buffer.from(buffer));
          return {etag:'ok'};
        },
        async downloadToBuffer(){
          if(!blobs.has(name)){const e=new Error('missing');e.statusCode=404;throw e}
          return Buffer.from(blobs.get(name));
        }
      };
    }
  };
}

test('RC1060: migriert nur bis zum Batchlimit, verifiziert Blob und lässt bestehende Blob-Referenz unverändert', async()=>{
  assert.equal(typeof store.migrateLegacyDocuments,'function','migrateLegacyDocuments fehlt');
  const state={shipments:[{id:'S1',deliveryFiles:[
    {id:'f1',name:'one.pdf',dataUrl:dataUrl('ONE')},
    {id:'f2',name:'two.pdf',dataUrl:dataUrl('TWO')},
    {id:'f3',name:'already.pdf',storage:'blob',blobName:'rc1059/testservice/aa/already',sha256:'already',size:7,mimeType:'application/pdf'}
  ]}]};
  const container=mockContainer();
  const result=await store.migrateLegacyDocuments(state,{environment:'testservice',limit:1,container});

  assert.equal(result.found,2);
  assert.equal(result.migrated,1);
  assert.equal(result.failed,0);
  assert.equal(result.skipped,1);
  assert.equal(result.remaining,1);
  assert.equal(result.done,false);
  assert.equal(result.bytesMoved,3);

  const files=result.state.shipments[0].deliveryFiles;
  assert.equal(files[0].storage,'blob');
  assert.match(files[0].blobName,/^rc1059\/testservice\//);
  assert.equal(files[0].dataUrl,undefined);
  assert.equal(files[1].dataUrl,state.shipments[0].deliveryFiles[1].dataUrl);
  assert.deepEqual(files[2],state.shipments[0].deliveryFiles[2]);
});

test('RC1060: Verifikations-/Uploadfehler lässt Legacy-Payload bytegenau bestehen', async()=>{
  assert.equal(typeof store.migrateLegacyDocuments,'function','migrateLegacyDocuments fehlt');
  const original={id:'bad',name:'bad.pdf',dataUrl:dataUrl('BROKEN')};
  const state={shipments:[{id:'S2',podFiles:[original]}]};
  const container={
    async createIfNotExists(){return {succeeded:true}},
    getBlockBlobClient(){
      return {
        async uploadData(){throw new Error('boom')},
        async downloadToBuffer(){throw new Error('must not verify after failed upload')}
      };
    }
  };
  const result=await store.migrateLegacyDocuments(state,{environment:'production',limit:5,container});
  assert.equal(result.found,1);
  assert.equal(result.migrated,0);
  assert.equal(result.failed,1);
  assert.equal(result.remaining,1);
  assert.equal(result.done,false);
  assert.equal(result.bytesMoved,0);
  assert.deepEqual(result.state.shipments[0].podFiles[0],original);
});

test('RC1060: verschachtelter Team-State wird migriert und Benutzer-Metadaten bleiben erhalten', async()=>{
  const wrapped={
    schemaVersion:3,
    users:[{id:'U1',name:'Admin'}],
    state:{shipments:[{id:'S3',podFiles:[{id:'p1',name:'pod.pdf',dataUrl:dataUrl('WRAPPED')}] }]}
  };
  const container=mockContainer();
  const result=await store.migrateLegacyDocuments(wrapped,{environment:'testservice',limit:5,container});
  assert.equal(result.found,1);
  assert.equal(result.migrated,1);
  assert.equal(result.remaining,0);
  assert.equal(result.done,true);
  assert.deepEqual(result.state.users,wrapped.users);
  assert.equal(result.state.state.shipments[0].podFiles[0].storage,'blob');
  assert.equal(result.state.state.shipments[0].podFiles[0].dataUrl,undefined);
});

