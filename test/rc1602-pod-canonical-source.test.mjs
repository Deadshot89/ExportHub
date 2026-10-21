import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const req=createRequire(import.meta.url);
const podArchive=req('../api/shared/pod-archive.js');
const access=req('../api/shared/public-access-store.js');
const store=req('../api/shared/pickup-store.js');
const pickupPod=req('../api/pickup-pod/index.js');
const source=fs.readFileSync(new URL('../api/shared/pod-archive.js',import.meta.url),'utf8');
const endpoint=fs.readFileSync(new URL('../api/pickup-pod/index.js',import.meta.url),'utf8');

test('RC1602: browser-captured POD is never identified as current server A4',()=>{
  assert.equal(podArchive.isCurrentAutomaticPod({kind:'automatic-pod',layoutVersion:'RC1602-CLIENT-SUPPLIED-UNVERIFIED'}),false);
  assert.equal(podArchive.isCurrentAutomaticPod({kind:'automatic-pod',layoutVersion:podArchive.POD_PDF_LAYOUT_VERSION}),true);
  assert.match(source,/clientSupplied === true/);
  assert.match(source,/Object\.assign\(\{\}, options, \{ clientSupplied: true \}\)/);
  assert.match(source,/layoutversion: layoutVersion/);
  assert.match(source,/source: options && options\.clientSupplied/);
});

test('RC1602: authorized pickup token may request server canonical PDF without exposing signature image',async()=>{
  const saved={resolve:access.resolve,getRecord:store.getRecord,pickupComplete:store.pickupComplete,getPodDownload:podArchive.getPodDownload};
  const pdf=Buffer.from('%PDF-1.7\n'+'x'.repeat(1100));
  try{
    access.resolve=async()=>({resourceKey:'a'.repeat(64),environment:'production'});
    store.getRecord=async()=>({record:{confirmedAt:'2026-10-21T11:00:00Z',signatureBlobName:'real-driver-signature'}});
    store.pickupComplete=()=>true;
    podArchive.getPodDownload=async()=>({buffer:pdf});
    const ctx={log:{error(){}}};
    await pickupPod(ctx,{method:'GET',query:{token:'controlled-test-token',file:'automatic'},headers:{}});
    assert.equal(ctx.res.status,200);
    assert.equal(ctx.res.isRaw,true);
    assert.equal(ctx.res.headers['Content-Type'],'application/pdf');
    assert.deepEqual(ctx.res.body,pdf);
    assert.match(endpoint,/fileId==='automatic'/);
  }finally{
    access.resolve=saved.resolve;store.getRecord=saved.getRecord;
    store.pickupComplete=saved.pickupComplete;podArchive.getPodDownload=saved.getPodDownload;
  }
});

test('RC1602: automatic-PDF query is not a public bypass: access must still resolve via pickup token',async()=>{
  const original=access.resolve;
  try{
    access.resolve=async()=>{const e=new Error('Access denied');e.code='INVALID_TOKEN';e.status=403;throw e};
    const ctx={log:{error(){}}};
    await pickupPod(ctx,{method:'GET',query:{file:'automatic'},headers:{}});
    assert.equal(ctx.res.status,403);
    assert.equal(ctx.res.body.code,'INVALID_TOKEN');
  }finally{access.resolve=original}
});

test('RC1602 / 8LSUHW: historical pickup POD receives delivery notes from matching shipment without changing originals',async()=>{
  const before={shipmentId:'shipment-8',reference:'8LSUHW',rows:[{type:'Karton',count:2}],signatureBlobName:'signed-blob'};
  const clone=JSON.stringify(before);
  const team={state:{
    shipments:[{id:'shipment-other',ref:'OTHER1',deliveryFiles:[{name:'WRONG.pdf'}]},
      {id:'shipment-8',ref:'8LSUHW',deliveryFiles:[{name:'SIDE250071282.pdf'}]}],
    savedShipments:[{id:'shipment-8',ref:'8LSUHW',deliveryFiles:[
      {name:'SIDE250071282.pdf'},{name:'DNC3019222063.pdf'},
      {name:'DELETED.pdf',status:'deleted'}]}]
  }};
  const read=store.readJson;
  let reads=0;
  try{
    store.readJson=async()=>{reads++;return{value:team}};
    const result=await podArchive.resolvePodDeliveryNotes(before,
      {team:{getBlockBlobClient:()=>({})}},'production');
    assert.equal(reads,1);
    assert.deepEqual(result.deliveryNotes,['SIDE250071282.pdf','DNC3019222063.pdf']);
    assert.equal(JSON.stringify(before),clone,'existing signed record must remain unchanged');
    assert.deepEqual(result.rows,before.rows,'confirmed packing rows cannot be replaced by newer team data');
  }finally{store.readJson=read}
});

test('RC1602: if historical delivery note evidence cannot be read, do not generate an incomplete POD',async()=>{
  const original=store.readJson;
  try{
    store.readJson=async()=>{throw new Error('Azure unavailable')};
    await assert.rejects(
      podArchive.resolvePodDeliveryNotes({reference:'8LSUHW'},{
        team:{getBlockBlobClient:()=>({})}
      },'production'),
      e=>e.code==='POD_DELIVERY_NOTES_READ_FAILED'
    );
  }finally{store.readJson=original}
});
