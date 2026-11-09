import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDocumentUploadAssets,verifyDocumentUploadLive} from '../scripts/rc1943-documents-upload-live.mjs';

const html='<html><head><script defer src="/assets/rc1940-documents-workspace.js?v=1943"></script></head></html>';
const js='function ensureUpload(){ var a="data-rc1940-files"; var b="data-rc1940-analyze"; editor.importAnalysis(result.analysis); }';
const sha='a'.repeat(40);
const fakeFetch=async (url)=>({status:200,text:async()=>url.includes('/assets/')?js:html});

test('RC1943 live guard: deployed root and actual uploaded JavaScript are both required',()=>{
 assert.doesNotThrow(()=>assertDocumentUploadAssets(html,js,'testservice'));
 assert.throws(()=>assertDocumentUploadAssets('<html></html>',js,'testservice'),/workspace script/);
 assert.throws(()=>assertDocumentUploadAssets(html,'<!doctype html><html/>','testservice'),/deployed document-upload asset misses/);
 assert.throws(()=>assertDocumentUploadAssets(html,js.replace('data-rc1940-files','missing'),'testservice'),/data-rc1940-files/);
});

test('RC1943 live guard: checks both approved deployment hosts with exact SHA',async()=>{
 for(const env of ['testservice','production']){
  const result=await verifyDocumentUploadLive(env,sha,{fetchImpl:fakeFetch,attempts:1});
  assert.equal(result.verified,true);
  assert.equal(result.sha,sha);
 }
 await assert.rejects(verifyDocumentUploadLive('unknown',sha,{fetchImpl:fakeFetch}),/environment/);
 await assert.rejects(verifyDocumentUploadLive('testservice','no-sha',{fetchImpl:fakeFetch}),/release SHA/);
});
