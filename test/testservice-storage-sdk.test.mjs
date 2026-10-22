import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {collectInventory} from '../scripts/testservice-storage-inventory.mjs';

const require=createRequire(new URL('../api/package.json',import.meta.url));
const {BlobServiceClient}=require('@azure/storage-blob');
const {createHttpHeaders}=require('@azure/core-rest-pipeline');
const {toHttpHeadersLike}=require('@azure/core-http-compat');

test('real Azure SDK requests history and follows continuation pages',{timeout:5000},async()=>{
  const requests=[];
  const service=new BlobServiceClient('https://inventory.invalid',undefined,{
    retryOptions:{maxTries:1},
    httpClient:{async sendRequest(request){
      const url=new URL(request.url);
      assert.equal(url.searchParams.get('prefix'),'testservice/');
      assert.deepEqual(url.searchParams.get('include').split(',').sort(),['deleted','snapshots','versions']);
      requests.push(url);
      const first=requests.length===1;
      if(!first) assert.equal(url.searchParams.get('marker'),'next-page');
      const blob=first
        ? '<Blob><Name>testservice/team-state.json</Name><Snapshot>2026-10-22T08:00:00Z</Snapshot><Properties><Content-Length>20</Content-Length><BlobType>BlockBlob</BlobType></Properties></Blob>'
        : '<Blob><Name>testservice/team-state.json</Name><VersionId>v1</VersionId><Properties><Content-Length>30</Content-Length><BlobType>BlockBlob</BlobType></Properties></Blob>';
      return {request,status:200,headers:toHttpHeadersLike(createHttpHeaders({'content-type':'application/xml'})),
        bodyAsText:'<?xml version="1.0" encoding="utf-8"?><EnumerationResults ServiceEndpoint="https://inventory.invalid/" ContainerName="exporthub-data"><Prefix>testservice/</Prefix><Blobs>'+blob+'</Blobs><NextMarker>'+(first?'next-page':'')+'</NextMarker></EnumerationResults>'};
    }}
  });
  const report=await collectInventory(service.getContainerClient('exporthub-data'));
  assert.equal(requests.length,2);
  assert.equal(report.records,2);
  assert.equal(report.logicalBytes,50);
  assert.equal(report.kinds.snapshot.logicalBytes,20);
  assert.equal(report.kinds.version.logicalBytes,30);
});

test('CLI refuses missing dedicated credentials without falling back to production configuration',()=>{
  const secret='DO-NOT-PRINT-PRODUCTION-CONNECTION';
  const result=spawnSync(process.execPath,['scripts/testservice-storage-inventory.mjs'],{
    cwd:new URL('../',import.meta.url),encoding:'utf8',
    env:{...process.env,EXPORTHUB_TEST_INVENTORY_CONNECTION_STRING:'',EXPORTHUB_STORAGE_CONNECTION_STRING:secret,AzureWebJobsStorage:secret}
  });
  assert.equal(result.status,1);
  assert.equal(result.stdout,'');
  assert.match(result.stderr,/inventory failed/);
  assert.ok(!result.stderr.includes(secret));
});

test('CLI does not expose invalid dedicated credentials through SDK error messages',()=>{
  const secret='SECRET-INVALID-CONNECTION';
  const result=spawnSync(process.execPath,['scripts/testservice-storage-inventory.mjs'],{
    cwd:new URL('../',import.meta.url),encoding:'utf8',
    env:{...process.env,EXPORTHUB_TEST_INVENTORY_CONNECTION_STRING:secret}
  });
  assert.equal(result.status,1);
  assert.equal(result.stdout,'');
  assert.ok(!result.stderr.includes(secret));
});
