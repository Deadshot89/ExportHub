import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const source=fs.readFileSync('api/shared/pod-archive.js','utf8');
const start=source.indexOf('async function retryDriveBackup(');
const end=source.indexOf('async function reconcilePendingBackups(',start);
assert.ok(start>0&&end>start,'extract the actual production Graph-only backup function');

function fixture() {
  const bytes=Buffer.from('%PDF-1.4\n'+('ORIGINAL SIGNED BY DRIVER\n').repeat(70));
  const hash=crypto.createHash('sha256').update(bytes).digest('hex');
  const file={id:'signed-original',kind:'automatic-pod',name:'POD_TEST.pdf',hash,size:bytes.length,blobName:'synthetic/test.pdf'};
  const backup={archiveSaved:true,archiveBlobName:'rc1220/testservice/archive.pdf',archiveSavedAt:'2026-10-28T08:30:00Z',archiveVerifiedAt:'2026-10-28T08:31:00Z',hash,driveSaved:false};
  return {bytes,hash,file,backup,record:{reference:'SYNTHETIC',podFiles:[file],podBackup:backup}};
}

function makeRetry({record,bytes,file,archiveProof={ok:true},graphEnabled=true,read,drive}={}){
  const calls={originalRead:0,archiveVerify:0,archiveRepair:0,graphUpload:0};
  const store={
    getRecord:async()=>({record,clients:{environment:'testservice'}}),
    err:(code,message,statusCode)=>Object.assign(new Error(message),{code,statusCode})
  };
  const automaticPod=r=>(r.podFiles||[]).find(f=>f.kind==='automatic-pod')||null;
  const readAutomaticPodBuffer=async()=>{calls.originalRead++;return read?read():{buffer:bytes,file}};
  const checkAzureArchive=async()=>{calls.archiveVerify++;return archiveProof};
  const retryArchiveBackup=async()=>{calls.archiveRepair++;return{ok:true,archiveSaved:true,record,backup:record.podBackup}};
  const copyToDrive=async(_key,_env,r,pdf,f)=>{
    calls.graphUpload++;
    assert.strictEqual(pdf,bytes,'Graph receives exact saved PDF, no re-rendering');
    assert.strictEqual(f,file,'Graph receives exact original signed file');
    return drive?drive(r,pdf):{ok:false,record:{...r,podBackup:{...r.podBackup,driveLastError:'BadRequest'}},error:{code:'GRAPH_REQUEST_FAILED'}};
  };
  const m365Enabled=()=>graphEnabled;
  const graphDrive={readiness:()=>({configured:graphEnabled})};
  const confirmedDriveBackup=b=>b.driveSaved===true;
  const func=new Function('store','automaticPod','readAutomaticPodBuffer','retryArchiveBackup','crypto',
    'checkAzureArchive','m365Enabled','graphDrive','copyToDrive','confirmedDriveBackup','text',
    source.slice(start,end)+';return retryDriveBackup;')(
    store,automaticPod,readAutomaticPodBuffer,retryArchiveBackup,crypto,checkAzureArchive,
    m365Enabled,graphDrive,copyToDrive,confirmedDriveBackup,v=>String(v??'').trim());
  return {func,calls};
}

test('RC1952: Graph-only failure preserves archive timestamp and never repairs existing archive',async()=>{
  const f=fixture();
  const h=makeRetry(f);
  const result=await h.func('synthetic-key','testservice');
  assert.equal(result.archiveSaved,true);
  assert.equal(result.driveSaved,false);
  assert.equal(result.record.podBackup.archiveSavedAt,f.backup.archiveSavedAt);
  assert.equal(result.record.podBackup.driveLastError,'BadRequest');
  assert.deepEqual(h.calls,{originalRead:1,archiveVerify:1,archiveRepair:0,graphUpload:1});
});

test('RC1952: successful Graph-only copy preserves immutable archive record',async()=>{
  const f=fixture();
  const h=makeRetry({...f,drive:r=>({ok:true,record:{...r,podBackup:{...r.podBackup,driveSaved:true}}})});
  const result=await h.func('synthetic-key','testservice');
  assert.equal(result.archiveSaved,true);
  assert.equal(result.driveSaved,true);
  assert.equal(result.record.podBackup.archiveSavedAt,f.backup.archiveSavedAt);
  assert.deepEqual(h.calls,{originalRead:1,archiveVerify:1,archiveRepair:0,graphUpload:1});
});

test('RC1952: an absent or incomplete Azure archive still takes mandatory Azure-repair path',async()=>{
  const f=fixture();
  for(const backup of [{...f.backup,archiveSaved:false},{...f.backup,hash:''}]){
    const h=makeRetry({...f,record:{...f.record,podBackup:backup}});
    await h.func('synthetic-key','testservice');
    assert.deepEqual(h.calls,{originalRead:0,archiveVerify:0,archiveRepair:1,graphUpload:0});
  }
});

test('RC1952: a missing Azure archive is repaired before any Graph attempt',async()=>{
  const f=fixture();
  const h=makeRetry({...f,archiveProof:{ok:false,repairable:true,code:'POD_ARCHIVE_NOT_FOUND'}});
  const result=await h.func('synthetic-key','testservice');
  assert.equal(result.archiveSaved,true);
  assert.deepEqual(h.calls,{originalRead:1,archiveVerify:1,archiveRepair:1,graphUpload:0});
});

test('RC1952: mismatching original hash or unverified archive fails closed without any Graph upload',async()=>{
  const f=fixture();
  const changed=makeRetry({...f,read:()=>({buffer:Buffer.from('%PDF-1.4\nCHANGED'),file:f.file})});
  await assert.rejects(changed.func('synthetic-key','testservice'),{code:'POD_ARCHIVE_INTEGRITY_FAILED'});
  assert.equal(changed.calls.graphUpload,0);
  assert.equal(changed.calls.archiveRepair,0);
  const corrupt=makeRetry({...f,archiveProof:{ok:false,repairable:false,code:'POD_ARCHIVE_INTEGRITY_FAILED',message:'Corrupt archive'}});
  await assert.rejects(corrupt.func('synthetic-key','testservice'),{code:'POD_ARCHIVE_INTEGRITY_FAILED'});
  assert.equal(corrupt.calls.graphUpload,0);
  assert.equal(corrupt.calls.archiveRepair,0);
});

test('RC1952: no configured Graph target leaves original and verified archive untouched',async()=>{
  const f=fixture();
  const h=makeRetry({...f,graphEnabled:false});
  const result=await h.func('synthetic-key','testservice');
  assert.equal(result.archiveSaved,true);
  assert.equal(result.driveSaved,false);
  assert.deepEqual(h.calls,{originalRead:1,archiveVerify:1,archiveRepair:0,graphUpload:0});
});

test('RC1952: bulk reconciliation uses Graph-only path without weakening required Azure repairs',()=>{
  const idx=source.indexOf('for (const candidate of selectedCandidates)');
  const block=source.slice(idx,idx+500);
  assert.match(block,/candidate\.driveOnly\s*\? await retryDriveBackup\(candidate\.accessKey, environment\)/);
  assert.match(block,/: await retryArchiveBackup\(candidate\.accessKey, environment\)/);
  assert.match(source,/async function retryArchiveBackup\([\s\S]*?const existing = await readAutomaticPodBuffer/);
  assert.match(source,/async function saveAzureArchive\([\s\S]*?conditions:\s*\{ ifNoneMatch: '\*' \}/);
});
