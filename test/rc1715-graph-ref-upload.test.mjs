import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

test('P2: Graph requires upload metadata AND independent REF-folder readback',async()=>{
 const fetchBefore=globalThis.fetch;
 const keys=['EXPORTHUB_GRAPH_TENANT_ID','EXPORTHUB_GRAPH_CLIENT_ID','EXPORTHUB_GRAPH_CLIENT_SECRET'];
 const before=keys.map(k=>process.env[k]);
 keys.forEach(k=>{process.env[k]='test'});
 const moduleFile=require.resolve('../api/shared/reference-folder-upload.js');
 delete require.cache[moduleFile];
 const store=require(moduleFile);
 const buffer=Buffer.alloc(2048,1),filename='01_Geladener_Container_ABC123.jpg';
 let putResponse={},readbackResponse={},readbackCount=0;
 globalThis.fetch=async(url,opts={})=>{
  if(String(url).includes('/oauth2/'))return {ok:true,status:200,json:async()=>({access_token:'test-token',expires_in:3600})};
  if(opts.method==='PUT')return {ok:true,status:201,json:async()=>putResponse};
  if(String(url).includes('/drive/items/')){
   readbackCount++;
   return{ok:true,status:200,json:async()=>readbackResponse};
  }
  return {ok:true,status:200,json:async()=>({id:'ref-folder-id',name:'ABC123'})};
 };
 const correct={id:'real-drive-item',name:filename,size:2048,parentReference:{id:'ref-folder-id'},file:{mimeType:'image/jpeg'}};
 try{
  for(const response of [
   {name:filename,size:2048},
   {id:'id',name:filename,size:1000},
   {id:'id',name:'other.jpg',size:2048}
  ]){
   putResponse=response;
   await assert.rejects(store.upload('ABC123',filename,buffer,'image/jpeg'),e=>e.code==='GRAPH_REFERENCE_FILE_UNVERIFIED');
  }
  putResponse={id:correct.id,name:filename,size:2048};
  readbackResponse=correct;
  const stored=await store.upload('ABC123',filename,buffer,'image/jpeg');
  assert.equal(stored.id,correct.id);
  assert.equal(stored.size,2048);
  assert.match(stored.folderPath,/ABC123$/);
  assert.equal(readbackCount,1,'A successful upload must reopen the item independently');

  for(const invalid of [
   {...correct,size:2047},
   {...correct,parentReference:{id:'wrong-ref-folder'}},
   {...correct,name:'other-file.jpg'},
   {...correct,file:undefined}
  ]){
   readbackResponse=invalid;
   await assert.rejects(store.upload('ABC123',filename,buffer,'image/jpeg'),
    e=>e.code==='GRAPH_REFERENCE_FILE_READBACK_FAILED');
  }
  // Graph may lag briefly after PUT. Retrying the same exact item is safe;
  // retries must not upload a second copy or accept a different parent.
  let temporary=true;
  readbackResponse=correct;
  globalThis.fetch=async(url,opts={})=>{
   if(String(url).includes('/oauth2/'))return {ok:true,status:200,json:async()=>({access_token:'test-token',expires_in:3600})};
   if(opts.method==='PUT')return {ok:true,status:201,json:async()=>putResponse};
   if(String(url).includes('/drive/items/')){
    if(temporary){temporary=false;return{ok:false,status:404,json:async()=>({})}}
    return{ok:true,status:200,json:async()=>correct};
   }
   return{ok:true,status:200,json:async()=>({id:'ref-folder-id',name:'ABC123'})};
  };
  const retried=await store.upload('ABC123',filename,buffer,'image/jpeg');
  assert.equal(retried.id,correct.id);
 }finally{
  globalThis.fetch=fetchBefore;
  keys.forEach((k,i)=>{if(before[i]===undefined)delete process.env[k];else process.env[k]=before[i]});
  delete require.cache[moduleFile];
 }
});
