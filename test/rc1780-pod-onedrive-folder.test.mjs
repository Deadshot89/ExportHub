import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const code=fs.readFileSync('assets/rc1780-pod-onedrive-folder.js','utf8');
const PDF=size=>{const b=new Uint8Array(size);b.set([0x25,0x50,0x44,0x46,0x2d,0x31]);return b};

function fakeIndexedDb(){
 const data=new Map();
 return{open(){
  const req={};
  const db={objectStoreNames:{contains:()=>true},createObjectStore(){},close(){},
   transaction(){
    const tx={};
    tx.objectStore=()=>({
     get(k){const r={result:data.get(k)};setTimeout(()=>tx.oncomplete&&tx.oncomplete());return r},
     put(v,k){data.set(k,v);setTimeout(()=>tx.oncomplete&&tx.oncomplete());return{}},
     delete(k){data.delete(k);setTimeout(()=>tx.oncomplete&&tx.oncomplete());return{}}
    });
    return tx;
   }};
  req.result=db;setTimeout(()=>req.onsuccess&&req.onsuccess());return req;
 }};
}

function fakeDir(name,state='granted'){
 const files=new Map();let requests=0;
 const dir={name,files,
  async queryPermission(){return state},
  async requestPermission(){requests++;state='granted';return state},
  async getFileHandle(n,opts){
   if(!files.has(n)&&!(opts&&opts.create)){const e=new Error('not found');e.name='NotFoundError';throw e}
   if(!files.has(n))files.set(n,new Uint8Array(0));
   return{
    async getFile(){const b=files.get(n);return{size:b.length,slice:(a,z)=>({arrayBuffer:async()=>b.slice(a,z).buffer})}},
    async createWritable(){let buf=null;return{async write(x){buf=x},async close(){files.set(n,buf)},async abort(){}}}
   };
  },
  requests:()=>requests,setState:s=>{state=s}};
 return dir;
}

function mount({shipments=[],original,fetchImpl,picker}={}){
 let pickerCalls=0;
 const listeners={};
 const w={
  indexedDB:fakeIndexedDb(),
  setTimeout:(fn)=>0,clearTimeout(){},setInterval(){},
  addEventListener(n,fn){(listeners[n]=listeners[n]||[]).push(fn)},
  dispatchEvent(){},CustomEvent:function(n,d){this.type=n;this.detail=d&&d.detail},
  atob:s=>Buffer.from(s,'base64').toString('binary'),
  fetch:fetchImpl||(async()=>({ok:false,status:404})),
  showDirectoryPicker:async()=>{pickerCalls++;return picker},
  ExportHUBPODBackup:{filter:()=>shipments,original:original||(async sh=>({bytes:PDF(2000)}))}
 };
 vm.runInNewContext(code,{window:w,setTimeout,Buffer,Uint8Array,Date,Error,Promise,String,Number,Object,Array},{filename:'rc1780.js'});
 return{w,api:w.ExportHUBPODOneDrive,listeners,pickerCalls:()=>pickerCalls};
}

test('RC1780: connect stores folder and sync writes all signed PODs with verification',async()=>{
 const dir=fakeDir('Abliefernachweise');
 const h=mount({shipments:[{ref:'abc123'},{ref:'XYZ999'}],picker:dir});
 await h.api.connect();
 const r=await h.api.run();
 assert.equal(r.written,2);
 assert.deepEqual([...dir.files.keys()].sort(),['POD_ABC123_Ladeliste_mit_Unterschrift.pdf','POD_XYZ999_Ladeliste_mit_Unterschrift.pdf']);
 const s=await h.api.info();
 assert.equal(s.connected,true);assert.equal(s.writable,true);assert.equal(s.totalInFolder,2);
});

test('RC1780: existing files are never overwritten and a second run writes nothing',async()=>{
 const dir=fakeDir('Abliefernachweise');
 const keep=PDF(1500);dir.files.set('POD_ABC123_Ladeliste_mit_Unterschrift.pdf',keep);
 let originals=0;
 const h=mount({shipments:[{ref:'ABC123'}],picker:dir,original:async()=>{originals++;return{bytes:PDF(3000)}}});
 await h.api.connect();
 const r=await h.api.run();
 assert.equal(r.written,0);assert.equal(r.skipped,1);assert.equal(originals,0);
 assert.equal(dir.files.get('POD_ABC123_Ladeliste_mit_Unterschrift.pdf'),keep);
});

