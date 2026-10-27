import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
// Replace the external Azure transport at the module boundary. The real POD
// archive code and real SHA-256 checks still execute against in-memory blobs.
const store={POD_BACKUP_CONTAINER:'exporthub-pod-backup',err:(code,message,status=400)=>Object.assign(new Error(message),{code,status})};
const storeModule=require.resolve('../api/shared/pickup-store.js');
require.cache[storeModule]={id:storeModule,filename:storeModule,loaded:true,exports:store};
const graph=require('../api/shared/graph-drive.js');
const archive=require('../api/shared/pod-archive.js');

const originalPdf=Buffer.from('%PDF-1.7\nORIGINAL SIGNED LOADING LIST\n'+'A'.repeat(1300));
const previousHash='b'.repeat(64);

async function withArchiveStore(graphUpload,run,graphVerify){
  const previous={};
  const methods=['getRecord','readBuffer','mutateRecord','podArchiveClient','podPrefix','normalizeEnvironment','now'];
  methods.forEach(name=>previous[name]=store[name]);
  const oldGraph={readiness:graph.readiness,uploadPdf:graph.uploadPdf,verifyPdf:graph.verifyPdf};
  const blobs=new Map(),steps=[];
  let record={reference:'ABC123',confirmedAt:'2026-10-27T08:00:00Z',signatureBlobName:'signature',
    podFiles:[{id:'automatic-pod-'+previousHash.slice(0,16),kind:'automatic-pod',hash:previousHash}],
    podBackup:{azureSaved:true,archiveSaved:true,driveSaved:true,hash:previousHash,driveItemId:'previous-drive-item',webUrl:'https://old.invalid'}};
  function blob(name){return{
    async uploadData(data){steps.push('azure:'+name);if(!blobs.has(name))blobs.set(name,Buffer.from(data))},
    async getProperties(){const data=blobs.get(name);return{contentLength:data.length,metadata:{sha256:crypto.createHash('sha256').update(data).digest('hex')}}},
    name
  }}
  const client={getBlockBlobClient:blob,getBlobClient:blob};
  try{
    store.getRecord=async()=>({record,clients:{pods:client}});
    store.mutateRecord=async(_key,_environment,change)=>{record=change(record);return record};
    store.readBuffer=async item=>{
      if(!blobs.has(item.name))throw Object.assign(new Error('Blob not found'),{statusCode:404});
      return{buffer:blobs.get(item.name)};
    };
    store.podArchiveClient=async()=>({podArchive:client});
    store.podPrefix=()=> 'test/pods';
    store.normalizeEnvironment=()=> 'testservice';
    store.now=()=> '2026-10-27T08:01:00.000Z';
    graph.readiness=()=>({configured:true});
    graph.uploadPdf=async(data,name)=>{steps.push('drive');return graphUpload(Buffer.from(data),name)};
    graph.verifyPdf=async(data,receipt)=>{
      steps.push('drive-readback');
      if(graphVerify)return graphVerify(Buffer.from(data),receipt);
      if(!receipt||!receipt.id)throw Object.assign(new Error('Graph item ID missing'),{code:'GRAPH_UPLOAD_RECEIPT_INVALID'});
      return{verified:true,hash:crypto.createHash('sha256').update(data).digest('hex'),size:data.length,verifiedAt:store.now()};
    };
    return await run({blobs,steps,getRecord:()=>record,setRecord:next=>{record=next}});
  }finally{
    methods.forEach(name=>store[name]=previous[name]);
    graph.readiness=oldGraph.readiness;
    graph.uploadPdf=oldGraph.uploadPdf;
    graph.verifyPdf=oldGraph.verifyPdf;
  }
}

test('P0: client-supplied signed original is archived before the identical PDF is copied to SharePoint',async()=>{
  await withArchiveStore(async(bytes,name)=>{
    assert.deepEqual(bytes,originalPdf);
    assert.equal(name,'POD_ABC123_Ladeliste_unterschrieben.pdf');
    return{id:'new-drive-item',name,size:bytes.length,webUrl:'https://graph.invalid/new-drive-item'};
  },async ({steps,getRecord,blobs})=>{
    const result=await archive.saveSuppliedPod('a'.repeat(64),'testservice',getRecord(),originalPdf,'POD_ABC123_Ladeliste_unterschrieben.pdf',{renderLayout:'RC1595'});
    const backup=result.record.podBackup;
    assert.equal(result.driveSaved,true);
    assert.equal(backup.driveSaved,true);
    assert.equal(backup.driveItemId,'new-drive-item');
    assert.equal(backup.archiveSaved,true);
    assert.equal(backup.hash,crypto.createHash('sha256').update(originalPdf).digest('hex'));
    assert.deepEqual(steps.slice(-2),['drive','drive-readback'],'verified Graph readback must follow immutable Azure archive and upload');
    assert.ok(steps.some(step=>step.includes('rc1220/')),'immutable archive has to be written first');
    const archived=blobs.get(backup.archiveBlobName);
    assert.deepEqual(archived,originalPdf,'saved PDF must be the supplied signed original');
  });
});

