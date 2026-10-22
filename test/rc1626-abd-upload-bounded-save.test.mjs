import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const first=builder.indexOf('function patchRc1617AbdUploadFailureFeedback(');
const last=builder.indexOf('function patchRc1602OfficialPod(',first);
assert.ok(first>=0&&last>first,'RC1617-RC1626 builders must be present');
const patchers=vm.runInNewContext(builder.slice(first,last)+'\n({a:patchRc1617AbdUploadFailureFeedback,b:patchRc1619AbdFailClosedRollback,c:patchRc1626AbdUploadBoundedSave})');
const built=patchers.c(patchers.b(patchers.a(fs.readFileSync('index.html','utf8'),'index.html'),'index.html'),'index.html');

function harness({queueAdvances=true,flush,syncNow}={}){
  let now=0,flushCalls=0;
  const FakeDate=class extends Date{static now(){return now}};
  const runtime={changeGeneration:1,lastSavedGeneration:1,saving:false,lastSaveErrorCode:''};
  const clean={
    runtime,
    native:{setTimeout:(fn,ms)=>{now+=ms;setImmediate(fn)}},
    queueSave(){if(queueAdvances)runtime.changeGeneration++;return queueAdvances},
    flushSave(){flushCalls++;return flush?flush(runtime):false}
  };
  const s={shipments:[]};
  const context={
    Date:FakeDate,Math,Number,Promise,setImmediate,
    window:{ExportHUBClean:clean,setTimeout:clean.native.setTimeout,ExportHUBSync:syncNow?{syncNow}:undefined},
    S:()=>s,A:x=>Array.isArray(x)?x:[],Q:x=>String(x==null?'':x).trim(),L:x=>String(x==null?'':x).trim().toLowerCase(),
    shipmentId:x=>String(x&&x.id||''),shipmentRef:x=>String(x&&x.ref||''),
    abdRequestsForShipment:()=>[],applyAbdDocumentDurably:()=>{},
  };
  const start=built.indexOf('function rc1626Wait(');
  const end=built.indexOf('function overrideUploads(){',start);
  assert.ok(start>0&&end>start,'RC1626 helpers are built before the central uploader');
  vm.runInNewContext(built.slice(start,end)+'\nthis.flush=flushDocumentUpload;this.verify=verifyAbdUploadAfterAzure;this.saveError=rc1626SaveError;',context);
  return {context,s,runtime,elapsed:()=>now,calls:()=>flushCalls};
}

test('RC1626: a temporarily failing Azure save fails within 60 s after at most 3 attempts',async()=>{
  const h=harness({flush:rt=>{rt.lastSaveErrorCode='STATE_API_UNREACHABLE';return false}});
  assert.equal(await h.context.flush('ABD als PDF dauerhaft gespeichert'),false);
  assert.ok(h.calls()<=3,'no 250 ms retry storm: '+h.calls()+' calls');
  assert.ok(h.elapsed()<=60000,'failure reported after '+h.elapsed()+' ms');
  assert.equal(h.context.saveError(h.context.window.ExportHUBClean),'STATE_API_UNREACHABLE');
});

test('RC1626: a save that never answers still ends within the deadline',async()=>{
  const h=harness({flush:()=>new Promise(()=>{})});
  assert.equal(await h.context.flush('ABD als PDF dauerhaft gespeichert'),false);
  assert.ok(h.elapsed()<=60000,'failure reported after '+h.elapsed()+' ms');
  assert.equal(h.context.saveError(h.context.window.ExportHUBClean),'AZURE_SAVE_UNCONFIRMED');
});

test('RC1626: an unqueued save is never counted as stored',async()=>{
  const h=harness({queueAdvances:false});
  assert.equal(await h.context.flush('ABD als PDF dauerhaft gespeichert'),false);
  const ok=harness({queueAdvances:false,flush:()=>true});
  assert.equal(await ok.context.flush('ABD als PDF dauerhaft gespeichert'),true,'a confirmed flushSave still counts');
});

test('RC1626: a confirmed save succeeds with a single attempt',async()=>{
  const h=harness({flush:rt=>{rt.lastSavedGeneration=rt.changeGeneration;return true}});
  assert.equal(await h.context.flush('ABD als PDF dauerhaft gespeichert'),true);
  assert.equal(h.calls(),1);
});

test('RC1626: verify settles even when the server sync never answers',async()=>{
  const h=harness({flush:()=>false,syncNow:()=>new Promise(()=>{})});
  const item={id:'ABD-1'};
  h.s.shipments.push({id:'SHIP-9Z7L82',ref:'9Z7L82',abdDone:true,abdFiles:[{id:'ABD-1',status:'active'}]});
  assert.equal(await h.context.verify({id:'SHIP-9Z7L82',ref:'9Z7L82'},item),true);
  assert.ok(h.elapsed()<=20000,'verify waited '+h.elapsed()+' ms');
});

test('RC1626: the ABD failure names the Azure error and POD keeps its message',()=>{
  assert.match(built,/Azure-Speicherung konnte nicht bestätigt werden \('\+rc1626SaveError\(window\.ExportHUBClean\)\+'\)\./);
  assert.match(built,/kind==='abd'\?' konnte nicht dauerhaft in Azure gespeichert werden \('/);
  assert.ok(built.includes("' wurde lokal übernommen, konnte aber noch nicht dauerhaft in Azure bestätigt werden."),'POD alert unchanged');
  assert.equal(built.split('async function flushDocumentUpload(reason){').length,2);
});

test('RC1626: the 90 s hint keeps the upload tracked for the final result',()=>{
  const policy=fs.readFileSync('assets/rc1049-abd-avis-policy.js','utf8');
  const start=policy.indexOf('function trackCentralAbd(');
  const body=policy.slice(start,policy.indexOf('var savedUploadInFlight',start));
  assert.ok(start>0&&!/entry\.done=true/.test(body),'the timeout must not close the entry');
});

test('RC1626: ABD analysis reports a 2xx without JSON instead of "Upload-ID fehlt"',async()=>{
  const src=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');
  const start=src.indexOf('async function post(payload){');
  const end=src.indexOf('async function base64(',start);
  const responses=[{ok:true,status:202,raw:'',type:''},{ok:true,status:200,raw:'<html>',type:'text/html'}];
  for(const r of responses){
    const context={JSON,Error,q:v=>String(v==null?'':v).trim(),headers:()=>({}),
      w:{fetch:async()=>({ok:r.ok,status:r.status,headers:{get:()=>r.type},text:async()=>r.raw})}};
    vm.runInNewContext(src.slice(start,end)+'\nthis.post=post;',context);
    await assert.rejects(context.post({action:'upload'}),e=>e.code==='ABD_ANALYSIS_INVALID_RESPONSE'&&e.message.includes('HTTP '+r.status));
  }
  const ok={JSON,Error,q:v=>String(v==null?'':v).trim(),headers:()=>({}),
    w:{fetch:async()=>({ok:true,status:202,headers:{get:()=>'application/json'},text:async()=>'{"upload":{"id":"x:pdf"}}'})}};
  vm.runInNewContext(src.slice(start,end)+'\nthis.post=post;',ok);
  assert.equal((await ok.post({action:'upload'})).data.upload.id,'x:pdf');
});
