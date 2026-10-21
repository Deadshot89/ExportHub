import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync('assets/rc1596-pod-folder-reconnect.js','utf8');

function mount(state='granted'){
 let pickerCalls=0,oldConnect=0,queries=0,requests=0,hasSaved=true;
 const handle={name:'Meine POD-Sicherung',async queryPermission(){queries++;return state},
  async requestPermission(){requests++;state='granted';return state}};
 const api={async getDirectory(){return hasSaved?handle:null},async connectFolder(){pickerCalls++;oldConnect++;return{newFolder:true}},
  async folderInfo(){return{connected:false,name:'Nicht verbunden',writable:false}},
  async mirror(){return true}};
 const w={ExportHUBPODVault:Object.freeze(api),document:{readyState:'complete'},addEventListener(){}};
 vm.runInNewContext(code,{window:w},{filename:'rc1596-pod-folder-reconnect.js'});
 return{w,handle,counts:()=>({pickerCalls,oldConnect,queries,requests}),setSaved:v=>{hasSaved=v}};
}

test('RC1596: persistent POD emergency directory is reused with no picker',async()=>{
 const h=mount();
 assert.equal(await h.w.ExportHUBPODVault.connectFolder(),h.handle);
 assert.equal(h.counts().pickerCalls,0);
 assert.equal((await h.w.ExportHUBPODVault.folderInfo()).writable,true);
 assert.equal(h.w.ExportHUBPODVault.__rc1596Reconnect,true);
});

test('RC1596: after browser restart permission may be prompted once using click, without changing folder',async()=>{
 const h=mount('prompt');
 assert.equal((await h.w.ExportHUBPODVault.folderInfo()).connected,true);
 assert.equal((await h.w.ExportHUBPODVault.folderInfo()).writable,false);
 assert.equal(await h.w.ExportHUBPODVault.connectFolder(),h.handle);
 assert.equal(h.counts().requests,1);
 assert.equal(h.counts().pickerCalls,0);
});

test('RC1596: only when saved handle is gone is folder picker required',async()=>{
 const h=mount('denied');h.setSaved(false);
 assert.deepEqual(JSON.parse(JSON.stringify(await h.w.ExportHUBPODVault.connectFolder())),{newFolder:true});
 assert.equal(h.counts().pickerCalls,1);
 assert.equal((await h.w.ExportHUBPODVault.folderInfo()).connected,false);
});

test('RC1596: existing folder cannot be silently written without permission',async()=>{
 const h=mount('denied');
 const info=await h.w.ExportHUBPODVault.folderInfo();
 assert.equal(info.connected,true);
 assert.equal(info.writable,false);
 assert.equal(info.reauthorize,true);
});

test('RC1596: all three main builds include reconnect code',()=>{
 const source=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 assert.match(source,/RC1596_POD_FOLDER_SCRIPT_TAG/);
 assert.match(source,/rc1596-pod-folder-reconnect\.js\?v=1596/);
 assert.match(source,/'assets\/rc1596-pod-folder-reconnect\.js'/);
});
