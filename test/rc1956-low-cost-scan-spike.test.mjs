import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {MAX_BYTES,scanLocalQuarantine}=require('../tools/rc1956-clamav/scan-local.cjs');

async function fixture(t,bytes=Buffer.from('RC1956 SAFE SYNTHETIC TEST FILE')){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'exporthub-rc1956-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const filePath=path.join(root,'synthetic.xlsx');
 await fs.writeFile(filePath,bytes);
 return{rootDir:root,filePath};
}
const success=async()=>({exitCode:0,timedOut:false});
const infected=async()=>({exitCode:1,timedOut:false});

test('RC1956: clean candidate is never a production release permit',async t=>{
 const input=await fixture(t);
 const result=await scanLocalQuarantine({...input,runner:success});
 assert.equal(result.verdict,'candidate-clean');
 assert.equal(result.authorizedForRelease,false);
 assert.match(result.sha256,/^[a-f0-9]{64}$/);
 assert.ok(result.bytes>0);
 assert.doesNotMatch(JSON.stringify(result),/synthetic.xlsx|exporthub-rc1956-/);
});

test('RC1956: infected stays blocked even when content is readable',async t=>{
 const input=await fixture(t);
 const result=await scanLocalQuarantine({...input,runner:infected});
 assert.equal(result.verdict,'infected');
 assert.equal(result.authorizedForRelease,false);
});

test('RC1956: process errors, scanner startup failure and timeout fail closed',async t=>{
 const input=await fixture(t);
 for(const runner of [
  async()=>({exitCode:2}),
  async()=>({exitCode:127}),
  async()=>({exitCode:null}),
  async()=>({exitCode:0,timedOut:true}),
  async()=>{throw Error('SECRET_CONNECTION_STRING=must-not-log')}
 ]){
  const result=await scanLocalQuarantine({...input,runner});
  assert.equal(result.verdict,'unverified');
  assert.equal(result.authorizedForRelease,false);
  assert.doesNotMatch(JSON.stringify(result),/SECRET_CONNECTION_STRING/);
 }
});

test('RC1956: modified file after scan is never approved',async t=>{
 const input=await fixture(t);
 const runner=async()=>{await fs.appendFile(input.filePath,'malicious change');return{exitCode:0}};
 const result=await scanLocalQuarantine({...input,runner});
 assert.equal(result.verdict,'unverified');
 assert.equal(result.reason,'file-changed');
});

test('RC1956: out-of-scope path, symlink, and invalid configuration fail closed',async t=>{
 const input=await fixture(t);
 const external=await fs.mkdtemp(path.join(os.tmpdir(),'rc1956-outside-'));
 t.after(()=>fs.rm(external,{recursive:true,force:true}));
 const other=path.join(external,'foreign.xlsx');await fs.writeFile(other,'external');
 const symlink=path.join(input.rootDir,'symlink.xlsx');
 await fs.symlink(other,symlink);
 for(const filePath of [other,symlink]){
  const result=await scanLocalQuarantine({...input,filePath,runner:success});
  assert.equal(result.verdict,'unverified');
  assert.equal(result.authorizedForRelease,false);
 }
 const bad=await scanLocalQuarantine({...input,timeoutMs:0,runner:success});
 assert.equal(bad.reason,'invalid-configuration');
});

test('RC1956: empty or excessive files are blocked before scanner launch',async t=>{
 const input=await fixture(t);
 let calls=0;const runner=async()=>{calls++;return{exitCode:0}};
 await fs.writeFile(input.filePath,Buffer.alloc(0));
 assert.equal((await scanLocalQuarantine({...input,runner})).verdict,'unverified');
 await fs.writeFile(input.filePath,Buffer.alloc(MAX_BYTES+1));
 assert.equal((await scanLocalQuarantine({...input,runner})).verdict,'unverified');
 assert.equal(calls,0);
});

test('RC1956: prototype is not wired into production upload, analysis or Defender tags',async()=>{
 const api=await fs.readFile('api/abd-analysis/index.js','utf8');
 const helper=await fs.readFile('tools/rc1956-clamav/scan-local.cjs','utf8');
 assert.doesNotMatch(api,/rc1956-clamav|scanLocalQuarantine/);
 assert.doesNotMatch(helper,/setTags|uploadData|EXPORTHUB_STORAGE_CONNECTION_STRING|https\.request/);
 assert.match(api,/scanResultFromTags/);
 assert.match(api,/scan\.status!=='clean'/);
});
