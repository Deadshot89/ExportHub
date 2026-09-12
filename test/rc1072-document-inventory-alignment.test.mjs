import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const store=require('../api/shared/document-blob-store.js');
const stateSource=fs.readFileSync(new URL('../api/exporthub-state/index.js',import.meta.url),'utf8');

function dataUrl(text,mime='application/pdf'){
  return `data:${mime};base64,${Buffer.from(text).toString('base64')}`;
}

test('RC1072: gemeinsame Inventur zählt nur wirklich migrierbare Inline-Dokumente',()=>{
  const state={
    shipments:[{
      id:'S1',
      deliveryFiles:[
        {id:'valid',name:'valid.pdf',dataUrl:dataUrl('VALID')},
        {id:'text',name:'note.txt',content:'X'.repeat(5000)},
        {id:'blob',name:'done.pdf',storage:'blob',blobName:'rc1059/production/aa/done'}
      ]
    }],
    savedShipments:[{
      id:'S2',
      podFiles:[{id:'payload',name:'pod.pdf',payload:Buffer.from('POD').toString('base64')}]
    }]
  };
  const inv=store.legacyDocumentInventory(state);
  assert.equal(inv.found,2);
  assert.equal(inv.entries.length,2);
  assert.equal(inv.skipped,1);
  assert.equal(inv.inlineBytes,8);
  assert.equal(inv.candidateCount,1);
  assert.ok(inv.candidateBytes>=5000);
});

test('RC1072: nicht-base64 lange Inhalte bleiben Diagnosekandidaten und lösen keine Migration aus',()=>{
  const state={shipments:[{id:'S1',generatedDocuments:[{id:'html',content:'<html>'+('a'.repeat(6000))+'</html>'}]}]};
  const inv=store.legacyDocumentInventory(state);
  assert.equal(inv.found,0);
  assert.equal(inv.entries.length,0);
  assert.equal(inv.candidateCount,1);
});

test('RC1072: Health verwendet exakt dieselbe gemeinsame Dokumentinventur wie die Migration',()=>{
  assert.match(stateSource,/legacyDocumentInventory/);
  assert.match(stateSource,/inlinePayloadCount:inventory\.found/);
  assert.match(stateSource,/documentPayloadBytes:inventory\.inlineBytes/);
  assert.match(stateSource,/inlinePayloadCandidateCount:inventory\.candidateCount/);
  assert.match(stateSource,/inlinePayloadCandidateBytes:inventory\.candidateBytes/);
  assert.doesNotMatch(stateSource,/isPayloadKey&&s\.length>1024/);
});

test('RC1072: Recovery bleibt an den exakten inlinePayloadCount gebunden',()=>{
  const startup=fs.readFileSync(new URL('../assets/rc1067-startup-recovery.js',import.meta.url),'utf8');
  assert.match(startup,/stateDiagnostics&&data\.stateDiagnostics\.inlinePayloadCount/);
  assert.doesNotMatch(startup,/inlinePayloadCandidateCount/);
});
