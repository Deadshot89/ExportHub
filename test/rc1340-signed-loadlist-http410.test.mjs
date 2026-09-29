import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const merge=require('../api/shared/merge.js');
const archiveSource=fs.readFileSync('api/shared/pod-archive.js','utf8');
const backupSource=fs.readFileSync('api/pod-backup/index.js','utf8');

function durablePod(overrides={}){
  return {
    id:'automatic-pod-1',
    kind:'automatic-pod',
    name:'POD_ABC123_Abliefernachweis.pdf',
    type:'application/pdf',
    storage:'azure',
    blobName:'rc995/production/'+'a'.repeat(64)+'/automatic/POD_ABC123_Abliefernachweis.pdf',
    storageBlobName:'rc995/production/'+'a'.repeat(64)+'/automatic/POD_ABC123_Abliefernachweis.pdf',
    source:'pickup-confirm-v2',
    ...overrides
  };
}
function publicTokenPod(overrides={}){
  return {
    id:'QR-POD-ABC123',
    kind:'signed-loadlist',
    name:'POD_ABC123_Ladeliste_mit_Unterschrift.pdf',
    url:'/api/pickup-pod?token='+'b'.repeat(64),
    source:'QR-Abholung',
    remote:true,
    ...overrides
  };
}

test('RC1340: newer browser state cannot replace durable signed POD with pickup token URL',()=>{
  const server={
    id:'S1',ref:'ABC123',updatedAt:'2026-09-29T08:00:00.000Z',
    podFiles:[durablePod()]
  };
  const incoming={
    id:'S1',ref:'ABC123',updatedAt:'2026-09-29T09:00:00.000Z',
    podFiles:[publicTokenPod()]
  };
  const out=merge.mergeShipmentProtected(server,incoming);
  assert.equal(out.podFiles.length,1);
  assert.equal(out.podFiles[0].kind,'automatic-pod');
  assert.match(out.podFiles[0].blobName,/^rc995\/production\//);
  assert.equal(out.podFiles[0].url,undefined);
});

test('RC1340: durable POD keeps blob route even when stale token URL exists on same file',()=>{
  const out=merge.mergePodFilesProtected(
    [durablePod({id:'same'})],
    [publicTokenPod({id:'same'})]
  );
  assert.equal(out.length,1);
  assert.equal(out[0].id,'same');
  assert.ok(out[0].blobName);
  assert.equal(out[0].url,undefined);
  assert.equal(out[0].downloadUrl,undefined);
});

test('RC1340: token-only POD remains only when no durable POD exists yet',()=>{
  const transient=publicTokenPod();
  const out=merge.mergePodFilesProtected([], [transient]);
  assert.equal(out.length,1);
  assert.equal(out[0].url,transient.url);
});

test('RC1340: POD backup does not persist public pickup token into internal team state',()=>{
  assert.match(backupSource,/store\.updateTeam\(record, \[\], ''\)/);
  assert.doesNotMatch(backupSource,/store\.updateTeam\(record, \[\], rawToken\)/);
});

test('RC1340: archived POD reconcile repairs already affected team-state links once',()=>{
  assert.match(archiveSource,/TEAM_POD_LINK_VERSION\s*=\s*'RC1340'/);
  assert.match(archiveSource,/teamRelinkCandidates\.push/);
  assert.match(archiveSource,/await store\.updateTeam\(candidate\.record, \[\], ''\)/);
  assert.match(archiveSource,/record\.teamPodLinkVersion\s*=\s*TEAM_POD_LINK_VERSION/);
  assert.match(archiveSource,/teamRelinkedCount/);
});

test('RC1340: changed server files remain syntactically valid',()=>{
  for(const file of ['api/shared/merge.js','api/shared/pod-archive.js','api/pod-backup/index.js']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});
