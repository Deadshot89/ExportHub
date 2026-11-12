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
async function scenario({status=409,message='Cannot cancel a workflow run that is completed.',url='cancel',cancelResponses=null,pollStatus='queued',pollSha='b'.repeat(40),mainHeads=[]}={}){
 const sha='a'.repeat(40),lines=[],calls=[];
 let mainReadCount=0;
 const fetch=async(address,options={})=>{
  calls.push({url:address,method:options.method||'GET'});
  if(address.endsWith('/branches/main')){
   const current=mainHeads.length?mainHeads[Math.min(mainReadCount,mainHeads.length-1)]:sha;
   mainReadCount++;
   return reply(200,{commit:{sha:current}});
  }
  if(address.includes('/actions/workflows/'))return reply(200,{workflow_runs:[{id:123,head_sha:'b'.repeat(40),status:'in_progress'}]});
  if(address.endsWith('/actions/runs/123/cancel')){
   if(url!=='cancel')throw new Error('Test setup error');
   const n=calls.filter(c=>c.method==='POST').length-1;
   const response=cancelResponses?.[Math.min(n,cancelResponses.length-1)]||{status,message};
   return reply(response.status,{message:response.message||''});
  }
  if(address.endsWith('/actions/runs/123'))
   return reply(200,{head_sha:pollSha,status:pollStatus});
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
 assert.ok(lines.some(line=>line.includes('Main Verification 123')&&line.includes('beendet.')));
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
 assert.ok(lines.some(line=>line.includes('Main Verification 123')&&line.includes('beendet.')));
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

test('RC1538: re-read mismatch in run SHA is fatal (no cross-run cancellation)',async()=>{
 await assert.rejects(
  scenario({message:'Cannot cancel a workflow run that has not been queued yet.',pollSha:'c'.repeat(40)}),
  /SHA hat sich unerwartet geändert/
 );
});

test('RC1538 P0: main changes after LIST, do not cancel any outdated run',async()=>{
 const initial='a'.repeat(40),next='c'.repeat(40);
 const {calls,lines}=await scenario({mainHeads:[initial,next],status:204});
 assert.equal(calls.filter(x=>x.method==='POST').length,0);
 assert.ok(lines.some(line=>line.includes('main changed before cancel')));
 assert.ok(!lines.some(line=>line.includes('123')&&line.includes('beendet.')));
});

test('RC1538 P0: main changes during 409 retry, stop before another POST',async()=>{
 const initial='a'.repeat(40),next='c'.repeat(40);
 const {calls,lines}=await scenario({
  mainHeads:[initial,initial,next],
  message:'Cannot cancel a workflow run that has not been queued yet.'
 });
 assert.equal(calls.filter(x=>x.method==='POST').length,1);
 assert.ok(lines.some(line=>line.includes('main changed before cancel')));
 assert.ok(!lines.some(line=>line.includes('123')&&line.includes('beendet.')));
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
