import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const store=require('../api/shared/document-blob-store.js');

function blobContainer({fail=false}={}){
  const uploads=[];
  return{
    uploads,
    getBlockBlobClient(name){
      return{
        async uploadData(bytes,options){
          if(fail)throw Object.assign(new Error('AZURE_TEST_UPLOAD_FAILED'),{code:'AZURE_TEST_UPLOAD_FAILED'});
          uploads.push({name,bytes:Buffer.from(bytes),options});
          return{etag:'"test-document"'};
        },
        async upload(bytes,_length,options){
          return this.uploadData(bytes,options);
        }
      };
    }
  };
}
const pdf=Buffer.from('%PDF-1.4\n%%EOF','utf8');
const encoded='data:application/pdf;base64,'+pdf.toString('base64');
const file=id=>({id,name:'Original-ABD.pdf',mimeType:'application/pdf',data:encoded});

test('RC1663: sharedShipments is an authoritative document-externalization root',()=>{
  assert.ok(store.ROOT_COLLECTIONS.includes('sharedShipments'));
  for(const root of ['shipments','savedShipments','abdRequests','packNotifications','packDrafts']){
    assert.ok(store.ROOT_COLLECTIONS.includes(root),'previous document root must stay: '+root);
  }
});

test('RC1663: a shared shipment ABD is blob-backed before the Azure team-state merge',async()=>{
  const container=blobContainer();
  const input={
    shipments:[{id:'SHIP-A',ref:'8BAGGQ',status:'Wartet auf ABD',abdFiles:[]}],
    sharedShipments:[{id:'SHIP-A',ref:'8BAGGQ',status:'Wartet auf ABD',abdFiles:[file('ABD-8BAGGQ')]}],
    savedShipments:[{id:'SHIP-B',ref:'9Z7L82',abdFiles:[]}]
  };
  const result=await store.externalizeDocumentCollections(input,{environment:'testservice',container});
  const stored=result.state.sharedShipments[0].abdFiles[0];
  const hash=crypto.createHash('sha256').update(pdf).digest('hex');
  assert.equal(result.stats.fastPath,false,'a shared ABD must not skip externalization');
  assert.equal(result.stats.externalized,1);
  assert.equal(stored.storage,'blob');
  assert.equal(stored.sha256,hash);
  assert.equal(stored.size,pdf.length);
  assert.match(stored.blobName,new RegExp('^rc1059/testservice/'+hash.slice(0,2)+'/'+hash+'$'));
  assert.equal(stored.data,undefined,'no embedded PDF may remain in shared team state');
  assert.equal(stored.name,'Original-ABD.pdf');
  assert.equal(container.uploads.length,1);
  assert.deepEqual(container.uploads[0].bytes,pdf);
  assert.equal(result.state.shipments[0].status,'Wartet auf ABD','status gate must remain intact');
  assert.equal(result.state.savedShipments[0].abdFiles.length,0,'another shipment remains untouched');
  assert.equal(input.sharedShipments[0].abdFiles[0].data,encoded,'input and original evidence remain untouched');
});

test('RC1663: a new shared ABD is externalized without rewriting legacy files',async()=>{
  const container=blobContainer();
  const legacy=file('OLD-ABD');
  const existing={sharedShipments:[{id:'S1',ref:'9Z7L82',abdFiles:[legacy]}]};
  const incoming={sharedShipments:[{id:'S1',ref:'9Z7L82',abdFiles:[legacy,file('NEW-ABD')]}]};
  const result=await store.externalizeDocumentCollections(incoming,{environment:'production',container,currentState:existing});
  const docs=result.state.sharedShipments[0].abdFiles;
  assert.equal(docs.length,2);
  assert.equal(docs[0].data,encoded,'historical inline ABD is not silently migrated');
  assert.equal(docs[1].storage,'blob');
  assert.equal(docs[1].data,undefined);
  assert.equal(result.stats.legacySkipped,1);
  assert.equal(result.stats.externalized,1);
  assert.equal(container.uploads.length,1);
});

test('RC1663: shared ABD Azure failure fails closed and does not return a false save',async()=>{
  const container=blobContainer({fail:true});
  const incoming={sharedShipments:[{id:'S2',ref:'9Z7L82',abdFiles:[file('NEW-ABD')]}]};
  await assert.rejects(
    store.externalizeDocumentCollections(incoming,{environment:'production',container}),
    /AZURE_TEST_UPLOAD_FAILED/
  );
  assert.equal(incoming.sharedShipments[0].abdFiles[0].data,encoded);
});

test('RC1663: a saved shared ABD blob reference wins over a stale browser inline copy',async()=>{
  const container=blobContainer();
  const hash='b'.repeat(64),previous={
    id:'ABD-PREVIOUS',name:'Original-ABD.pdf',storage:'blob',sha256:hash,
    blobName:'rc1059/production/bb/'+hash,size:pdf.length,mimeType:'application/pdf'
  };
  const result=await store.externalizeDocumentCollections(
    {sharedShipments:[{id:'SHIP-3',ref:'8BAGGQ',abdFiles:[file('ABD-PREVIOUS')]}]},
    {environment:'production',container,currentState:{sharedShipments:[{id:'SHIP-3',ref:'8BAGGQ',abdFiles:[previous]}]}}
  );
  const after=result.state.sharedShipments[0].abdFiles[0];
  assert.equal(after.blobName,previous.blobName);
  assert.equal(after.sha256,previous.sha256);
  assert.equal(after.data,undefined);
  assert.equal(result.stats.blobReused,1);
  assert.equal(container.uploads.length,0);
});
