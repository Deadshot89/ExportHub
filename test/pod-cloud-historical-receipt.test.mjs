import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function saved(sh){',html.indexOf('<script id="exporthub-rc479-sharepoint-pod-backup-controller">'));
const end=html.indexOf('\nfunction retryAllowed(',start);
assert.ok(start>0&&end>start);
const saved=new Function('q','low',html.slice(start,end)+';return saved;')(
  value=>String(value??'').trim(),value=>String(value??'').trim().toLowerCase());
const hash='a'.repeat(64),at='2026-11-04T10:00:00Z';
const historical={podCloudBackupStatus:'saved',podCloudBackupAt:at,podCloudBackupFileName:'POD_SYNTH.pdf'};

test('legacy SharePoint saved label without a verified Graph receipt must be retried',()=>{
  assert.equal(saved(historical),false);
  assert.equal(saved({...historical,podCloudBackupDriveItemId:'legacy-2xx-receipt',podCloudBackupHash:hash}),false);
});

test('matching canonical Graph readback confirms SharePoint; incomplete or mismatched proof does not',()=>{
  const proof={archiveSaved:true,driveSaved:true,driveItemId:'verified-item',hash,
    driveVerifiedHash:hash,driveVerifiedAt:at};
  assert.equal(saved({...historical,podBackup:proof}),true);
  for(const patch of [{archiveSaved:false},{driveSaved:false},{driveItemId:''},{hash:''},
    {driveVerifiedHash:'b'.repeat(64)},{driveVerifiedAt:''}]){
    assert.equal(saved({...historical,podBackup:{...proof,...patch}}),false);
  }
});

test('new verified API receipt permits subsequent checks without repeating the same backup',()=>{
  assert.equal(saved({...historical,podCloudBackupDriveItemId:'verified-item',
    podCloudBackupHash:hash,podCloudBackupDriveVerifiedAt:at}),true);
});

test('cloud upload stores the verified Graph receipt and skips only a subsequent confirmed backup',async()=>{
  const from=html.indexOf('async function backupBlob(sh,out,options){',start);
  const to=html.indexOf('\nasync function buildAndBackup(',from);
  const source=html.slice(from,to);
  let calls=0;
  const names=['window','inflight','key','q','saved','retryAllowed','assertOfficialPdf','patch','bytesBase64','post','token','ref','sid','confirmedAt','save','pauseAutomatic'];
  const values=[{dispatchEvent(){}},{},()=> 'synthetic',v=>String(v??'').trim(),saved,()=>true,async()=>true,
    (sh,patch)=>Object.assign(sh,patch),()=> 'synthetic-base64',async()=>{calls++;return{ok:true,
      archiveSaved:true,driveSaved:true,driveItemId:'verified-item',driveVerifiedAt:at,hash,
      fileName:'POD_SYNTH.pdf',savedAt:at};},()=> 'synthetic-token',()=> 'SYNTH',()=> 'synthetic',()=>at,()=>true,()=>{}];
  const backup=new Function(...names,source+';return backupBlob;')(...values);
  const sh={...historical},out={blob:new Blob(['%PDF-synthetic'])};
  assert.equal((await backup(sh,out,{})).saved,true);
  assert.equal(sh.podCloudBackupDriveVerifiedAt,at);
  assert.equal(sh.podCloudBackupHash,hash);
  assert.equal(saved(sh),true);
  assert.equal((await backup(sh,out,{})).alreadySaved,true);
  assert.equal(calls,1);
});
