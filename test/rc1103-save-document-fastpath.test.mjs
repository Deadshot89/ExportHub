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


test('RC1336: dokumentfreier Save führt keine redundante Vollkopie des bereits sanitisierten States aus',async()=>{
  let serialized=0;
  const marker={value:'unverändert',toJSON(){serialized++;return{value:this.value}}};
  const incoming={
    shipments:[{
      id:'S1',
      ref:'ABC123',
      deliveryFiles:[{name:'LS.pdf',storage:'blob',blobName:'rc1059/production/aa/hash',size:1234,mimeType:'application/pdf'}]
    }],
    tasks:[{id:'T1',meta:marker}]
  };

  const result=await store.externalizeDocumentCollections(incoming,{currentState:{},environment:'production'});

  assert.equal(result.stats.fastPath,true);
  assert.strictEqual(result.state,incoming,'Fast-Path muss den bereits sanitisierten State ohne zweite Deep-Clone-Runde weiterreichen');
  assert.equal(serialized,0,'Fast-Path darf den kompletten State nicht erneut per JSON serialisieren');
});

test('RC1336: Inline-Dokumentpfad bleibt copy-on-write und verändert den Eingang nicht',async()=>{
  const incoming={shipments:[{id:'S1',ref:'ABC123',deliveryFiles:[{name:'LS.pdf',dataUrl:'data:application/pdf;base64,SGVsbG8='}]}]};
  const before=incoming.shipments[0].deliveryFiles[0].dataUrl;
  const container={
    async createIfNotExists(){},
    getBlockBlobClient(){return{async upload(){return{};}}}
  };

  const result=await store.externalizeDocumentCollections(incoming,{currentState:{shipments:[]},environment:'production',container});

  assert.notStrictEqual(result.state,incoming);
  assert.equal(incoming.shipments[0].deliveryFiles[0].dataUrl,before);
  assert.equal(result.state.shipments[0].deliveryFiles[0].storage,'blob');
});