test('P0: Graph failure never reuses previous SharePoint success for a new signed PDF',async()=>{
  await withArchiveStore(async()=>{throw Object.assign(new Error('Missing folder'),{code:'ResourceNotFound'})},async ({getRecord})=>{
    const result=await archive.saveSuppliedPod('a'.repeat(64),'testservice',getRecord(),originalPdf,'POD_ABC123_Ladeliste_unterschrieben.pdf',{renderLayout:'RC1595'});
    assert.equal(result.driveSaved,false);
    assert.equal(result.record.podBackup.archiveSaved,true,'Azure archive remains available');
    assert.equal(result.record.podBackup.driveSaved,false,'previous Drive confirmation must be revoked');
    assert.equal(result.record.podBackup.driveItemId,'','stale SharePoint file must not be shown as new POD');
    assert.match(result.record.podBackup.driveLastError,/ResourceNotFound/);
  });
});

test('P0: retry reuses supplied original bytes instead of rerendering the signed load list',async()=>{
  await withArchiveStore(async(bytes,name)=>({id:'drive-'+name,name,size:bytes.length}),async ({getRecord,steps})=>{
    await archive.saveSuppliedPod('a'.repeat(64),'testservice',getRecord(),originalPdf,'POD_ABC123_Ladeliste_unterschrieben.pdf',{renderLayout:'RC1595'});
    const previousUploads=steps.filter(x=>x.startsWith('azure:')).length;
    const next=await archive.retryArchiveBackup('a'.repeat(64),'testservice');
    assert.equal(next.driveSaved,true);
    assert.equal(steps.filter(x=>x.startsWith('azure:')).length,previousUploads+1,'only existing immutable archive may be verified/written again');
  });
});

test('P0: missing primary POD is copied to SharePoint from hash-verified immutable archive',async()=>{
  await withArchiveStore(async(bytes,name)=>{
    assert.deepEqual(bytes,originalPdf);
    return{id:'recovered-drive',name,size:bytes.length};
  },async ({blobs,getRecord})=>{
    await archive.saveSuppliedPod('a'.repeat(64),'testservice',getRecord(),originalPdf,'POD_ABC123_Ladeliste_unterschrieben.pdf',{renderLayout:'RC1595'});
    const primary=getRecord().podFiles.find(f=>f.kind==='automatic-pod');
    blobs.delete(primary.blobName);
    const retried=await archive.retryArchiveBackup('a'.repeat(64),'testservice');
    assert.equal(retried.driveSaved,true);
    assert.equal(retried.record.podBackup.driveItemId,'recovered-drive');
    assert.deepEqual(blobs.get(retried.record.podBackup.archiveBlobName),originalPdf);
  });
});

test('RC1694 P0: a signed POD without a stored blob reference fails closed instead of generating another loading list',async()=>{
  await withArchiveStore(async()=>{throw new Error('Graph upload must not run')},async({getRecord,setRecord,steps})=>{
    const record=getRecord();
    record.podFiles=[{id:'SIGNED-UNLINKED',kind:'automatic-pod',source:'pickup-client-supplied',
      hash:crypto.createHash('sha256').update(originalPdf).digest('hex'),size:originalPdf.length}];
    setRecord(record);
    await assert.rejects(()=>archive.retryArchiveBackup('a'.repeat(64),'testservice'),
      error=>error&&error.code==='POD_FILE_NOT_STORED'&&error.status===404);
    assert.deepEqual(steps,[], 'no Azure or Microsoft Graph write may happen for an unlinked signed POD');
    assert.equal(getRecord().podFiles[0].id,'SIGNED-UNLINKED','original POD entry must be preserved');
  });
});

