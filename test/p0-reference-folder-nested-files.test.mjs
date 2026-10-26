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
function mock(items){
 const hits=[],context={
  GRAPH_BASE:'https://graph.microsoft.com/v1.0',DRIVE_USER:'service@example.invalid',
  folderPath:ref=>'003 Export/ExportHub/Sendungen/'+ref,
  encPath:path=>path.split('/').map(encodeURIComponent).join('/'),
  text:v=>String(v??'').trim(),
  apiI18n:{t:()=> 'Dokument'},
  error:(code,message,status,vars)=>Object.assign(new Error(message),{code,status,vars}),
  graphFetch:async url=>{
   hits.push(url);
   const key=url.includes('/drive/items/')?decodeURIComponent(url.split('/drive/items/')[1].split('/children')[0]):'root';
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
