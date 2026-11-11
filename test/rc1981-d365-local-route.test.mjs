import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workspace=fs.readFileSync('assets/rc1940-documents-workspace.js','utf8');
const local=fs.readFileSync('assets/rc1962-d365-local-import.js','utf8');
const api=fs.readFileSync('api/abd-analysis/index.js','utf8');

function harness({mode='invoice',files=[{name:'D365-export.xlsx',size:4096}],
  localAvailable=true,parsed=true}={}){
 const begin=workspace.indexOf('  async function runScan(){');
 const end=workspace.indexOf('\n  function lang()',begin);
 assert.ok(begin>=0&&end>begin,'test must exercise actual runScan source, not a substitute');
 const source=workspace.slice(begin,end);
 const logs={localMount:[],localReads:[],remoteReads:[],statuses:[],updates:0};
 const mockLocal={
  mount(m){logs.localMount.push(m);return true},
  async readSelectedFile(f){logs.localReads.push(f);return parsed}
 };
 const w={
  ExportHUBRC1962D365LocalImport:localAvailable?mockLocal:undefined,
  ExportHUBRC1294ABDAnalysis:{
   async analyzeFile(f){
    logs.remoteReads.push(f);
    return{analysis:{positions:[{itemNumber:'SYNTHETIC',quantity:1}]}}
   }
  }
 };
 const factory=new Function('w','lastMode','chosenFiles','uploadStatus',
  'ut','localD365Text','refreshUpload',
  'var scanBusy=false,scanPending=false,pendingScanFiles=[],scanResults=[];\n'+
  source+'\nreturn {runScan,getState:()=>({scanBusy,scanPending,scanResults,pendingScanFiles})};');
 const obj=factory(w,mode,files,
  (msg,kind)=>logs.statuses.push({msg,kind}),
  k=>k,k=>k,()=>{logs.updates++});
 return{...obj,logs,files};
}

test('RC1981: one invoice XLSX goes ONLY to existing browser worker, never Azure upload',async()=>{
 const f=harness();
 assert.equal(await f.runScan(),true);
 assert.deepEqual(f.logs.localMount,['invoice']);
 assert.equal(f.logs.localReads.length,1);
 assert.equal(f.logs.localReads[0],f.files[0]);
 assert.equal(f.logs.remoteReads.length,0);
 assert.deepEqual(f.logs.statuses.at(-1),{msg:'ready',kind:'ok'});
 assert.equal(f.getState().scanPending,false);
 assert.equal(f.getState().scanBusy,false);
 assert.equal(f.getState().scanResults.length,0,'do not forge a scanner result');
});

test('RC1981: invalid D365 XLSX stays local, fails without cloud fallback',async()=>{
 const f=harness({parsed:false});
 assert.equal(await f.runScan(),false);
 assert.equal(f.logs.localReads.length,1);
 assert.equal(f.logs.remoteReads.length,0);
 assert.deepEqual(f.logs.statuses.at(-1),{msg:'invalid',kind:'bad'});
 assert.equal(f.getState().scanBusy,false);
});

test('RC1981: missing local worker fails closed, never uploads XLSX instead',async()=>{
 const f=harness({localAvailable:false});
 assert.equal(await f.runScan(),false);
 assert.equal(f.logs.remoteReads.length,0);
 assert.deepEqual(f.logs.statuses.at(-1),{msg:'unavailable',kind:'bad'});
});

test('RC1981: mixed invoice files with an XLSX require explicit single-file selection',async()=>{
 const f=harness({files:[{name:'D365-export.xlsx',size:1024},
  {name:'invoice.pdf',size:2048}]});
 assert.equal(await f.runScan(),false);
 assert.equal(f.logs.remoteReads.length,0);
 assert.equal(f.logs.localReads.length,0);
 assert.deepEqual(f.logs.statuses.at(-1),{msg:'single',kind:'bad'});
});

test('RC1981: PDF/other types and delivery-note handling retain existing secure route',async()=>{
 for(const options of [
  {mode:'invoice',files:[{name:'invoice.pdf',size:2048}]},
  {mode:'delivery',files:[{name:'D365-export.xlsx',size:2048}]}
 ]){
  const f=harness(options);
  assert.equal(await f.runScan(),true);
  assert.equal(f.logs.localReads.length,0);
  assert.equal(f.logs.remoteReads.length,1);
  assert.equal(f.logs.remoteReads[0],f.files[0]);
  assert.equal(f.getState().scanResults.length,1);
 }
});

test('RC1981: the local importer accepts the selected File but keeps ZIP/worker limits',()=>{
 assert.match(local,/async function read\(selectedFile\)/);
 assert.match(local,/file=selectedFile\|\|\(field&&field\.files&&field\.files\[0\]\)/);
 assert.match(local,/readSelectedFile:read/);
 assert.match(local,/file\.size>12\*1024\*1024/);
 assert.match(local,/worker\.postMessage\(\{file:file\}\)/);
 assert.doesNotMatch(local,/fetch\s*\(|XMLHttpRequest|sendBeacon\s*\(/);
 assert.match(api,/scanResultFromTags/);
 assert.match(api,/if\(scan\.status!=='clean'\)/);
});

test('RC1981: local-only route is explained in six supported UI languages',()=>{
 for(const lng of ['de','en','pl','es','fr','it']){
  assert.match(workspace,new RegExp('\\\\b'+lng+':\\\\{hint:'));
 }
 assert.match(workspace,/localD365Text\('hint'\)/);
 assert.match(workspace,/lastMode==='invoice'/);
});
