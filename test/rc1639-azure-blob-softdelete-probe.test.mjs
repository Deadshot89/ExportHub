import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const {createBlobServiceClient,parseBlobDeleteRetentionPolicy}=require('../api/shared/blob-rest.js');
const ok=(enabled,days='')=>'<?xml version="1.0"?>'+
 '<StorageServiceProperties>'+
 '<Logging><RetentionPolicy><Enabled>true</Enabled><Days>999</Days></RetentionPolicy></Logging>'+
 '<DeleteRetentionPolicy><Enabled>'+enabled+'</Enabled>'+
 (days===''?'':'<Days>'+days+'</Days>')+'</DeleteRetentionPolicy></StorageServiceProperties>';

test('RC1639: account DeleteRetentionPolicy parsed only from correct XML node, never logging retention',()=>{
 assert.deepEqual(parseBlobDeleteRetentionPolicy(ok('true',35)),{status:'verified',enabled:true,days:35});
 assert.deepEqual(parseBlobDeleteRetentionPolicy(ok('false',35)),{status:'verified',enabled:false,days:null});
 assert.deepEqual(parseBlobDeleteRetentionPolicy(ok('false')),{status:'verified',enabled:false,days:null});
 const u={status:'unverified',enabled:null,days:null};
 for(const xml of ['', '<StorageServiceProperties><Logging><RetentionPolicy><Enabled>true</Enabled></RetentionPolicy></Logging></StorageServiceProperties>',
  '<DeleteRetentionPolicy><Enabled>true</Enabled><Days>35</Days></DeleteRetentionPolicy>',
  ok('true'),ok('abc',30),ok('true',0),ok('true',366),ok('true',-1),ok('true','7.5'),
  '<StorageServiceProperties><DeleteRetentionPolicy><Enabled>true</Enabled><Days>7</Days></DeleteRetentionPolicy>']){
  assert.deepEqual(parseBlobDeleteRetentionPolicy(xml),u);
 }
});

test('RC1639: service sends only read-only GET comp=properties, output contains no account, URL, keys, raw XML',async()=>{
 const stored=global.fetch,requested=[];
 const conn='DefaultEndpointsProtocol=https;AccountName=fictionalaccount;AccountKey='+Buffer.alloc(64,1).toString('base64')+';EndpointSuffix=core.windows.net';
 global.fetch=async(input,options)=>{
  requested.push({url:String(input),method:options.method,body:options.body});
  return{ok:true,status:200,text:async()=>ok('true',30),headers:new Headers()};
 };
 try{
  const client=createBlobServiceClient(conn);
  const result=await client.getDeleteRetentionPolicy();
  assert.deepEqual(result,{status:'verified',enabled:true,days:30});
  assert.equal(requested.length,1);
  assert.equal(requested[0].method,'GET');
  assert.equal(requested[0].body,null);
  assert.equal(new URL(requested[0].url).pathname,'/');
  assert.equal(new URL(requested[0].url).searchParams.get('restype'),'service');
  assert.equal(new URL(requested[0].url).searchParams.get('comp'),'properties');
  assert.doesNotMatch(JSON.stringify(result),/fictionalaccount|core.windows|AccountKey|<DeleteRetentionPolicy/);
 }finally{global.fetch=stored}
});

test('RC1639: signed OIDC only, after TESTSERVICE host guard, no PUT or policy write',()=>{
 const fixture=fs.readFileSync('api/e2e-test-fixture/index.js','utf8');
 const auth=fixture.indexOf('if(!await githubOidcAuthorized(req))');
 const handler=fixture.indexOf("if(action==='inventory-blob-policy')");
 assert.ok(auth>0&&handler>auth);
 const chunk=fixture.slice(handler,fixture.indexOf("if(action==='inventory-scopes')",handler));
 assert.match(chunk,/getDeleteRetentionPolicy\(\)/);
 assert.match(chunk,/sharedOwnershipVerified:false/);
 assert.match(chunk,/changeApproved:false/);
 assert.match(chunk,/status:'unverified',enabled:null,days:null/);
 assert.doesNotMatch(chunk,/\.upload\(|\.delete\(|\.setProperties\(|\.createIfNotExists\(/);
 const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
 assert.match(workflow,/inventory-team\|inventory-scopes\|inventory-blob-policy\)/);
 assert.match(workflow,/fixture inventory-blob-policy/);
 assert.match(workflow,/RC1639 Azure-Blob-SoftDelete-Richtlinie/);
 assert.match(workflow,/v\.scope!=="storage-account"/);
 assert.match(workflow,/changeApproved:false/);
 assert.doesNotMatch(workflow,/deleteRetentionPolicy\s*:\s*true/);
});
