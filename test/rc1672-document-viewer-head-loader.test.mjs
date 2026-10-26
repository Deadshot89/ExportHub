import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const viewer=fs.readFileSync('assets/rc1059-document-blob.js','utf8');
const token='exporthub-rc1672-document-blob-viewer';
const runtime='rc1059-document-blob.js?v=1672';

test('RC1672: release builder injects RC1059 into the outer application head, not the Stauplan popup',()=>{
  assert.match(build,/html=injectDeferredRuntimeInHead\(html,'<script id="exporthub-rc1672-document-blob-viewer" defer src="\/assets\/rc1059-document-blob\.js\?v=1672"><\/script>','exporthub-rc1672-document-blob-viewer'\)/);
  assert.match(build,/const outerHead=html\.slice\(0,html\.toLowerCase\(\)\.indexOf\('<\/head>'\)\)/);
  assert.match(build,/if\(!outerHead\.includes\('id="exporthub-rc1672-document-blob-viewer"'\)\)throw/);
  const start=build.indexOf('function injectDeferredRuntimeInHead(html,tag,id){');
  const end=build.indexOf('\nfunction injectImmediateRuntimeAfterHead(',start);
  assert.ok(start>=0&&end>start,'Existing head injection helper must remain intact');
  const inject=vm.runInNewContext(build.slice(start,end)+'\ninjectDeferredRuntimeInHead');
  const source='<html><head><title>ExportHUB</title></head><body><script>const popup=\"<script src=\\\"assets/rc1059-document-blob.js?v=RC1059\\\">popup<\\\\/script>\";</script></body></html>';
  const tag='<script id="'+token+'" defer src="/assets/'+runtime+'"></script>';
  const output=inject(source,tag,token);
  const head=output.slice(0,output.toLowerCase().indexOf('</head>'));
  assert.ok(head.includes(tag),'PDF viewer must execute in the main window');
  assert.equal(output.split('id="'+token+'"').length-1,1,'RC1059 head runtime must not be duplicated');
  assert.equal(inject(output,tag,token),output,'Builder should remain idempotent');
});

test('RC1672: loader API supports authenticated Blob reads and production/testservice separation',()=>{
  assert.match(viewer,/w\.ExportHUBDocumentBlob1059=/);
  assert.match(viewer,/fetchBytes:fetchBytes/);
  assert.match(viewer,/headers:headers/);
  assert.match(viewer,/X-ExportHUB-Environment/);
  assert.match(viewer,/function isBlobDocument\(/);
  assert.match(build,/fs\.cpSync\(currentApi,builtApi/);
  assert.match(build,/'assets\/rc1059-document-blob\.js', \/\/ RC1672/,'RC1059 must be included in locally tested release assets');
  assert.match(build,/fs\.cpSync\(SRC,OUT,\{recursive:true\}\)/);
});
