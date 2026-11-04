import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('async function mirrorShipment(sh,force){');
const end=html.indexOf('\nasync function mirrorAll(',start);
assert.ok(start>0&&end>start);
const bytes=new TextEncoder().encode('%PDF-1.7\nSIGNED ORIGINAL\n'+'x'.repeat(1200));

function mirror({missing=false,existing=false}={}){
  const writes=[],calls={render:0,original:0};
  const win={ExportHUBPickupPOD:{syncOne:async()=>true},
    ExportHUBPODBackup:{original:async()=>{calls.original++;if(missing)throw Error('Original missing');return{bytes,name:'POD_SYNTH_Ladeliste_mit_Unterschrift.pdf'};}},
    ExportHUBIndex240:{createPodBlob:async()=>{calls.render++;return{blob:new Blob(['%PDF-REGENERATED']),name:'REGENERATED.pdf'};}}};
  const names=['window','hasSignature','ref','sid','list','low','validPdfBlob','folderInfo','writeFolder','q','store','Blob'];
  const values=[win,()=>true,()=> 'SYNTH',()=> 'synthetic',async()=>existing?[{reference:'SYNTH',officialPod:true,documentKind:'signed-loadlist',blob:new Blob(['%PDF-OLD-RENDER'])}]:[],v=>String(v??'').toLowerCase(),
    async()=>true,async()=>({connected:false}),async()=>true,v=>String(v??'').trim(),
    async(_sh,blob,name)=>writes.push({bytes:new Uint8Array(await blob.arrayBuffer()),name}),Blob];
  return{run:new Function(...names,html.slice(start,end)+';return mirrorShipment;')(...values),writes,calls};
}

test('emergency vault copies the stored signed original, never a new render',async()=>{
  const x=mirror();
  assert.equal(await x.run({ref:'SYNTH'},true),true);
  assert.equal(x.calls.render,0);
  assert.equal(x.calls.original,1);
  assert.deepEqual(x.writes[0].bytes,bytes);
});

test('missing digital original leaves emergency vault incomplete instead of making a substitute PDF',async()=>{
  const x=mirror({missing:true});
  await assert.rejects(x.run({ref:'SYNTH'},true),/Original missing/);
  assert.equal(x.calls.render,0);
  assert.equal(x.writes.length,0);
});

test('explicit vault recheck replaces a historical local render with the exact stored original',async()=>{
  const x=mirror({existing:true});
  assert.equal(await x.run({ref:'SYNTH'},true),true);
  assert.equal(x.calls.original,1);
  assert.deepEqual(x.writes[0].bytes,bytes);
});
