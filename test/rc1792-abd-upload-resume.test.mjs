import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');
const begin=src.indexOf('async function analyzeFile(file){');
const end=src.indexOf('async function start(){',begin);
assert.ok(begin>=0&&end>begin,'ABD invoice upload function required');

function harness({pollPlan=['pending','ready']}={}){
 const uploaded=[],polled=[],pendingUploads=new WeakMap();
 let requests=0;
 const scope={
  pendingUploads,
  base64:async()=> 'c3ludGhldGlj',
  post:async payload=>{
   requests++;
   uploaded.push(payload);
   return{data:{upload:{id:'synthetic-upload-'+requests}}};
  },
  poll:async(upload,fileName)=>{
   polled.push({upload,fileName});
   const mode=pollPlan.shift()||'ready';
   if(mode==='pending')throw Object.assign(new Error('Defender scan pending'),{code:'ABD_SCAN_PENDING'});
   if(mode==='blocked')throw Object.assign(new Error('blocked'),{code:'ABD_MALWARE_DETECTED'});
   if(mode==='expired')throw Object.assign(new Error('expired'),{code:'ABD_UPLOAD_EXPIRED'});
   return{ok:true,status:'ready',analysis:{positions:[]}}
  }
 };
 vm.runInNewContext(src.slice(begin,end)+'\nthis.analyzeFile=analyzeFile;',scope);
 return{analyzeFile:scope.analyzeFile,uploaded,polled,pendingUploads};
}

test('RC1792: retry resumes the same clean-pending Defender upload without another POST/upload',async()=>{
 const h=harness();
 const file={name:'invoice.csv',size:12,type:'text/csv'};
 await assert.rejects(h.analyzeFile(file),e=>e.code==='ABD_SCAN_PENDING');
 assert.equal(h.uploaded.length,1,'One initial upload only');
 assert.equal(h.pendingUploads.has(file),true,'Existing scan state is retained');
 assert.equal((await h.analyzeFile(file)).status,'ready','A subsequent status check completes');
 assert.equal(h.uploaded.length,1,'Resume must not create a second blob');
 assert.deepEqual(h.polled.map(x=>x.upload.id),['synthetic-upload-1','synthetic-upload-1']);
 assert.equal(h.pendingUploads.has(file),false,'Ready result clears the pending scan');
 await h.analyzeFile(file);
 assert.equal(h.uploaded.length,2,'A fresh, explicit re-analysis creates a fresh scan');
});

test('RC1792: malicious or expired scans cannot resume or bypass Defender',async()=>{
 for(const [firstCode,expected] of [['blocked','ABD_MALWARE_DETECTED'],['expired','ABD_UPLOAD_EXPIRED']]){
  const h=harness({pollPlan:[firstCode,'ready']});
  const file={name:'invoice.xlsx',type:'application/octet-stream'};
  await assert.rejects(h.analyzeFile(file),e=>e.code===expected);
  assert.equal(h.pendingUploads.has(file),false,'Terminal Defender state must invalidate the session upload');
  await h.analyzeFile(file);
  assert.equal(h.uploaded.length,2,'A new upload is required after a terminal scan status');
 }
});

test('RC1792: pending scan is shown as scanning, never falsely as a failed upload',()=>{
 const onPending=src.indexOf("if(e&&e.code==='ABD_SCAN_PENDING')fileLine(");
 assert.ok(onPending>0);
 assert.match(src.slice(onPending,onPending+220),/xtr\('scanPendingNote'\),'scan'/);
 assert.match(src,/pendingFiles=files\.slice\(\)/,'File objects survive an ABD form redraw');
 assert.match(src,/button\.textContent=hasPendingUploads\(\)\?xtr\('resumeScan'\):xtr\('start'\)/);
 assert.match(src,/if\(start\)start\.textContent=hasPendingUploads\(\)\?xtr\('resumeScan'\):xtr\('start'\)/);
});

test('RC1792: translation fallback contains resume guidance across all six locales',()=>{
 const begin=src.indexOf('var languageFallback={'),end=src.indexOf('function xtr(',begin);
 const scope={};
 vm.runInNewContext(src.slice(begin,end)+'\nthis.locales=languageFallback;',scope);
 for(const lang of ['de','en','pl','es','fr','it']){
  assert.ok(scope.locales[lang].resumeScan,lang+' resume button missing');
  assert.ok(scope.locales[lang].scanPendingNote,lang+' upload status missing');
 }
});

test('RC1793: delayed Defender result remains resumable and shows diagnostic instead of a false upload failure',async()=>{
 const start=src.indexOf('async function poll(upload,fileName){'),end=src.indexOf('async function analyzeFile(file){',start);
 assert.ok(start>=0&&end>start);
 const reported=[];
 let requests=0;
 const scope={
  post:async()=>{requests++;return{data:{status:'scanning',diagnosticCode:'ABD_DEFENDER_RESULT_DELAYED'}}},
  fileLine:(name,message,kind)=>reported.push({name,message,kind}),
  xtr:key=>key,
  tr:key=>key,
  q:value=>String(value||''),
  delay:async()=>{}
 };
 vm.runInNewContext(src.slice(start,end)+'\nthis.pollStatus=poll;',scope);
 await assert.rejects(scope.pollStatus({id:'existing-safe-upload-id'},'invoice.csv'),error=>error.code==='ABD_SCAN_PENDING'&&error.scanDelayed===true);
 assert.equal(requests,45);
 assert.equal(reported.some(row=>row.message==='scanDelayedNote'&&row.kind==='scan'),true);
 assert.match(src,/e\.scanDelayed\?'scanDelayedNote':'scanPendingNote'/);
});

test('RC1793: delayed-scan guidance is translated in all six locale packs',()=>{
 const feature=fs.readFileSync('assets/i18n/rc1499-exportexperte.js','utf8');
 const start=src.indexOf('var languageFallback={'),end=src.indexOf('function xtr(',start);
 const scope={};
 vm.runInNewContext(src.slice(start,end)+'\nthis.locales=languageFallback;',scope);
 for(const locale of ['de','en','pl','es','fr','it']){
  assert.ok(scope.locales[locale].scanDelayedNote,locale+' offline warning missing');
 }
 assert.equal((feature.match(/scanDelayedNote:/g)||[]).length,6,'Feature translation pack must match all six languages');
});
