import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW='.github/workflows/rc1538-testservice-main-supersession.yml';
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const content=fs.readFileSync(WORKFLOW,'utf8');
const start=content.indexOf("node <<'NODE'\n");
assert.notEqual(start,-1,'Missing RC1538 Node supersession script');
const rest=content.slice(start+"node <<'NODE'\n".length);
const stop=rest.indexOf('\n          NODE');
assert.ok(stop>=0,'Missing RC1538 Node script terminator');
const program=rest.slice(0,stop).split('\n').map(line=>line.replace(/^ {10}/,'')).join('\n');
const run=new AsyncFunction('process','fetch','console','setTimeout',program);

function reply(status,payload){
 return{status,ok:status>=200&&status<300,json:async()=>payload,text:async()=>JSON.stringify(payload)};
}
async function scenario({status=409,message='Cannot cancel a workflow run that is completed.',url='cancel',cancelResponses=null,pollStatus='queued',pollSha='b'.repeat(40),pollCreatedAt=null,forceStatus=202,forceMessage='Cannot cancel a workflow run that has not been queued yet.',pollJobCount=0,confirmForce=true,mainHeads=[]}={}){
 const sha='a'.repeat(40),lines=[],calls=[];
 let forceRequested=false,mainReadCount=0;
 const fetch=async(address,options={})=>{
  calls.push({url:address,method:options.method||'GET'});
  if(address.endsWith('/branches/main')){
   const current=mainHeads.length?mainHeads[Math.min(mainReadCount++,mainHeads.length-1)]:sha;
   return reply(200,{commit:{sha:current}});
  }
  if(address.includes('/actions/workflows/'))return reply(200,{workflow_runs:[{id:123,head_sha:'b'.repeat(40),status:'in_progress'}]});
  if(address.endsWith('/actions/runs/123/cancel')){
   if(url!=='cancel')throw new Error('Test setup error');
   const n=calls.filter(c=>c.method==='POST').length-1;
   const response=cancelResponses?.[Math.min(n,cancelResponses.length-1)]||{status,message};
   return reply(response.status,{message:response.message||''});
  }
  if(address.endsWith('/actions/runs/123/force-cancel')){
   forceRequested=true;
   return reply(forceStatus,forceStatus===409?{message:forceMessage}:{});
  }
  if(address.includes('/actions/runs/123/jobs?'))
   return reply(200,{total_count:pollJobCount,jobs:pollJobCount?[{id:999,status:'queued'}]:[]});
  if(address.endsWith('/actions/runs/123'))
   return reply(200,{head_sha:pollSha,status:forceRequested&&confirmForce&&forceStatus===202?'completed':pollStatus,created_at:pollCreatedAt});
  throw new Error('Unexpected GitHub request: '+address);
 };
 const fakeProcess={env:{GITHUB_TOKEN:'test-token',REPOSITORY:'Deadshot89/ExportHub',CURRENT_SHA:sha},exit:()=>{throw new Error('Unexpected exit')}};
 const logs={log:(...args)=>lines.push(args.join(' '))};
 await run(fakeProcess,fetch,logs,callback=>callback());
 return{lines,calls};
}

test('RC1538: GET-LIST-POST race treats only already-completed 409 as idempotent',async()=>{
 const {lines,calls}=await scenario();
 assert.equal(calls.filter(x=>x.method==='POST').length,1);
 assert.ok(lines.some(line=>line.includes('inzwischen abgeschlossen; kein Abbruch nötig')));
 assert.equal(lines.some(line=>line.includes('123')&&line.includes('beendet.')),false);
});

test('RC1538: successful cancellation is still reported correctly',async()=>{
 const {lines}=await scenario({status:204,message:''});
 assert.ok(lines.some(line=>line.includes('Main Verification 123')&&line.includes('Cancel-Annahme erhalten.')));
});