test('P0: browser batch backup selects stored original bytes without calling a local PDF renderer',async()=>{
  const html=fs.readFileSync('index.html','utf8');
  const marker='async function savedSignedPod(sh){';
  const from=html.indexOf(marker),to=html.indexOf('\nfunction ',from);
  assert.ok(from>0&&to>from,'stored original selection function exists in current browser bundle');
  const code=html.slice(from,to);
  const blob=new Blob([originalPdf],{type:'application/pdf'});
  const calls=[];
  const win={ExportHUBRC1602OfficialPOD:{
    storedSignedBlob:async()=>{calls.push('stored');return blob},
    canonicalPdf:async()=>{calls.push('server');throw new Error('canonical path must not be called')}
  }};
  const stored=new Function('window','fileFormat','ref',code+'\nreturn savedSignedPod;')(
    win,bytes=>Buffer.from(bytes.subarray(0,5)).toString()==='%PDF-'?'pdf':'',()=> 'ABC123'
  );
  const result=await stored({reference:'ABC123'});
  assert.deepEqual(Buffer.from(result.bytes),originalPdf);
  assert.deepEqual(calls,['stored']);
  const controller=html.slice(html.indexOf('<script id="rc455-pod-backup-controller">'),html.indexOf('</script>',html.indexOf('<script id="rc455-pod-backup-controller">')));
  assert.ok(controller.includes('await savedSignedPod(sh)'),'batch download must use stored original selector');
  assert.ok(!controller.includes('await localSignedPod(sh)'),'batch download must not silently rerender a POD');
});

test('P0: production, TESTSERVICE and demo bundles all use the same original-POD batch download',()=>{
  for(const name of ['index.html','TESTVERSION.html','demo.html']){
    const bundle=fs.readFileSync('dist-rc1112/'+name,'utf8');
    const start=bundle.indexOf('<script id="rc455-pod-backup-controller">');
    const end=bundle.indexOf('</script>',start);
    assert.ok(start>=0&&end>start,name+' has a POD backup controller');
    const controller=bundle.slice(start,end);
    assert.match(controller,/async function savedSignedPod\(sh\)/,name+' must load original PDFs');
    assert.match(controller,/await savedSignedPod\(sh\)/,name+' must use original PDFs in ZIP');
    assert.doesNotMatch(controller,/await localSignedPod\(sh\)/,name+' must not rerender backups');
  }
});

test('P0: UI never calls an Azure-only response a successful SharePoint backup',async()=>{
  const html=fs.readFileSync('index.html','utf8');
  const from=html.indexOf('async function backupBlob(sh,out,options){',html.indexOf('<script id="exporthub-rc479-sharepoint-pod-backup-controller">'));
  const to=html.indexOf('\nasync function buildAndBackup(',from);
  assert.ok(from>0&&to>from,'cloud backup controller is available');
  const script=html.slice(from,to);
  const dispatch=[],persist=[];
  const window={dispatchEvent:event=>dispatch.push(event)};
  const patch=(sh,values)=>Object.assign(sh,values);
  const names=['window','inflight','key','q','saved','retryAllowed','assertOfficialPdf','patch','bytesBase64','post','token','ref','sid','confirmedAt','save','pauseAutomatic'];
  const values=[window,{},()=> 'abc123',v=>String(v??'').trim(),()=>false,()=>true,async()=>true,
    patch,()=> 'valid-base64',async()=>({ok:true,saved:true,azureSaved:true,archiveSaved:true,driveSaved:false,
      driveItemId:'',fileName:'POD_ABC123_Ladeliste_unterschrieben.pdf',savedAt:'2026-10-27T09:00:00Z',lastError:'ResourceNotFound'}),
    ()=> 'pickup-token',()=> 'ABC123',()=> 'shipment-123',()=> '2026-10-27T08:00:00Z',reason=>{persist.push(reason);return true},()=>{}];
  const backupBlob=new Function(...names,script+'\nreturn backupBlob;')(...values);
  const sh={reference:'ABC123'};
  const result=await backupBlob(sh,{blob:new Blob([originalPdf],{type:'application/pdf'}),name:'POD_ABC123_Ladeliste_unterschrieben.pdf'},{force:true});
  assert.equal(result.saved,false,'Azure success is not a SharePoint confirmation');
  assert.equal(sh.podCloudBackupStatus,'pending');
  assert.notEqual(sh.podCloudBackupStatus,'saved');
  assert.equal(dispatch.length,0,'SharePoint success event must not be emitted');
  assert.ok(persist.every(reason=>!reason.includes('in SharePoint gesichert')),'persisted state must not claim SharePoint success');
});

