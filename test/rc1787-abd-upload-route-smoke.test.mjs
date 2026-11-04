import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
import {verifyUploadAsset,verifyUnauthenticatedApi,verifyLiveUploadRoute} from '../scripts/rc1787-abd-upload-route-smoke.mjs';
const SHA='a'.repeat(40);
const ASSET="function authToken(){} exporthub_rc301_tab_session data-rc1294-files ABD_UPLOAD_ROUTE_UNAVAILABLE";
const NO_SESSION=JSON.stringify({ok:false,code:'AUTH_REQUIRED',message:'Anmeldung erforderlich.'});

test('RC1787: deployed invoice upload UI contains the canonical session and file input',()=>{
 assert.equal(verifyUploadAsset(200,ASSET),true);
 assert.throws(()=>verifyUploadAsset(404,ASSET),/not served/);
 assert.throws(()=>verifyUploadAsset(200,ASSET.replace('data-rc1294-files','')),/outdated/);
});

test('RC1787: live upload route rejects unauthenticated POST with JSON/401, not login HTML',()=>{
 assert.equal(verifyUnauthenticatedApi(401,'application/json; charset=utf-8',NO_SESSION),true);
 assert.throws(()=>verifyUnauthenticatedApi(200,'application/json',NO_SESSION),/HTTP 200/);
 assert.throws(()=>verifyUnauthenticatedApi(404,'text/html','<html>Not found</html>'),/HTTP 404/);
 assert.throws(()=>verifyUnauthenticatedApi(302,'text/html',''),/HTTP 302/);
 assert.throws(()=>verifyUnauthenticatedApi(401,'text/html',NO_SESSION),/did not return JSON/);
 const mismatch=JSON.stringify({ok:false,code:'SESSION_INVALID',message:'DO_NOT_LOG_USER_DATA'});
 assert.throws(()=>verifyUnauthenticatedApi(401,'application/json',mismatch),error=>
  error.message.includes('received code=SESSION_INVALID')&&!error.message.includes('DO_NOT_LOG_USER_DATA'));
 assert.throws(()=>verifyUnauthenticatedApi(401,'application/json',JSON.stringify({ok:true,code:'AUTH_REQUIRED'})),/received code=AUTH_REQUIRED/);
 assert.throws(()=>verifyUnauthenticatedApi(401,'application/json',JSON.stringify({ok:false,code:'secret-diagnostic'})),/received code=UNKNOWN/);
});

test('RC1787: integration checks asset and API route without credentials or real files',async()=>{
 const calls=[];
 const mock=async(url,init)=>{
  calls.push({url,method:init.method,headers:init.headers,body:init.body});
  if(init.method==='GET')return{status:200,text:async()=>ASSET};
  return{status:401,headers:{get:()=> 'application/json'},text:async()=>NO_SESSION};
 };
 const r=await verifyLiveUploadRoute('testservice',SHA,mock);
 assert.deepEqual(r,{environment:'testservice',uploadUi:'verified',apiRoute:'verified',authGuard:'AUTH_REQUIRED'});
 assert.equal(calls.length,2);
 assert.equal(calls[0].method,'GET');
 assert.equal(calls[1].method,'POST');
 assert.deepEqual(JSON.parse(calls[1].body),{action:'status',uploadId:'rc1787-nonexistent'});
 assert.ok(!Object.keys(calls[1].headers).some(k=>/authorization|token|cookie/i.test(k)),'No credentials may be sent');
 assert.ok(!calls[1].body.includes('base64'),'Never send uploaded files');
});

test('RC1787: environment/commit validation fails closed',async()=>{
 await assert.rejects(verifyLiveUploadRoute('unknown',SHA,async()=>{}),/unsupported/);
 await assert.rejects(verifyLiveUploadRoute('production','bad',async()=>{}),/invalid/);
});

test('RC1787: real ABD auth guard rejects anonymous requests before accessing storage',async()=>{
 const auth=require('../api/shared/fast-auth-store.js');
 for(const host of ['ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net','wonderful-forest-0f315e310.7.azurestaticapps.net']){
  const req={method:'POST',headers:{host,'content-type':'application/json'},body:{action:'status',uploadId:'rc1787-nonexistent'}};
  await assert.rejects(auth.validateSession(req),error=>error?.code==='AUTH_REQUIRED'&&error?.status===401,host);
 }
});

test('RC1787: Azure-injected Authorization cannot be mistaken for ExportHUB session',async()=>{
 const auth=require('../api/shared/fast-auth-store.js');
 const fs=await import('node:fs');
 const source=fs.readFileSync('api/abd-analysis/index.js','utf8');
 assert.match(source,/validateSession\(req,\{requireExportHubToken:true\}\)/);
 const host='ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';
 const azure={method:'POST',headers:{host,authorization:'Bearer Azure-platform-identity'},body:{action:'status',uploadId:'rc1787-nonexistent'}};
 assert.equal(auth.hasExportHubCredential(azure),false);
 await assert.rejects(auth.validateSession(azure,{requireExportHubToken:true}),
  error=>error?.code==='AUTH_REQUIRED'&&error?.status===401);
 assert.equal(auth.hasExportHubCredential({headers:{'x-exporthub-token':'ehs1.a.b'}}),true);
 assert.equal(auth.hasExportHubCredential({headers:{'X-ExportHUB-Session':'ehs1.a.b'}}),true);
 assert.equal(auth.hasExportHubCredential({headers:{cookie:'eh_session=ehs1.a.b'}}),true);
 assert.equal(auth.hasExportHubCredential({headers:{authorization:'Bearer ehs1.a.b'}}),true);
 assert.equal(auth.hasExportHubCredential({headers:{authorization:'Bearer not-an-exporthub-session'}}),false);
});