test('RC1780: manual uploaded POD is copied as POD_<REF>.pdf from its stored URL',async()=>{
 const dir=fakeDir('Abliefernachweise');
 const sh={ref:'M00001',podFiles:[{manualUpload:true,url:'/api/pod-file?id=1',uploadedAt:'2026-11-10'}]};
 const h=mount({shipments:[sh],picker:dir,fetchImpl:async u=>{assert.equal(u,'/api/pod-file?id=1');return{ok:true,arrayBuffer:async()=>PDF(4000).buffer}}});
 await h.api.connect();
 const r=await h.api.run();
 assert.equal(r.written,1);
 assert.ok(dir.files.has('POD_M00001.pdf'));
});

test('RC1780: invalid or missing POD bytes are reported, not written',async()=>{
 const dir=fakeDir('Abliefernachweise');
 const h=mount({shipments:[{ref:'BAD001'}],picker:dir,original:async()=>({bytes:new Uint8Array([1,2,3])})});
 await h.api.connect();
 const r=await h.api.run();
 assert.equal(r.written,0);assert.equal(r.failed.length,1);assert.match(r.failed[0],/BAD001/);
 assert.equal(dir.files.has('POD_BAD001_Ladeliste_mit_Unterschrift.pdf'),false);
});

test('RC1780: without granted permission nothing is written and no prompt is opened automatically',async()=>{
 const dir=fakeDir('Abliefernachweise');
 const h=mount({shipments:[{ref:'ABC123'}],picker:dir});
 await h.api.connect();
 dir.setState('prompt');
 const before=dir.requests();
 const r=await h.api.run();
 assert.equal(r.reason,'needs-permission');assert.equal(r.written,0);
 assert.equal(dir.requests(),before);
 assert.equal((await h.api.info()).writable,false);
 // A click on "Ordner wieder freigeben" reuses the saved folder, no new picker.
 await h.api.connect();
 assert.equal(h.pickerCalls(),1);
 assert.equal((await h.api.info()).writable,true);
});

test('RC1780: builder injects the asset into all builds',()=>{
 const source=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 assert.match(source,/RC1780_POD_ONEDRIVE_SCRIPT_TAG/);
 assert.match(source,/rc1780-pod-onedrive-folder\.js\?v=1780/);
 assert.match(source,/'assets\/rc1780-pod-onedrive-folder\.js'/);
});

function workflowDoneBlock(section){
 const start=section.indexOf('if [ "$verdict" = "done" ]; then');
 const end=section.indexOf('            fi\n            if [ -n "$continuation_token" ]',start);
 assert.ok(start>0&&end>start);
 return section.slice(start,end)+'            fi\n';
}
test('RC1780: RC1144 only downgrades SharePoint pending when the owner variable is disabled',()=>{
 const wf=fs.readFileSync('.github/workflows/rc1144-pod-backup-reconcile.yml','utf8');
 assert.equal((wf.match(/POD_SHAREPOINT_SERVER_COPY: \$\{\{ vars\.EXPORTHUB_POD_SHAREPOINT_SERVER_COPY \|\| '' \}\}/g)||[]).length,2);
 const sections=[wf.slice(wf.indexOf('  testservice:'),wf.indexOf('  production:')),wf.slice(wf.indexOf('  production:'),wf.indexOf('  pod_integrity_audit:'))];
 for(const section of sections){
  const block=workflowDoneBlock(section);
  const run=(flag)=>{
   const script='set -u\nGITHUB_STEP_SUMMARY=/dev/null\nverdict=done\noptional_drive_pending_batches=3\nblocked_ambiguous_relink_batches=0\nPOD_SHAREPOINT_SERVER_COPY='+flag+'\n'+block.replace(/^ {12}/gm,'');
   try{execFileSync('bash',['-c',script],{stdio:'pipe'});return 0}catch(e){return e.status}
  };
  assert.equal(run("''"),10,'without owner variable a pending SharePoint copy keeps failing');
  assert.equal(run('enabled'),10);
  assert.equal(run('disabled'),0,'owner disabled the server copy: warning only');
 }
});
