import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

test('P2: Microsoft Graph must return the real uploaded file ID, name and size',async()=>{
 const fetchBefore=globalThis.fetch;
 const keys=['EXPORTHUB_GRAPH_TENANT_ID','EXPORTHUB_GRAPH_CLIENT_ID','EXPORTHUB_GRAPH_CLIENT_SECRET'];
 const before=keys.map(k=>process.env[k]);
 keys.forEach(k=>{process.env[k]='test'});
 const moduleFile=require.resolve('../api/shared/reference-folder-upload.js');
 delete require.cache[moduleFile];
 const store=require(moduleFile);
 const buffer=Buffer.alloc(2048,1),filename='01_Geladener_Container_ABC123.jpg';
 let putResponse={};
 globalThis.fetch=async(url,opts={})=>{
  if(String(url).includes('/oauth2/'))return {ok:true,status:200,json:async()=>({access_token:'test-token',expires_in:3600})};
  if(opts.method==='PUT')return {ok:true,status:201,json:async()=>putResponse};
  return {ok:true,status:200,json:async()=>({id:'folder',name:'ABC123'})};
 };
 try{
  for(const response of [
   {name:filename,size:2048},
   {id:'id',name:filename,size:1000},
   {id:'id',name:'other.jpg',size:2048}
  ]){
   putResponse=response;
   await assert.rejects(store.upload('ABC123',filename,buffer,'image/jpeg'),e=>e.code==='GRAPH_REFERENCE_FILE_UNVERIFIED');
  }
  putResponse={id:'real-drive-item',name:filename,size:2048};
  const result=await store.upload('ABC123',filename,buffer,'image/jpeg');
  assert.equal(result.id,'real-drive-item');
  assert.equal(result.size,2048);
  assert.match(result.folderPath,/ABC123$/);
 }finally{
  globalThis.fetch=fetchBefore;
  keys.forEach((k,i)=>{if(before[i]===undefined)delete process.env[k];else process.env[k]=before[i]});
  delete require.cache[moduleFile];
 }
});
