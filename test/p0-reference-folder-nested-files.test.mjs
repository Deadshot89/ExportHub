import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

const source=fs.readFileSync('api/reference-files/index.js','utf8');
function loadFunction(){
 const start=source.indexOf('async function listFiles(ref,req){');
 const end=source.indexOf('\nfunction disposition(',start);
 assert.ok(start>=0&&end>start,'Reference folder listFiles must exist');
 return source.slice(start,end);
}
function mock(items,exactTarget=null){
 const hits=[],context={
  GRAPH_BASE:'https://graph.microsoft.com/v1.0',DRIVE_USER:'service@example.invalid',
  publicAccess:{environment:()=> 'production'},
  referenceFolder:{exactTarget:()=>exactTarget,getFolder:async()=>exactTarget?{id:'refchild',webUrl:'https://example.invalid/refchild'}:null},
  folderPath:ref=>'003 Export/ExportHub/Sendungen/'+ref,
  encPath:path=>path.split('/').map(encodeURIComponent).join('/'),
  text:v=>String(v??'').trim(),
  apiI18n:{t:()=> 'Dokument'},
  error:(code,message,status,vars)=>Object.assign(new Error(message),{code,status,vars}),
  graphFetch:async url=>{
   hits.push(url);
   const key=url.includes('/drives/')?decodeURIComponent(url.split('/items/')[1].split('/children')[0]):url.includes('/drive/items/')?decodeURIComponent(url.split('/drive/items/')[1].split('/children')[0]):'root';
   const item=items[key];
   if(!item)return{status:404,ok:false,json:async()=>({})};
   return{status:item.status||200,ok:!item.status||item.status<400,json:async()=>item.body||{value:item.value||[]}};
  },
  encodeURIComponent,Set
 };
 vm.runInNewContext(loadFunction(),context,{filename:'p0-graph-reference-list.js'});
 return{list:()=>context.listFiles('9WX5K6',{}),hits};
}

test('P0: reference file listing finds documents nested below a reference folder',async()=>{
 const fake=mock({
  root:{value:[{id:'sub',name:'Lieferscheine',folder:{}},{id:'rootfile',name:'ABD.pdf',size:10,file:{mimeType:'application/pdf'}}]},
  sub:{value:[{id:'inside',name:'SIDE250071804.pdf',size:42,file:{mimeType:'application/pdf'}}]}
 });
 const result=await fake.list();
 assert.equal(result.folderMissing,false);
 assert.deepEqual(Array.from(result.files,f=>f.name).sort(),['ABD.pdf','SIDE250071804.pdf']);
 assert.equal(fake.hits.length,2);
});

test('P0: duplicate drive IDs are not rendered twice',async()=>{
 const fake=mock({root:{value:[{id:'same',name:'file.pdf',file:{}},{id:'same',name:'file.pdf',file:{}}]}});
 const result=await fake.list();
 assert.equal(result.files.length,1);
});

test('P0: a genuinely missing reference folder is not reported as merely empty',async()=>{
 const fake=mock({});
 const result=await fake.list();
 assert.equal(result.folderMissing,true);
 assert.equal(result.files.length,0);
});

test('P0: Graph 403 is not masked as an empty reference folder',async()=>{
 const fake=mock({root:{status:403,body:{error:{message:'Access denied'}}}});
 await assert.rejects(fake.list(),e=>e.code==='GRAPH_LIST_FAILED'&&e.status===403);
});

test('P0: the reference file API and emitted frontend build parse',()=>{
 for(const path of ['api/reference-files/index.js','.github/rc1112/build-three-env.mjs']){
  const check=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(check.status,0,check.stderr||check.stdout);
 }
});

test('P0: deleted nested folders must report an incomplete REF file listing',async()=>{
 const h=mock({root:{value:[{id:'removed',name:'Old',folder:{}}]}});
 await assert.rejects(h.list(),e=>e.code==='GRAPH_REFERENCE_FOLDER_LIST_INCOMPLETE'&&e.status===503);
});

test('P0: deeper unscanned folders result in an explicit limit error instead of a false zero',async()=>{
 const data={root:{value:[{id:'a',folder:{}}]}};
 for(const [key,next] of [['a','b'],['b','c'],['c','d'],['d','e']])data[key]={value:[{id:next,folder:{}}]};
 const h=mock(data);
 await assert.rejects(h.list(),e=>e.code==='GRAPH_REFERENCE_DEPTH_LIMIT'&&e.status===503);
});

test('P0 AV: die SharePoint-ID wird für REF-Dateiliste und Unterordner verwendet, nicht der ungültige User',async()=>{
 const fake=mock({
  refchild:{value:[{id:'subfolder',name:'Zoll',folder:{}},{id:'av',name:'AV_ABC123.pdf',size:42,file:{mimeType:'application/pdf'}}]},
  subfolder:{value:[{id:'other',name:'ABD.pdf',size:30,file:{mimeType:'application/pdf'}}]}
 },{driveId:'verified-drive',folderId:'verified-root'});
 const data=await fake.list();
 assert.equal(data.folderMissing,false);
 assert.deepEqual(Array.from(data.files,x=>x.name).sort(),['ABD.pdf','AV_ABC123.pdf']);
 assert.ok(fake.hits.some(url=>url.includes('/drives/verified-drive/items/refchild/children')));
 assert.ok(fake.hits.some(url=>url.includes('/drives/verified-drive/items/subfolder/children')));
 assert.ok(fake.hits.every(url=>!url.includes('/users/')),'kein User-Drive-Lookup bei verifiziertem SharePoint-Ziel');
});

test('P0 AV: User not found ist ein Konfigurationsfehler, kein fehlender REF-Ordner',async()=>{
 const fake=mock({root:{status:404,body:{error:{message:'User not found'}}}});
 await assert.rejects(fake.list(),e=>e.code==='GRAPH_REFERENCE_USER_NOT_FOUND'&&e.status===503);
});

test('P0 AV: verschwindet ein zuvor bestätigter SharePoint-REF-Ordner, wird kein falscher leerer Ordner gemeldet',async()=>{
 const fake=mock({}, {driveId:'verified-drive',folderId:'verified-root'});
 await assert.rejects(fake.list(),e=>e.code==='GRAPH_REFERENCE_FOLDER_LIST_INCOMPLETE');
});
