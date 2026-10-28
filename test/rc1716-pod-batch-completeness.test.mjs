import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {patchRc1716PodBatchHtml} from '../scripts/rc1716-pod-batch-completeness.mjs';

const original=fs.readFileSync('index.html','utf8');
const patched=patchRc1716PodBatchHtml(original,'production');
const begin=patched.indexOf('function digitalOriginalAvailable(sh)');
const end=patched.indexOf('\nfunction selection()',begin);
assert.ok(begin>=0&&end>begin,'exact POD source selector must be present');

function selector(manual){
  const code=patched.slice(begin,end);
  return new Function('arr','q','low','manualPodSource','hasSignature','ref','safe','realFile','fileUrl',
    code+'\nreturn sourceList;')(
    x=>Array.isArray(x)?x:[],
    x=>String(x??'').trim(),
    x=>String(x??'').toLowerCase(),
    ()=>manual,
    ()=>true,
    ()=> 'ABC123',
    x=>String(x??'').replace(/[^A-Za-z0-9_-]/g,'_'),
    f=>!!(f&&f.url),
    f=>String(f&&f.url||'')
  );
}
const manual={kind:'manual-uploaded-pod',name:'POD_ABC123.pdf',url:'/api/pod/abc123'};

test('RC1716: manual and server-signed digital originals are both included',()=>{
  const jobs=selector(manual)({ref:'ABC123',podServerVerified:true,podFiles:[{kind:'automatic-pod'}]});
  assert.deepEqual(jobs.map(j=>j.kind),['official-signed-loadlist','manual-uploaded-pod']);
  assert.equal(jobs[0].name,'POD_ABC123_Ladeliste_mit_Unterschrift.pdf');
  assert.equal(jobs[1].name,'POD_ABC123.pdf');
});

test('RC1716: an ordinary manual POD must not invent a digital original',()=>{
  const jobs=selector(manual)({ref:'ABC123',podServerVerified:false,podFiles:[{kind:'manual-uploaded-pod'}]});
  assert.deepEqual(jobs.map(j=>j.kind),['manual-uploaded-pod']);
});


test('RC1720: all separate manual POD uploads stay in the ZIP alongside the digital original',()=>{
  const jobs=selector(manual)({ref:'ABC123',podServerVerified:true,podFiles:[
    {kind:'automatic-pod',url:'/api/pod/signed',id:'signed'},
    {kind:'manual-uploaded-pod',manualUpload:true,url:'/api/pod/abc123',id:'first'},
    {kind:'manual-uploaded-pod',manualUpload:true,url:'/api/pod/second',id:'second'},
    {kind:'manual-uploaded-pod',manualUpload:true,url:'/api/pod/second',id:'second'}
  ]});
  assert.deepEqual(jobs.map(j=>j.kind),['official-signed-loadlist','manual-uploaded-pod','manual-uploaded-pod']);
  assert.deepEqual(jobs.map(j=>j.name),[
    'POD_ABC123_Ladeliste_mit_Unterschrift.pdf','POD_ABC123.pdf','POD_ABC123_Anhang_2.pdf'
  ]);
});

test('RC1720: an automatic POD must never be misclassified as a second manual upload',()=>{
  const jobs=selector(manual)({ref:'ABC123',podFiles:[
    {kind:'manual-uploaded-pod',id:'first',url:'/api/pod/abc123',manualUpload:true},
    {kind:'automatic-pod',id:'signed',url:'/api/pod/signed',source:'pickup-confirm-v3'}
  ]});
  assert.deepEqual(jobs.map(j=>j.kind),['official-signed-loadlist','manual-uploaded-pod']);
});


test('RC1721: stored pickup signature URL is enough to retain signed original even with manual POD',()=>{
  const jobs=selector(manual)({ref:'ABC123',pickupDriverSignatureUrl:'/api/pickup-pod?signature=1',podFiles:[
    {kind:'manual-uploaded-pod',manualUpload:true,url:'/api/pod/abc123',id:'manual'}
  ]});
  assert.deepEqual(jobs.map(j=>j.kind),['official-signed-loadlist','manual-uploaded-pod']);
});

