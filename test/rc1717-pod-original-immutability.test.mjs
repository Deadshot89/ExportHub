import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');
const from=archive.indexOf('async function saveSuppliedPod(');
const until=archive.indexOf('\nasync function retryArchiveBackup(',from);
assert.ok(from>=0&&until>from,'immutable signed POD guard is part of real archive function');
const fn=archive.slice(from,until);
const hashPdf=pdf=>crypto.createHash('sha256').update(pdf).digest('hex');
const signed=Buffer.from('%PDF-1.7\nSIGNED ORIGINAL '+ 'A'.repeat(1200));
const other=Buffer.from('%PDF-1.7\nMANUAL DIFFERENT '+ 'B'.repeat(1200));
const error=(code,message,status)=>Object.assign(new Error(message),{code,status});
function setup(file,steps){
 const saved=(...args)=>{steps.push('primary');return Promise.resolve({record:args[2],file:{name:'original.pdf'}})};
 const code=new Function('automaticPod','text','crypto','store','saveAzurePod','saveAzureArchive','m365Enabled','copyToDrive','readAutomaticPodBuffer',
    fn+'\nreturn saveSuppliedPod;');
 const store={err:error};
 return code(rec=>(rec.podFiles||[]).find(f=>f.kind==='automatic-pod')||null,
   v=>String(v??'').trim(),crypto,store,saved,
   async()=>{steps.push('archive');return{record:{podBackup:{archiveSaved:true}}}},
   ()=>false,async()=>{steps.push('graph')},async()=>{steps.push('read');return{buffer:signed,file:{name:'original.pdf',hash:hashPdf(signed)}}});
}

test('RC1717: separate manual upload can never overwrite automatic signed POD',async()=>{
 const steps=[],save=setup({},steps);
 await assert.rejects(()=>save('key','testservice',{reference:'ABC123',podFiles:[{kind:'automatic-pod',hash:hashPdf(signed),blobName:'automatic/a'}]},other,'POD_ABC123.pdf',{source:'manual-pod-backup-sync'}),
   e=>e.code==='POD_MANUAL_UPLOAD_NOT_ORIGINAL'&&e.status===409);
 assert.deepEqual(steps,[],'no Azure, metadata, or Graph write before rejection');
});

test('RC1717: mismatch to an existing immutable signed PDF is rejected regardless of client filename',async()=>{
 const steps=[],save=setup({},steps);
 await assert.rejects(()=>save('key','testservice',{reference:'ABC123',podFiles:[{kind:'automatic-pod',hash:hashPdf(signed),blobName:'automatic/a'}]},other,'POD_ABC123_Ladeliste_unterschrieben.pdf',{source:'stored-original'}),
   e=>e.code==='POD_SIGNED_ORIGINAL_IMMUTABLE'&&e.status===409);
 assert.deepEqual(steps,[]);
});

test('RC1717: missing integrity hash on existing blob never authorizes replacement',async()=>{
 const steps=[],save=setup({},steps);
 await assert.rejects(()=>save('key','testservice',{reference:'ABC123',podFiles:[{kind:'automatic-pod',blobName:'automatic/legacy'}]},signed,'POD_ABC123_Ladeliste_unterschrieben.pdf',{}),
   e=>e.code==='POD_SIGNED_ORIGINAL_IMMUTABLE');
 assert.deepEqual(steps,[]);
});

test('RC1717: identical signed PDF remains eligible for backup retry',async()=>{
 const steps=[],save=setup({},steps);
 const result=await save('key','testservice',{reference:'ABC123',podFiles:[{kind:'automatic-pod',hash:hashPdf(signed),blobName:'automatic/a'}]},signed,'POD_ABC123_Ladeliste_unterschrieben.pdf',{source:'stored-original'});
 assert.equal(result.archiveSaved,true);
 assert.deepEqual(steps,['read','archive'],'matching original must not rewrite its file metadata');
});

test('RC1717: the protected POD API passes the declared source to the server-side guard',()=>{
 const api=fs.readFileSync('api/pod-backup/index.js','utf8');
 assert.match(api,/saveSuppliedPod\(accessKey, resolved\.environment, record, suppliedPdf, fileName, \{ renderLayout: body\.renderLayout, source: body\.source \}\)/);
 assert.doesNotMatch(api,/source:\s*'manual-pod-backup-sync'/);
});
