import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import fs from 'node:fs';

const require=createRequire(import.meta.url);
const https=require('https');
const modulePath=require.resolve('../api/shared/graph-drive.js');

function setEnv(){
  process.env.EXPORTHUB_GRAPH_TENANT_ID='tenant-test';
  process.env.EXPORTHUB_GRAPH_CLIENT_ID='client-test';
  process.env.EXPORTHUB_GRAPH_CLIENT_SECRET='secret-test';
  process.env.EXPORTHUB_POD_DRIVE_USER='tobiaslimberg@essentra.com';
  process.env.EXPORTHUB_POD_FOLDER='003 Export/ExportHub/Abliefernachweise';
  delete process.env.EXPORTHUB_POD_DRIVE_ID;
  delete process.env.EXPORTHUB_POD_FOLDER_ID;
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

test('RC1402: Personal-Site AccessDenied fällt auf echten Benutzer-Default-Drive zurück',async()=>{
  setEnv();
  const graph=fresh();
  await withFakeHttps((call,index)=>{
    if(index===1)return{status:200,body:{access_token:'token-test',expires_in:3600}};
    if(index===2){
      assert.match(call.path,/\/v1\.0\/users\/tobiaslimberg%40essentra\.com\/drives\?/);
      return{status:404,body:{error:{code:'Request_ResourceNotFound',message:'Drives collection unavailable'}}};
    }
    if(index===3||index===4){
      assert.match(call.path,/\/v1\.0\/users\/tobiaslimberg%40essentra\.com\/drive\/root:\//);
      return{status:404,body:{error:{code:'itemNotFound',message:'Exact folder path not found'}}};
    }
    if(index===5){
      assert.match(call.path,/^\/v1\.0\/sites\/essentra-my\.sharepoint\.com:\/personal\/tobiaslimberg_essentra_com\?/);
      return{status:403,body:{error:{code:'accessDenied',message:'Sites permission unavailable'}}};
    }
    if(index===6){
      assert.equal(call.path,'/v1.0/users/tobiaslimberg%40essentra.com/drive?$select=id,webUrl');
      return{status:200,body:{id:'drive-default',webUrl:'https://tenant-my.sharepoint.com/personal/user/Documents'}};
    }
    if(index===7){
      assert.match(call.path,/\/v1\.0\/drives\/drive-default\/root\/search\(q='Abliefernachweise'\)/);
      return{status:200,body:{value:[{
        id:'folder-target',
        name:'Abliefernachweise',
        folder:{},
        parentReference:{driveId:'drive-default',path:'/drive/root:/003 Export/ExportHub'}
      }]}};
    }
    if(index===8){
      assert.equal(call.method,'PUT');
      assert.equal(call.path,'/v1.0/drives/drive-default/items/folder-target:/POD_TEST.pdf:/content');
      return{status:201,body:{id:'file-ok',name:'POD_TEST.pdf',size:9}};
    }
    throw new Error('Unerwarteter Graph-Aufruf '+index+' '+call.method+' '+call.path);
  },async calls=>{
    const result=await graph.uploadPdf(Buffer.from('%PDF-test'),'POD_TEST.pdf');
    assert.equal(result.id,'file-ok');
    assert.equal(result.folder,'003 Export/ExportHub/Abliefernachweise');
    assert.equal(calls.some(call=>/\/v1\.0\/shares\//.test(call.path)),false);
  });
});

test('RC1402: POD-Backup persistiert nur nicht-sensitiven Graph-Unterfehlercode',()=>{
  const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');
  assert.match(archive,/const graphCode = text\(error && \(error\.graphCode \|\| error\.code\)\)/);
  assert.match(archive,/driveGraphCode: graphCode/);
  assert.match(archive,/driveLastError: safeDriveError/);
  assert.doesNotMatch(archive,/clientSecret/);
  assert.doesNotMatch(archive,/access_token/);
});