test('RC1538: unrelated 409 does not hide a permission/logic problem',async()=>{
 await assert.rejects(scenario({status:409,message:'An unrelated conflict'}),/GitHub API 409/);
});

test('RC1538: insufficient permissions remain fatal, never bypassed',async()=>{
 await assert.rejects(scenario({status:403,message:'Resource not accessible by integration'}),/GitHub API 403/);
});


test('RC1538: 409 not yet queued is retried, not falsely counted as cancelled',async()=>{
 const {lines,calls}=await scenario({cancelResponses:[
  {status:409,message:'Cannot cancel a workflow run that has not been queued yet.'},
  {status:204}
 ]});
 assert.equal(calls.filter(x=>x.method==='POST').length,2);
 assert.equal(calls.filter(x=>x.method==='GET'&&x.url.endsWith('/actions/runs/123')).length,1);
 assert.ok(lines.some(line=>line.includes('Main Verification 123')&&line.includes('Cancel-Annahme erhalten.')));
});

test('RC1538: old run finished during 409 race is not retried',async()=>{
 const {lines,calls}=await scenario({
  message:'Cannot cancel a workflow run that has not been queued yet.',
  pollStatus:'completed'
 });
 assert.equal(calls.filter(x=>x.method==='POST').length,1);
 assert.ok(lines.some(line=>line.includes('inzwischen abgeschlossen; kein Abbruch nötig')));
});

test('RC1538: persistent not-yet-queued conflict remains fatal after bounded retries',async()=>{
 await assert.rejects(
  scenario({message:'Cannot cancel a workflow run that has not been queued yet.'}),
  /nach 5 Versuchen noch nicht abbrechbar/
 );
});

test('RC1538: stale queued 409 invokes force-cancel only after five failed normal attempts',async()=>{
 const oldCreated=new Date(Date.now()-60*60*1000).toISOString();
 const {lines,calls}=await scenario({
  message:'Cannot cancel a workflow run that has not been queued yet.',
  pollCreatedAt:oldCreated
 });
 assert.equal(calls.filter(x=>x.url.endsWith('/cancel')&&x.method==='POST').length,5);
 assert.equal(calls.filter(x=>x.url.endsWith('/force-cancel')&&x.method==='POST').length,1);
 assert.ok(lines.some(x=>x.includes('force-cancel durch GitHub abgeschlossen bestätigt')));
});

test('RC1538: force-cancel 409 with old queued run and 0 jobs is an explicit UNRESOLVED warning',async()=>{
 const createdAt='2025-01-01T00:00:00.000Z';
 const {lines,calls}=await scenario({
  message:'Cannot cancel a workflow run that has not been queued yet.',
  pollCreatedAt:createdAt,forceStatus:409,pollJobCount:0
 });
 assert.equal(calls.filter(x=>x.method==='POST'&&x.url.endsWith('/cancel')).length,5);
 assert.equal(calls.filter(x=>x.method==='POST'&&x.url.endsWith('/force-cancel')).length,1);
 assert.equal(calls.filter(x=>x.url.includes('/actions/runs/123/jobs?')).length,1);
 assert.ok(lines.some(x=>x.includes('::warning::RC1538 QUEUE_GHOST')&&x.includes('NOT CANCELLED')));
 assert.equal(lines.some(x=>x.includes('force-cancel durch GitHub abgeschlossen bestätigt')),false);
 assert.ok(lines.some(x=>x.includes('1 GitHub QUEUE_GHOST unresolved')));
});

test('RC1538: force-cancel 409 stays fatal if queued jobs exist, run is active/new, or GitHub 409 differs',async()=>{
 const base={message:'Cannot cancel a workflow run that has not been queued yet.',pollCreatedAt:'2025-01-01T00:00:00.000Z',forceStatus:409};
 await assert.rejects(scenario({...base,pollJobCount:1}),/force-cancel returned 409 without confirmed/);
 // Active or newer queues are rejected BEFORE reaching force-cancel.
 await assert.rejects(scenario({...base,pollStatus:'in_progress'}),/nach 5 Versuchen noch nicht abbrechbar/);
 await assert.rejects(scenario({...base,pollCreatedAt:'2099-01-01T00:00:00.000Z'}),/nach 5 Versuchen noch nicht abbrechbar/);
 await assert.rejects(scenario({...base,forceMessage:'Other GitHub 409 conflict'}),/GitHub API 409/);
});

