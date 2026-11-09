import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1940-documents-workspace.js','utf8');
const start=runtime.indexOf(' async function runScan(){');
const end=runtime.indexOf('\n function lang(){',start);
assert.ok(start>=0&&end>start,'RC1944: actual document scan function present');
const functionSource=runtime.slice(start,end);

function fixture(files,analyzeFile){
 const messages=[],calls=[],scanner={analyzeFile:async file=>{calls.push(file);return analyzeFile(file,calls.length)}};
 const context={w:{ExportHUBRC1294ABDAnalysis:scanner},files,record:(message,kind)=>messages.push({message,kind})};
 const factory=vm.runInNewContext(`
  var chosenFiles=files,scanResults=[],scanBusy=false,scanPending=false,pendingScanFiles=[];
  function uploadStatus(message,kind){record(message,kind)}
  function refreshUpload(){}
  function ut(key){return ({empty:'Choose a file',invalid:'Invalid file',limits:'Too many files',
   unavailable:'Scanner unavailable',checking:'Checking',ready:'Analysis complete',
   failed:'Analysis failed:',pending:'Security scan still pending. Check again without reuploading.',
   positions:'positions'})[key]||key}
  ${functionSource}
  ({runScan:runScan,snapshot:function(){return{
    pending:scanPending,pendingCount:pendingScanFiles.length,results:scanResults.slice(),busy:scanBusy
  }}})
 `,context);
 return {...factory,messages,calls};
}

function file(name){return{name,size:175,type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}}
function good(){return{analysis:{positions:[{itemNumber:'A1',quantity:'2'}]}}}
function stillPending(){const err=new Error('Defender pending');err.code='ABD_SCAN_PENDING';throw err}

test('RC1944: pending antivirus scan is informational, never labeled analysis failed',async()=>{
 const selected=file('3002_SalesOrderPicked (15).xlsx');
 const testPage=fixture([selected],(_file,n)=>n===1?stillPending():good());
 assert.equal(await testPage.runScan(),false);
 const first=testPage.snapshot();
 assert.equal(first.pending,true);
 assert.equal(first.pendingCount,1);
 assert.equal(first.results.length,0);
 assert.equal(testPage.messages.at(-1).kind,'info');
 assert.match(testPage.messages.at(-1).message,/Security scan still pending/);
 assert.doesNotMatch(testPage.messages.at(-1).message,/Analysis failed/);
 assert.equal(await testPage.runScan(),true);
 const second=testPage.snapshot();
 assert.equal(second.pending,false);
 assert.equal(second.pendingCount,0);
 assert.equal(second.results.length,1);
 assert.equal(testPage.calls.length,2);
 assert.strictEqual(testPage.calls[0],selected);
 assert.strictEqual(testPage.calls[1],selected,'resume retains same File object and upload identity');
});

test('RC1944: retry only the pending file, retain completed document preview',async()=>{
 const done=file('ready.xlsx'),pending=file('slow.xlsx');
 const testPage=fixture([done,pending],(f,n)=>f===done?good():n===2?stillPending():good());
 assert.equal(await testPage.runScan(),true);
 assert.equal(testPage.snapshot().results.length,1);
 assert.equal(testPage.snapshot().pendingCount,1);
 assert.equal(testPage.messages.at(-1).kind,'info');
 assert.doesNotMatch(testPage.messages.at(-1).message,/Analysis failed/);
 assert.equal(await testPage.runScan(),true);
 assert.equal(testPage.snapshot().results.length,2);
 assert.equal(testPage.calls.filter(f=>f===done).length,1,'completed file not rescanned or reuploaded');
 assert.equal(testPage.calls.filter(f=>f===pending).length,2);
});

test('RC1944: Defender delay is a warning, but is not misreported as a failed analysis',async()=>{
 const page=fixture([file('slow.xlsx')],()=>{
  const error=new Error('Defender result is delayed');
  error.code='ABD_SCAN_PENDING';
  error.scanDelayed=true;
  throw error
 });
 assert.equal(await page.runScan(),false);
 assert.equal(page.snapshot().pending,true);
 assert.equal(page.messages.at(-1).kind,'warn');
 assert.doesNotMatch(page.messages.at(-1).message,/Analysis failed/);
 assert.match(runtime,/delayed:'Microsoft Defender/);
});

test('RC1944: terminal scan failures still display an error',async()=>{
 const testPage=fixture([file('blocked.xlsx')],()=>{
  const error=new Error('Blocked by Defender');error.code='ABD_SCAN_FAILED';throw error
 });
 assert.equal(await testPage.runScan(),false);
 assert.equal(testPage.snapshot().pending,false);
 assert.equal(testPage.messages.at(-1).kind,'warn');
 assert.match(testPage.messages.at(-1).message,/Analysis failed:.*Blocked by Defender/);
});

test('RC1944: changing selected files resets pending state and results',()=>{
 assert.match(runtime,/chosenFiles=Array\.from\(e\.target\.files\|\|\[\]\);scanResults=\[\];scanPending=false;pendingScanFiles=\[\]/);
 for(const language of ['de','en','pl','es','fr','it'])assert.match(runtime,new RegExp('\\b'+language+':\\{title:'));
});
