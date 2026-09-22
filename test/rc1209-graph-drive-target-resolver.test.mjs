import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const https=require('https');
const modulePath=require.resolve('../api/shared/graph-drive.js');

function setEnv(folder='Documents/003 Export/ExportHub/Abliefernachweise'){
  process.env.EXPORTHUB_GRAPH_TENANT_ID='tenant-test';
  process.env.EXPORTHUB_GRAPH_CLIENT_ID='client-test';
  process.env.EXPORTHUB_GRAPH_CLIENT_SECRET='secret-test';
  process.env.EXPORTHUB_POD_DRIVE_USER='tobiaslimberg@essentra.com';
  process.env.EXPORTHUB_POD_FOLDER=folder;
}

function fresh(){
  delete require.cache[modulePath];
  return require(modulePath);
}

async function withFakeHttps(handler,fn){
  const original=https.request;
  const calls=[];
  https.request=(options,callback)=>{
    const req=new EventEmitter();
    const chunks=[];
    req.write=chunk=>chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
    req.destroy=error=>queueMicrotask(()=>req.emit('error',error));
    req.end=()=>{
      const call={
        method:String(options.method||'GET'),
        hostname:String(options.hostname||''),
        path:String(options.path||''),
        headers:options.headers||{},
        body:Buffer.concat(chunks)
      };
      calls.push(call);
      Promise.resolve().then(()=>handler(call,calls.length)).then(result=>{
        const res=new EventEmitter();
        res.statusCode=Number(result&&result.status||200);
        res.headers=result&&result.headers||{};
        callback(res);
        const body=result&&Object.prototype.hasOwnProperty.call(result,'body')?result.body:{};
        const raw=Buffer.isBuffer(body)?body:Buffer.from(typeof body==='string'?body:JSON.stringify(body));
        if(raw.length)res.emit('data',raw);
        res.emit('end');
      }).catch(error=>req.emit('error',error));
    };
    return req;
  };
  try{return await fn(calls)}
  finally{https.request=original}
}

function tokenResponse(){
  return{status:200,body:{access_token:'token-test',expires_in:3600}};
}

test('RC1209: Documents-Präfix aus SharePoint-/OneDrive-Pfad wird auf Drive-Root normalisiert',()=>{
  setEnv();
  const graph=fresh();
  assert.equal(graph.normalizeFolder('Documents/003 Export/ExportHub/Abliefernachweise'),'003 Export/ExportHub/Abliefernachweise');
  assert.equal(graph.normalizeFolder('/Documents/003 Export/ExportHub/Abliefernachweise/'),'003 Export/ExportHub/Abliefernachweise');
  assert.equal(graph.normalizeFolder('003 Export/ExportHub/Abliefernachweise'),'003 Export/ExportHub/Abliefernachweise');
});

test('RC1213: POD-Upload umgeht fehlendes Default-OneDrive und sucht den Zielordner in erreichbaren Drives',async()=>{
  setEnv();
  const graph=fresh();
  await withFakeHttps((call,index)=>{
    if(index===1){
      assert.equal(call.hostname,'login.microsoftonline.com');
      assert.equal(call.method,'POST');
      return tokenResponse();
    }
    if(index===2){
      assert.equal(call.method,'GET');
      assert.match(call.path,/\/v1\.0\/users\/tobiaslimberg%40essentra\.com\/drives\?\$select=id,driveType,name$/);
      assert.doesNotMatch(call.path,/\/drive\?/);
      return{status:200,body:{value:[{id:'drive-personal',name:'OneDrive'},{id:'drive-shared',name:'Documents'}]}};
    }
    if(index===3){
      assert.match(call.path,/\/v1\.0\/drives\/drive-personal\/root:\/003%20Export\/ExportHub\/Abliefernachweise\?\$select=/);
      return{status:404,body:{error:{code:'itemNotFound',message:'Folder not found'}}};
    }
    if(index===4){
      assert.match(call.path,/\/v1\.0\/drives\/drive-personal\/root:\/Documents\/003%20Export\/ExportHub\/Abliefernachweise\?\$select=/);
      return{status:404,body:{error:{code:'itemNotFound',message:'Folder not found'}}};
    }
    if(index===5){
      assert.match(call.path,/\/v1\.0\/drives\/drive-shared\/root:\/003%20Export\/ExportHub\/Abliefernachweise\?\$select=/);
      return{status:200,body:{id:'folder-456',name:'Abliefernachweise',folder:{},parentReference:{driveId:'drive-shared'}}};
    }
    if(index===6){
      assert.equal(call.method,'PUT');
      assert.equal(call.path,'/v1.0/drives/drive-shared/items/folder-456:/POD_TV9NKH.pdf:/content');
      assert.equal(call.body.toString('utf8'),'%PDF-test');
      return{status:201,body:{id:'file-789',name:'POD_TV9NKH.pdf',size:9,webUrl:'https://example.invalid/file'}};
    }
    throw new Error('Unerwarteter Graph-Aufruf '+index+' '+call.method+' '+call.path);
  },async calls=>{
    const result=await graph.uploadPdf(Buffer.from('%PDF-test'),'POD_TV9NKH.pdf');
    assert.equal(result.id,'file-789');
    assert.equal(result.folder,'003 Export/ExportHub/Abliefernachweise');
    assert.equal(result.attempts,1);
    assert.equal(calls.length,6);
    assert.equal(calls.some(call=>/\/users\/[^/]+\/drive\?/.test(call.path)),false);
  });
});

