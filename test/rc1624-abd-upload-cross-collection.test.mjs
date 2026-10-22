import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Validate the actual assembled production HTML, not a mock implementation.
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const start=builder.indexOf('function patchRc1624AbdUploadCrossCollection(');
const end=builder.indexOf('function patchRc1602OfficialPod(',start);
assert.ok(start>=0&&end>start,'RC1624 builder is wired');
const patch=vm.runInNewContext(builder.slice(start,end)+'\npatchRc1624AbdUploadCrossCollection');
const canonical=fs.readFileSync('index.html','utf8');
const html=patch(canonical,'index.html');

function runRuntime(seed){
  const fstart=html.indexOf('function shipmentDocumentCopies(sh){');
  const fend=html.indexOf('async function verifyAbdUploadAfterAzure(',fstart);
  assert.ok(fstart>=0&&fend>fstart,'RC1624 functions in built HTML');
  const context={
    S:()=>seed,
    shipmentId:x=>String(x?.id||''),
    shipmentRef:x=>String(x?.ref||''),
    A:x=>Array.isArray(x)?x:[],
    L:x=>String(x||'').toLowerCase(),
    Q:x=>String(x??'').trim(),
    clone:x=>structuredClone(x),
    documentHistory:x=>x.documentHistory||(x.documentHistory=[]),
    recalculateShipmentStatus:x=>{x.status=x.abdDone?'Bereit zur Abholung':'Wartet auf ABD'},
    Date,Promise,window:{},console
  };
  vm.runInNewContext(html.slice(fstart,fend),context);
  return context;
}

test('RC1624: existing savedShipment is updated together with live shipment and its ABD request',()=>{
  const live={id:'SHIP-9Z7L82',ref:'9Z7L82',abdRequired:true,abdDone:false,abdStatus:'Wartet auf ABD'};
  const saved={id:'SHIP-9Z7L82',ref:'9Z7L82',abdRequired:true,abdDone:false,abdStatus:'Wartet auf ABD'};
  const req={id:'REQ-9Z7L82',ref:'9Z7L82',linkedShipmentId:live.id,status:'Angefragt',abdFiles:[]};
  const unrelated={id:'SHIP-X',ref:'OTHER1',abdDone:false,abdStatus:'Wartet auf ABD'};
  const state={shipments:[live,unrelated],savedShipments:[saved],abdRequests:[req]};
  const env=runRuntime(state);
  env.applyAbdDocumentDurably(live,{id:'ABD-NEW',name:'test.pdf',data:'data:application/pdf;base64,JVBERi0xLjQK'});
  for(const sh of [live,saved]){
    assert.equal(sh.abdDone,true);
    assert.equal(sh.abdStatus,'Abgeschlossen');
    assert.equal(sh.abdFiles.length,1);
    assert.equal(sh.abdFiles[0].id,'ABD-NEW');
  }
  assert.equal(req.done,true);
  assert.equal(req.abdFiles[0].id,'ABD-NEW');
  assert.equal(unrelated.abdFiles,undefined,'other shipment must not receive ABD');
});

test('RC1624: conflicting IDs and references are never cross-updated',()=>{
  const sh={id:'SHIP-9Z7L82',ref:'9Z7L82'};
  const conflictId={id:'SHIP-9Z7L82',ref:'OTHER1'};
  const conflictRef={id:'SHIP-OTHER',ref:'9Z7L82'};
  const exact={id:'SHIP-9Z7L82',ref:'9Z7L82'};
  const s={shipments:[sh],savedShipments:[conflictId,conflictRef,exact],abdRequests:[]};
  const c=runRuntime(s);
  c.applyAbdDocumentDurably(sh,{id:'ABD-NEW'});
  assert.equal(exact.abdDone,true);
  assert.equal(conflictId.abdFiles,undefined);
  assert.equal(conflictRef.abdFiles,undefined);
});

test('RC1624: manual ABD persistence uses userInitiated to avoid background-save deferral',async()=>{
  const c=runRuntime({shipments:[],savedShipments:[],abdRequests:[]});
  const calls=[];
  c.window.ExportHUBClean={
    runtime:{changeGeneration:0,saving:false},
    queueSave:async reason=>calls.push(['queue',reason]),
    flushSave:async(reason,options)=>{calls.push(['flush',reason,options]);return true;}
  };
  assert.equal(await c.flushDocumentUpload('ABD als PDF dauerhaft gespeichert'),true);
  assert.equal(calls[1][2].force,true);
  assert.equal(calls[1][2].userInitiated,true);
  calls.length=0;
  assert.equal(await c.flushDocumentUpload('ABD nach Serverabgleich verbindlich nachgespeichert'),true);
  assert.equal(calls[1][2].userInitiated,true);
  calls.length=0;
  assert.equal(await c.flushDocumentUpload('POD als PDF dauerhaft gespeichert'),true);
  assert.equal(calls[1][2].userInitiated,false,'existing POD write policy stays unchanged');
});

test('RC1624: explicit ABD flush cannot claim confirmation when Azure rejects it',async()=>{
  const c=runRuntime({shipments:[],savedShipments:[],abdRequests:[]});
  c.window.ExportHUBClean={runtime:{changeGeneration:0,saving:false},
    queueSave:async()=>true,flushSave:async()=>false};
  // Skip the deadline-bound retry loop by advancing Date within the sandbox.
  let tick=0;
  c.Date=class extends Date {static now(){tick+=18000;return tick}};
  // Re-compile the function with the fake Date and no actual timers.
  const fstart=html.indexOf('async function flushDocumentUpload(');
  const fend=html.indexOf('async function verifyAbdUploadAfterAzure(',fstart);
  vm.runInNewContext(html.slice(fstart,fend),c);
  c.window.setTimeout=fn=>fn();
  assert.equal(await c.flushDocumentUpload('ABD als PDF dauerhaft gespeichert'),false);
});