test('RC1538: force-cancel 202 without completed readback stays red',async()=>{
 await assert.rejects(scenario({
  message:'Cannot cancel a workflow run that has not been queued yet.',
  pollCreatedAt:new Date(Date.now()-60*60*1000).toISOString(),
  confirmForce:false,
  pollJobCount:1
 }),/not confirmed by GitHub/);
});

test('RC1538: force-cancel 202 not confirmed and queue has 0 jobs is unresolved, never confirmed',async()=>{
 const {lines}=await scenario({
  message:'Cannot cancel a workflow run that has not been queued yet.',
  pollCreatedAt:'2025-01-01T00:00:00.000Z',
  confirmForce:false,pollJobCount:0
 });
 assert.ok(lines.some(x=>x.includes('::warning::RC1538 QUEUE_GHOST')));
 assert.ok(lines.every(x=>!x.includes('force-cancel durch GitHub abgeschlossen bestätigt')));
});

test('RC1518: RC1538 recovery preserves SHA-isolated native concurrency and stale-deploy guard',()=>{
 const main=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
 assert.match(main,/group: exporthub-rc1112-three-env-\$\{\{ github\.ref \}\}-\$\{\{ github\.sha \}\}/);
 assert.match(main,/RC1381 TESTSERVICE stale-deploy guard/);
 assert.ok(main.indexOf('RC1381 TESTSERVICE stale-deploy guard')<main.indexOf('Deploy ExportHUB TESTSERVICE'));
});

test('RC1538: re-read mismatch in run SHA is fatal (no cross-run cancellation)',async()=>{
 await assert.rejects(
  scenario({message:'Cannot cancel a workflow run that has not been queued yet.',pollSha:'c'.repeat(40)}),
  /SHA hat sich unerwartet geändert/
 );
});

test('RC1538: a newer main after LIST prevents all cancel and force-cancel requests',async()=>{
 const initial='a'.repeat(40),newMain='c'.repeat(40);
 const {lines,calls}=await scenario({mainHeads:[initial,newMain],status:204});
 assert.equal(calls.filter(x=>x.method==='POST').length,0);
 assert.ok(lines.some(x=>x.includes('main changed before cancel')));
 assert.ok(!lines.some(x=>x.includes('123')&&x.includes('Cancel-Annahme erhalten.')));
});

test('RC1538: a newer main during repeated 409 prevents further cancel or force-cancel',async()=>{
 const initial='a'.repeat(40),newMain='c'.repeat(40);
 const {lines,calls}=await scenario({mainHeads:[initial,initial,newMain],message:'Cannot cancel a workflow run that has not been queued yet.'});
 assert.equal(calls.filter(x=>x.method==='POST').length,1);
 assert.ok(lines.some(x=>x.includes('main changed before cancel')));
 assert.equal(calls.filter(x=>x.url.endsWith('/force-cancel')).length,0);
});

test('RC1903: live smoke includes token and cross-origin security proofs',()=>{
 const smoke=fs.readFileSync('scripts/rc1903-testservice-guest-live.mjs','utf8');
 const exactSHA="assert.equal(healthData?.deployment?.buildId,sha";
 const creation="request('POST','public-create'";
 assert.ok(smoke.indexOf(exactSHA)>=0&&smoke.indexOf(exactSHA)<smoke.indexOf(creation));
 assert.match(smoke,/assert\.equal\(noToken\.status,403/);
 assert.match(smoke,/assert\.equal\(wrongOrigin\.status,403/);
 assert.match(smoke,/TESTSERVICE/);
});
