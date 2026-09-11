import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);

function fakeContainer({failUpload=false}={}){
  const uploads=[];
  return {
    uploads,
    getBlockBlobClient(name){
      return {
        async uploadData(buffer,options={}){
          if(failUpload)throw new Error('upload failed');
          uploads.push({name,buffer:Buffer.from(buffer),options});
          return {etag:'"doc-1"'};
        },
        async upload(buffer,length,options={}){
          if(failUpload)throw new Error('upload failed');
          uploads.push({name,buffer:Buffer.from(buffer),length,options});
          return {etag:'"doc-1"'};
        }
      };
    }
  };
}

test('RC1059: Inline-Data-URL wird dekodiert, normale URL bleibt extern',async()=>{
  const mod=require('../api/shared/document-blob-store.js');
  const payload=mod.extractInlinePayload({data:'data:application/pdf;base64,QUJD'});
  assert.equal(payload.buffer.toString(),'ABC');
  assert.equal(payload.mimeType,'application/pdf');
  assert.equal(mod.extractInlinePayload({url:'https://example.invalid/a.pdf'}),null);
});

test('RC1059: Inline-Dokument wird hashbasiert im TESTSERVICE abgelegt und im State verschlankt',async()=>{
  const mod=require('../api/shared/document-blob-store.js');
  const container=fakeContainer();
  const out=await mod.storeInlineDocument(
    {id:'D1',name:'LS.pdf',mimeType:'application/pdf',data:'data:application/pdf;base64,QUJD'},
    {environment:'testservice',container}
  );
  const hash=crypto.createHash('sha256').update(Buffer.from('ABC')).digest('hex');
  assert.equal(out.storage,'blob');
  assert.equal(out.sha256,hash);
  assert.equal(out.size,3);
  assert.equal(out.mimeType,'application/pdf');
  assert.match(out.blobName,new RegExp('^rc1059/testservice/'+hash.slice(0,2)+'/'+hash+'$'));
  assert.equal(out.data,undefined);
  assert.equal(container.uploads.length,1);
  assert.equal(container.uploads[0].buffer.toString(),'ABC');
});

test('RC1059: doppelte data/dataUrl-Payload wird vollständig aus dem State entfernt',async()=>{
  const mod=require('../api/shared/document-blob-store.js');
  const container=fakeContainer();
  const dataUrl='data:application/pdf;base64,QUJD';
  const out=await mod.storeInlineDocument({id:'D2',name:'LS2.pdf',data:dataUrl,dataUrl},{environment:'production',container});
  assert.equal(out.storage,'blob');
  assert.equal(out.data,undefined);
  assert.equal(out.dataUrl,undefined);
  assert.equal(container.uploads.length,1);
});

test('RC1059: Fehlgeschlagener Blob-Upload erzeugt keine tote Referenz',async()=>{
  const mod=require('../api/shared/document-blob-store.js');
  const container=fakeContainer({failUpload:true});
  await assert.rejects(
    ()=>mod.storeInlineDocument({id:'D1',data:'data:application/pdf;base64,QUJD'},{environment:'production',container}),
    /upload failed/
  );
});

test('RC1059: bekannte Dokumentlisten werden rekursiv externalisiert, URLs bleiben unverändert',async()=>{
  const mod=require('../api/shared/document-blob-store.js');
  const container=fakeContainer();
  const input={
    shipments:[{id:'S1',deliveryFiles:[{id:'LS1',data:'data:application/pdf;base64,QUJD'}],podFiles:[{id:'P1',url:'https://example.invalid/pod.pdf'}]}],
    savedShipments:[{id:'S2',generatedDocuments:[{id:'G1',payload:'REVG'}]}],
    abdRequests:[{id:'A1',abdFiles:[{id:'A1F',base64:'R0hJ'}]}]
  };
  const result=await mod.externalizeDocumentCollections(input,{environment:'production',container});
  assert.equal(result.state.shipments[0].deliveryFiles[0].storage,'blob');
  assert.equal(result.state.shipments[0].podFiles[0].url,'https://example.invalid/pod.pdf');
  assert.equal(result.state.savedShipments[0].generatedDocuments[0].storage,'blob');
  assert.equal(result.state.abdRequests[0].abdFiles[0].storage,'blob');
  assert.equal(result.stats.externalized,3);
  assert.equal(container.uploads.length,3);
});

test('RC1059: vorhandene Legacy-Datei wird bei normalem Save nicht still migriert, neue Datei schon',async()=>{
  const mod=require('../api/shared/document-blob-store.js');
  const container=fakeContainer();
  const old='data:application/pdf;base64,T0xE';
  const fresh='data:application/pdf;base64,TkVX';
  const currentState={shipments:[{id:'S1',deliveryFiles:[{id:'OLD-1',name:'Alt.pdf',data:old}]}]};
  const incoming={shipments:[{id:'S1',deliveryFiles:[{id:'OLD-1',name:'Alt.pdf',data:old},{id:'NEW-1',name:'Neu.pdf',data:fresh}]}]};
  const result=await mod.externalizeDocumentCollections(incoming,{environment:'production',container,currentState});
  assert.equal(result.state.shipments[0].deliveryFiles[0].data,old);
  assert.equal(result.state.shipments[0].deliveryFiles[0].storage,undefined);
  assert.equal(result.state.shipments[0].deliveryFiles[1].storage,'blob');
  assert.equal(result.stats.externalized,1);
  assert.equal(result.stats.legacySkipped,1);
  assert.equal(container.uploads.length,1);
});

test('RC1059: bereits serverseitig ausgelagerte Datei gewinnt gegen stale Inline-Kopie des Browsers',async()=>{
  const mod=require('../api/shared/document-blob-store.js');
  const container=fakeContainer();
  const hash='c'.repeat(64),old='data:application/pdf;base64,T0xE';
  const blobFile={id:'D1',name:'LS.pdf',storage:'blob',blobName:`rc1059/production/cc/${hash}`,sha256:hash,size:3,mimeType:'application/pdf'};
  const currentState={shipments:[{id:'S1',deliveryFiles:[blobFile]}]};
  const incoming={shipments:[{id:'S1',deliveryFiles:[{id:'D1',name:'LS.pdf',data:old}]}]};
  const result=await mod.externalizeDocumentCollections(incoming,{environment:'production',container,currentState});
  assert.equal(result.state.shipments[0].deliveryFiles[0].storage,'blob');
  assert.equal(result.state.shipments[0].deliveryFiles[0].blobName,blobFile.blobName);
  assert.equal(result.state.shipments[0].deliveryFiles[0].data,undefined);
  assert.equal(container.uploads.length,0);
});

test('RC1059: State-Save externalisiert nur eingehenden State vor saveMerged und kennt aktuellen Server-State',()=>{
  const source=fs.readFileSync(new URL('../api/exporthub-state/index.js',import.meta.url),'utf8');
  assert.match(source,/document-blob-store/);
  assert.match(source,/externalizeDocumentCollections/);
  assert.match(source,/documentContainer/);
  const normalizePos=source.indexOf('const normalized=normalizeIncoming(payload)');
  const externalizePos=source.indexOf('externalizeDocumentCollections',normalizePos);
  const savePos=source.indexOf('saveMerged(',normalizePos);
  assert.ok(normalizePos>=0&&externalizePos>normalizePos&&savePos>externalizePos,'Externalisierung muss zwischen normalizeIncoming und saveMerged liegen');
  assert.match(source.slice(externalizePos,savePos),/currentState\s*:\s*current\.team&&current\.team\.state/);
  assert.doesNotMatch(source,/externalizeDocumentCollections\(current\.team/);
});