test('RC1213: Documents-Präfix wird als zweiter kompatibler Ordnerpfad geprüft',async()=>{
  setEnv();
  const graph=fresh();
  await withFakeHttps((call,index)=>{
    if(index===1)return tokenResponse();
    if(index===2)return{status:200,body:{value:[{id:'drive-123',name:'Shared documents'}]}};
    if(index===3){
      assert.match(call.path,/root:\/003%20Export\/ExportHub\/Abliefernachweise/);
      return{status:404,body:{error:{code:'ResourceNotFound',message:'Folder not found'}}};
    }
    if(index===4){
      assert.match(call.path,/root:\/Documents\/003%20Export\/ExportHub\/Abliefernachweise/);
      return{status:200,body:{id:'folder-456',folder:{}}};
    }
    if(index===5)return{status:201,body:{id:'file-789',name:'POD_TEST.pdf',size:9}};
    throw new Error('Unerwarteter Aufruf');
  },async()=>{
    const result=await graph.uploadPdf(Buffer.from('%PDF-test'),'POD_TEST.pdf');
    assert.equal(result.id,'file-789');
    assert.equal(result.folder,'Documents/003 Export/ExportHub/Abliefernachweise');
  });
});

test('RC1216: nicht auflösbarer Benutzer wird über die persönliche SharePoint-Site aufgelöst',async()=>{
  setEnv();
  const graph=fresh();
  await withFakeHttps((call,index)=>{
    if(index===1)return tokenResponse();
    if(index===2)return{status:404,body:{error:{code:'Request_ResourceNotFound',message:'User or drives not found'}}};
    if(index===3){
      assert.equal(call.method,'GET');
      assert.equal(call.path,'/v1.0/sites/essentra-my.sharepoint.com:/personal/tobiaslimberg_essentra_com?$select=id');
      return{status:200,body:{id:'essentra-my.sharepoint.com,site-guid,web-guid'}};
    }
    if(index===4){
      assert.match(call.path,/\/v1\.0\/sites\/essentra-my\.sharepoint\.com%2Csite-guid%2Cweb-guid\/drive\?\$select=id,driveType,name$/);
      return{status:200,body:{id:'drive-personal',name:'Documents'}};
    }
    if(index===5){
      assert.match(call.path,/\/v1\.0\/drives\/drive-personal\/root:\/003%20Export\/ExportHub\/Abliefernachweise\?\$select=/);
      return{status:200,body:{id:'folder-456',folder:{}}};
    }
    if(index===6)return{status:201,body:{id:'file-789',name:'POD_TV9NKH.pdf',size:9}};
    throw new Error('Unerwarteter Aufruf '+index+' '+call.method+' '+call.path);
  },async calls=>{
    const result=await graph.uploadPdf(Buffer.from('%PDF-test'),'POD_TV9NKH.pdf');
    assert.equal(result.id,'file-789');
    assert.equal(result.folder,'003 Export/ExportHub/Abliefernachweise');
    assert.equal(calls.length,6);
  });
});

test('RC1216: fehlender Benutzer und fehlende persönliche SharePoint-Site bleiben fail-closed',async()=>{
  setEnv();
  const graph=fresh();
  await withFakeHttps((call,index)=>{
    if(index===1)return tokenResponse();
    if(index===2)return{status:404,body:{error:{code:'Request_ResourceNotFound',message:'User or drives not found'}}};
    if(index===3){
      assert.equal(call.path,'/v1.0/sites/essentra-my.sharepoint.com:/personal/tobiaslimberg_essentra_com?$select=id');
      return{status:404,body:{error:{code:'ResourceNotFound',message:'Site not found'}}};
    }
    throw new Error('Unerwarteter Aufruf '+index);
  },async()=>{
    await assert.rejects(
      graph.uploadPdf(Buffer.from('%PDF-test'),'POD_TEST.pdf'),
      error=>error&&error.code==='GRAPH_DRIVE_NOT_FOUND'&&error.statusCode===404
    );
  });
});

test('RC1213: Zielordner muss genau in einem erreichbaren Drive gefunden werden',async()=>{
  setEnv();
  const graph=fresh();
  await withFakeHttps((call,index)=>{
    if(index===1)return tokenResponse();
    if(index===2)return{status:200,body:{value:[{id:'drive-a'},{id:'drive-b'}]}};
    if(index===3)return{status:200,body:{id:'folder-a',folder:{}}};
    if(index===4)return{status:200,body:{id:'folder-b',folder:{}}};
    throw new Error('Unerwarteter Aufruf');
  },async()=>{
    await assert.rejects(
      graph.uploadPdf(Buffer.from('%PDF-test'),'POD_TEST.pdf'),
      error=>error&&error.code==='GRAPH_TARGET_AMBIGUOUS'&&error.statusCode===409
    );
  });
});

test('RC1213: nicht auffindbarer Zielordner wird als GRAPH_FOLDER_NOT_FOUND klassifiziert',async()=>{
  setEnv();
  const graph=fresh();
  await withFakeHttps((call,index)=>{
    if(index===1)return tokenResponse();
    if(index===2)return{status:200,body:{value:[{id:'drive-123'}]}};
    if(index===3||index===4)return{status:404,body:{error:{code:'ResourceNotFound',message:'Folder not found'}}};
    throw new Error('Unerwarteter Aufruf');
  },async()=>{
    await assert.rejects(
      graph.uploadPdf(Buffer.from('%PDF-test'),'POD_TEST.pdf'),
      error=>error&&error.code==='GRAPH_FOLDER_NOT_FOUND'&&error.statusCode===404
    );
  });
});
