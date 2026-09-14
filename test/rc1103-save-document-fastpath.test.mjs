import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const store=require('../api/shared/document-blob-store.js');

test('RC1103: Save ohne Inline-Dokumente überspringt den großen bestehenden Dokumentbestand',async()=>{
  const incoming={
    shipments:[{
      id:'S1',
      ref:'ABC123',
      deliveryFiles:[{name:'LS.pdf',storage:'blob',blobName:'rc1059/production/aa/hash',size:1234,mimeType:'application/pdf'}]
    }],
    tasks:[{id:'T1',title:'Test'}]
  };
  const currentState={};
  Object.defineProperty(currentState,'shipments',{
    enumerable:true,
    get(){throw new Error('Bestehender Dokumentbestand wurde unnötig gelesen');}
  });

  const result=await store.externalizeDocumentCollections(incoming,{currentState,environment:'production'});

  assert.equal(result.state.shipments[0].deliveryFiles[0].blobName,'rc1059/production/aa/hash');
  assert.equal(result.stats.externalized,0);
  assert.equal(result.stats.inlineBytes,0);
  assert.equal(result.stats.fastPath,true);
});

test('RC1103: Inline-Dokumente bleiben weiterhin im normalen Externalisierungspfad',async()=>{
  const incoming={shipments:[{id:'S1',ref:'ABC123',deliveryFiles:[{name:'LS.pdf',dataUrl:'data:application/pdf;base64,SGVsbG8='}]}]};
  const container={
    async createIfNotExists(){},
    getBlockBlobClient(){
      return {
        async upload(){return{};}
      };
    }
  };

  const result=await store.externalizeDocumentCollections(incoming,{currentState:{shipments:[]},environment:'production',container});
  assert.equal(result.stats.fastPath,false);
  assert.equal(result.stats.externalized,1);
  assert.equal(result.state.shipments[0].deliveryFiles[0].storage,'blob');
});