test('P0: SharePoint success gate is present in all three release variants',()=>{
  for(const name of ['index.html','TESTVERSION.html','demo.html']){
    const html=fs.readFileSync('dist-rc1112/'+name,'utf8');
    const start=html.indexOf('<script id="exporthub-rc479-sharepoint-pod-backup-controller">');
    const end=html.indexOf('</script>',start);
    assert.ok(start>=0&&end>start,name+' contains cloud backup controller');
    const script=html.slice(start,end);
    assert.match(script,/driveSaved=result&&result\.driveSaved===true&&!!q\(result\.driveItemId\)/,name+' confirms real SharePoint item');
    assert.match(script,/if\(!driveSaved\)\{var pendingSave=/,name+' keeps Azure-only responses pending');
  }
});

test('P0: automatic cloud retry submits existing signed original, not another locally rendered PDF',async()=>{
  const html=fs.readFileSync('index.html','utf8');
  const from=html.indexOf('async function buildAndBackup(sh,force){',html.indexOf('<script id="exporthub-rc479-sharepoint-pod-backup-controller">'));
  const to=html.indexOf('\nasync function scan(',from);
  assert.ok(from>0&&to>from);
  let submitted=null,renders=0;
  const window={ExportHUBPickupPOD:{syncOne:async()=>{}},ExportHUBIndex240:{createPodBlob:async()=>{renders++;return{blob:new Blob([Buffer.from('%PDF-wrong')])}}},
    ExportHUBPODBackup:{original:async()=>({bytes:new Uint8Array(originalPdf),name:'POD_ABC123_Ladeliste_mit_Unterschrift.pdf'})}};
  const names=['window','hasSignature','saved','retryAllowed','automaticProofReady','backupBlob'];
  const values=[window,()=>true,()=>false,()=>true,()=>true,async(sh,out)=>{submitted=Buffer.from(await out.blob.arrayBuffer());return{saved:true}}];
  const backup=new Function(...names,html.slice(from,to)+'\nreturn buildAndBackup;')(...values);
  assert.equal(await backup({reference:'ABC123'},true),true);
  assert.equal(renders,0);
  assert.deepEqual(submitted,originalPdf);
});

test('RC1683: incomplete Graph receipt must not persist a SharePoint success',async()=>{
  await withArchiveStore(async(bytes,name)=>({name,size:bytes.length}),async({getRecord})=>{
    const result=await archive.saveSuppliedPod(
      'a'.repeat(64),'testservice',getRecord(),originalPdf,
      'POD_ABC123_Ladeliste_unterschrieben.pdf',{renderLayout:'RC1595'}
    );
    assert.equal(result.archiveSaved,true,'immutable Azure original still secured');
    assert.equal(result.driveSaved,false,'missing remote ID must fail closed');
    assert.equal(result.record.podBackup.driveSaved,false);
    assert.equal(result.record.podBackup.driveItemId,'');
    assert.match(result.record.podBackup.driveLastError,/GRAPH_UPLOAD_RECEIPT_INVALID/);
  });
});

test('RC1685: different readback PDF never persists SharePoint success',async()=>{
  await withArchiveStore(
    async(bytes,name)=>({id:'graph-present',name,size:bytes.length}),
    async({getRecord,steps})=>{
      const result=await archive.saveSuppliedPod('a'.repeat(64),'testservice',getRecord(),originalPdf,
        'POD_ABC123_Ladeliste_unterschrieben.pdf',{renderLayout:'RC1595'});
      assert.equal(result.archiveSaved,true,'Azure keeps immutable original despite Graph mismatch');
      assert.equal(result.driveSaved,false,'readback hash mismatch must fail closed');
      assert.equal(result.record.podBackup.driveSaved,false);
      assert.equal(result.record.podBackup.driveItemId,'');
      assert.equal(result.record.podBackup.driveVerifiedHash,'');
      assert.match(result.record.podBackup.driveLastError,/GRAPH_POD_READBACK_HASH_MISMATCH/);
      assert.deepEqual(steps.slice(-2),['drive','drive-readback']);
    },
    async()=>{throw Object.assign(new Error('remote file SHA differs'),{code:'GRAPH_POD_READBACK_HASH_MISMATCH'})}
  );
});

test('RC1685: verified SharePoint POD records the exact SHA-256 of the supplied original',async()=>{
  await withArchiveStore(async(bytes,name)=>({id:'verified-remote',name,size:bytes.length}),
    async({getRecord})=>{
      const result=await archive.saveSuppliedPod('a'.repeat(64),'testservice',getRecord(),originalPdf,
        'POD_ABC123_Ladeliste_unterschrieben.pdf',{renderLayout:'RC1595'});
      assert.equal(result.driveSaved,true);
      assert.equal(result.record.podBackup.driveVerifiedHash,crypto.createHash('sha256').update(originalPdf).digest('hex'));
      assert.equal(result.record.podBackup.driveVerifiedAt,'2026-10-27T08:01:00.000Z');
    });
});
