import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

// Exercise the exact current production function with injected storage/Graph
// dependencies. The fixtures contain only synthetic PDF bytes; no Azure reads,
// uploads, production records, or Graph credentials are used.
const source = fs.readFileSync(new URL('../api/shared/pod-archive.js', import.meta.url), 'utf8');
const begin = source.indexOf('async function retryArchiveBackup(');
const end = source.indexOf('async function retryDriveBackup(', begin);
assert.ok(begin > 0 && end > begin, 'extract real POD backup retry implementation');

function makeRetry({record,read,graphEnabled=false,archive,drive,generate} = {}) {
  const calls = {read:0,archived:0,drive:0,regenerated:0};
  const store = {
    getRecord:async () => ({record}),
    err:(code,message,statusCode) => Object.assign(new Error(message),{code,statusCode})
  };
  const automaticPod = r => (r.podFiles||[]).find(f=>f.kind==='automatic-pod')||null;
  const readAutomaticPodBuffer=async (...args)=>{calls.read++;return read(...args)};
  const ensureAutomaticPod=async (...args)=>{calls.regenerated++;return generate?generate(...args):{generated:true}};
  const saveAzureArchive=async (...args)=>{calls.archived++;return archive(...args)};
  const copyToDrive=async (...args)=>{calls.drive++;return drive(...args)};
  const m365Enabled=()=>graphEnabled;
  const graphDrive={readiness:()=>({configured:graphEnabled})};
  const confirmedDriveBackup=()=>false;
  const fn=new Function('store','automaticPod','readAutomaticPodBuffer',
    'ensureAutomaticPod','saveAzureArchive','copyToDrive','m365Enabled',
    'graphDrive','confirmedDriveBackup','text',
    source.slice(begin,end)+';return retryArchiveBackup;')(
    store,automaticPod,readAutomaticPodBuffer,ensureAutomaticPod,
    saveAzureArchive,copyToDrive,m365Enabled,graphDrive,confirmedDriveBackup,
    value=>String(value??'').trim()
  );
  return {fn,calls};
}

function fixture() {
  const original=Buffer.from('%PDF-1.4\n'+('ORIGINAL-SIGNED-BY-DRIVER\n').repeat(100));
  const file={
    id:'automatic-pod-historical', kind:'automatic-pod',
    layoutVersion:'RC1400-SIGNED-LOADING-LIST',
    source:'pickup-confirm-v3', blobName:'synthetic/old-pod.pdf',
    size:original.length,
    hash:crypto.createHash('sha256').update(original).digest('hex')
  };
  const record={
    reference:'SYNTH-OLD', status:'confirmed',
    podFiles:[file], podBackup:{archiveSaved:false,driveSaved:false}
  };
  return {original,file,record};
}

test('P0 POD: historical server-rendered signed PDF is copied byte-for-byte to Azure backup', async()=>{
  const {original,file,record}=fixture();
  const harness=makeRetry({
    record,
    read:async()=>({buffer:original,file}),
    archive:async(_key,_env,r,bytes,archivedFile)=>{
      assert.strictEqual(r,record);
      assert.strictEqual(bytes,original,'archive receives the original PDF Buffer, never a render');
      assert.strictEqual(archivedFile,file);
      return {record:{...record,podBackup:{archiveSaved:true,driveSaved:false}}};
    },
    drive:async()=>{throw new Error('Graph must remain disabled')}
  });
  const result=await harness.fn('synthetic-key','testservice');
  assert.equal(result.ok,true);
  assert.equal(result.archiveSaved,true);
  assert.equal(result.driveSaved,false);
  assert.strictEqual(result.file,file);
  assert.deepEqual(harness.calls,{read:1,archived:1,drive:0,regenerated:0});
});

test('P0 POD: configured Graph also receives the exact historical signed PDF', async()=>{
  const {original,file,record}=fixture();
  const harness=makeRetry({
    record,graphEnabled:true,
    read:async()=>({buffer:original,file}),
    archive:async()=>({record:{...record,podBackup:{archiveSaved:true,driveSaved:false}}}),
    drive:async(_key,_env,r,bytes,driveFile)=>{
      assert.strictEqual(bytes,original);
      assert.strictEqual(driveFile,file);
      return {ok:true,record:{...r,podBackup:{archiveSaved:true,driveSaved:true}}};
    }
  });
  const result=await harness.fn('synthetic-key','testservice');
  assert.equal(result.driveSaved,true);
  assert.deepEqual(harness.calls,{read:1,archived:1,drive:1,regenerated:0});
});

test('P0 POD: missing original refuses backup instead of recreating a different signed PDF',async()=>{
  const {record}=fixture();
  const missing=Object.assign(new Error('Original missing'),{code:'POD_FILE_NOT_STORED',statusCode:404});
  const harness=makeRetry({record,read:async()=>{throw missing;},archive:async()=>{throw new Error('must not archive');},drive:async()=>{}});
  await assert.rejects(harness.fn('synthetic-key','testservice'),e=>e===missing);
  assert.deepEqual(harness.calls,{read:1,archived:0,drive:0,regenerated:0});
});

test('P0 POD: first POD generation remains available only when no signed automatic POD exists',async()=>{
  const record={reference:'SYNTH-NEW',podFiles:[],podBackup:{}};
  const harness=makeRetry({
    record,read:async()=>null,
    archive:async()=>{throw new Error('must not archive')},
    drive:async()=>{},
    generate:async()=>({ok:true,generated:true})
  });
  const result=await harness.fn('synthetic-key','testservice');
  assert.equal(result.generated,true);
  assert.deepEqual(harness.calls,{read:1,archived:0,drive:0,regenerated:1});
});
