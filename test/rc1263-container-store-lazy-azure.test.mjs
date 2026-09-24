import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import path from 'node:path';

const require=createRequire(import.meta.url);
const target=path.resolve('api/shared/container-document-store.js');

test('RC1263: Container-Dokument-Store kann ohne Azure-Paket geladen werden solange kein Blobzugriff erfolgt',()=>{
  const original=Module._load;
  Module._load=function(request,parent,isMain){
    if(request==='@azure/storage-blob'){
      const e=new Error("Cannot find module '@azure/storage-blob'");
      e.code='MODULE_NOT_FOUND';
      throw e;
    }
    if(request==='./reference-folder-upload') return {upload:async()=>({})};
    return original.call(this,request,parent,isMain);
  };
  delete require.cache[require.resolve(target)];
  try{
    const store=require(target);
    assert.equal(store.completePhotos([
      {kind:'loaded'},
      {kind:'number'},
      {kind:'sealed'}
    ]),true);
    assert.equal(store.fileName('ABC123','loaded','jpg'),'01_Geladener_Container_ABC123.jpg');
  }finally{
    Module._load=original;
    delete require.cache[require.resolve(target)];
  }
});
