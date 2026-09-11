import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);

test('RC1059: dedizierter Dokument-Container wird pro Client nur einmal geprüft/angelegt',async()=>{
  const mod=require('../api/shared/document-blob-store.js');
  let creates=0,uploads=0;
  const container={
    async createIfNotExists(){creates++;return{created:creates===1};},
    getBlockBlobClient(){return{async uploadData(){uploads++;return{etag:'"d"'}}};}
  };
  await mod.storeInlineDocument({id:'D1',data:'data:application/pdf;base64,QUJD'},{environment:'production',container});
  await mod.storeInlineDocument({id:'D2',data:'data:application/pdf;base64,REVG'},{environment:'production',container});
  assert.equal(creates,1);
  assert.equal(uploads,2);
});

test('RC1059: REST-Container unterstützt createIfNotExists für den neuen Dokument-Container',()=>{
  const source=require('node:fs').readFileSync(new URL('../api/shared/blob-rest.js',import.meta.url),'utf8');
  assert.match(source,/class\s+RestContainerClient[\s\S]*async\s+createIfNotExists\s*\(/);
});
