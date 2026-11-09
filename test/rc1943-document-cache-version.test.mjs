import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {integrateAbdProforma} from '../.github/rc1549/integrate-abd-proforma.mjs';

test('RC1943: all three build entrypoints use the new upload JavaScript URL',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rc1943-build-'));
 try{
  for(const entry of ['index.html','TESTVERSION.html','demo.html'])fs.writeFileSync(path.join(temp,entry),'<html><head></head><body></body></html>');
  integrateAbdProforma(process.cwd(),temp);
  for(const entry of ['index.html','TESTVERSION.html','demo.html']){
   const html=fs.readFileSync(path.join(temp,entry),'utf8');
   assert.ok(html.includes('assets/rc1940-documents-workspace.js?v=1943'),entry+': fresh URL missing');
   assert.ok(!html.includes('assets/rc1940-documents-workspace.js?v=1940'),entry+': obsolete JS cache key');
   assert.equal((html.match(/id="exporthub-rc1940-documents"/g)||[]).length,1,entry+': upload runtime must only occur once');
  }
  assert.ok(fs.readFileSync(path.join(temp,'assets/rc1940-documents-workspace.js'),'utf8').includes('data-rc1940-files'));
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});

test('RC1943: already-injected old document script is normalized rather than duplicated',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rc1943-cache-'));
 try{
  const old='<script id="exporthub-rc1940-documents" defer src="/assets/rc1940-documents-workspace.js?v=1940"></script>';
  for(const entry of ['index.html','TESTVERSION.html','demo.html'])fs.writeFileSync(path.join(temp,entry),'<html><head>'+old+'</head><body></body></html>');
  integrateAbdProforma(process.cwd(),temp);
  for(const entry of ['index.html','TESTVERSION.html','demo.html']){
   const html=fs.readFileSync(path.join(temp,entry),'utf8');
   assert.equal((html.match(/id="exporthub-rc1940-documents"/g)||[]).length,1);
   assert.ok(html.includes('assets/rc1940-documents-workspace.js?v=1943'));
   assert.ok(!html.includes('assets/rc1940-documents-workspace.js?v=1940'));
  }
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