test('RC1721: server-confirmed pickup with signatureAvailable keeps signed original',()=>{
  const jobs=selector(manual)({ref:'ABC123',signatureAvailable:true,pickupConfirmedAt:'2026-10-28T10:00:00Z',podFiles:[
    {kind:'manual-uploaded-pod',manualUpload:true,url:'/api/pod/abc123'}
  ]});
  assert.deepEqual(jobs.map(j=>j.kind),['official-signed-loadlist','manual-uploaded-pod']);
});

test('RC1716: a digital signed POD without manual upload remains in backup',()=>{
  const jobs=selector(null)({ref:'ABC123',podFiles:[{kind:'automatic-pod'}]});
  assert.deepEqual(jobs.map(j=>j.kind),['official-signed-loadlist']);
});

test('RC1716: bulk ZIP counts only successfully added files and flags partial failure',()=>{
  const controller=patched.slice(patched.indexOf('<script id="rc455-pod-backup-controller">'),
    patched.indexOf('</script>',patched.indexOf('<script id="rc455-pod-backup-controller">')));
  assert.match(controller,/var entries=\[\],fail=\[\],manualSaved=0,signedSaved=0/);
  assert.match(controller,/entries\.push\(\{name:src\.name,data:loaded\.bytes\}\);manualSaved\+\+/);
  assert.match(controller,/entries\.push\(\{name:safe\(podDate\(sh\)\+'_'/);
  assert.match(controller,/signedSaved\+\+/);
  assert.match(controller,/var manualCount=manualSaved,signedCount=signedSaved,manifest=/);
  assert.match(controller,/btn\.disabled=false;return fail\.length===0/);
  assert.match(controller,/await savedSignedPod\(sh\)/);
  assert.doesNotMatch(controller,/await localSignedPod\(sh\)/);
});

test('RC1716: patch is strictly anchored, refuses duplicate/stale script and leaves external code unchanged',()=>{
  const modified=patched.replace('function sourceList(sh){','function sourceListRenamed(sh){');
  assert.throws(()=>patchRc1716PodBatchHtml(modified,'testservice'),/missing\/ambiguous source/);
  assert.throws(()=>patchRc1716PodBatchHtml(patched,'production'),/missing\/ambiguous source/);
  assert.equal(patched.slice(0,patched.indexOf('<script id="rc455-pod-backup-controller">')),
    original.slice(0,original.indexOf('<script id="rc455-pod-backup-controller">')));
});


test('RC1717: the legacy manual cloud sync never replaces the canonical digital POD',()=>{
  const controller=patched.slice(patched.indexOf('<script id="rc455-pod-backup-controller">'),
    patched.indexOf('</script>',patched.indexOf('<script id="rc455-pod-backup-controller">')));
  assert.match(controller,/async function syncManualCloudUploads\(force\)\{\/\* RC1717: keep uploaded POD separate from signed original \*\/return 0\}/);
  assert.doesNotMatch(controller,/cloud\.backupBlob\(sh/);
  assert.match(controller,/b\.archiveSaved===true&&b\.driveSaved===true/);
  assert.match(controller,/hash===verified&&!!q\(b\.driveVerifiedAt\)/);
});

test('RC1716: all 3 release bundles invoke the same patch after RC1680 canonical copy',()=>{
  const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  assert.match(builder,/import \{patchRc1716PodBatchHtml\}/);
  assert.match(builder,/patchRc1716PodBatchHtml\(patchRc1602PodBrowserHtml\(hardenAckMergeSaveHtml\(hardened\)\),file\)/);
  assert.match(builder,/for\(const file of \['index\.html','TESTVERSION\.html','demo\.html'\]\)\{/);
});
