import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
function emitted(){
  const begin=build.indexOf('`async function fetchDocBlob(d){');
  assert.ok(begin>=0,'RC1305 production viewer transform missing');
  const end=build.indexOf('\n`',begin+1);
  assert.ok(end>begin,'viewer template end missing');
  return vm.runInNewContext(build.slice(begin,end+2));
}
function harness(){
  const fetched=[],legacy=[],original={name:'DNC3019227808.pdf',blobName:'rc1059/testservice/aa/'+('a'.repeat(64)),storage:'blob'};
  const reader={
    isBlobDocument:f=>!!(f&&f.blobName),
    protectedApiUrl:url=>String(url||'').startsWith('/api/exporthub-document?')?url:'',
    fetchBlob:async f=>{fetched.push(f);return 'ORIGINAL-PDF'}
  };
  const scope={
    window:{ExportHUBDocumentBlob1059:reader},
    Blob:class Blob{},
    q:v=>String(v==null?'':v).trim(),
    low:v=>String(v||'').toLowerCase(),
    arr:v=>Array.isArray(v)?v:[],
    fetch:async(url,options)=>{legacy.push({url,options});throw new Error('Unauthorized legacy fetch')},
    referenceHeaders(){return{}},
    currentShipmentForDocs(){return{}},refOf(){return 'UKUNNE'},
    Date,encodeURIComponent,Uint8Array
  };
  vm.runInNewContext(emitted(),scope,{filename:'generated-document-viewer.js'});
  return{read:scope.fetchDocBlob,reader,original,fetched,legacy};
}

test('RC1752 saved pack notification PDF loads from the immutable Blob record',async()=>{
  const h=harness();
  assert.equal(await h.read({name:h.original.name,file:h.original}),'ORIGINAL-PDF');
  assert.equal(h.fetched.length,1);
  assert.equal(h.fetched[0],h.original);
  assert.equal(h.legacy.length,0);
});

test('RC1752 flattened saved pack document resolves its Blob without falling back to a login URL',async()=>{
  const h=harness();
  assert.equal(await h.read(h.original),'ORIGINAL-PDF');
  assert.equal(h.fetched.length,1);
  assert.equal(h.fetched[0],h.original);
  assert.equal(h.legacy.length,0);
});

test('RC1752 migrated Packmeldung URL is sent only to authenticated cookie-free document reader',async()=>{
  const h=harness();
  const url='/api/exporthub-document?blob=rc1059%2Ftestservice%2Faa%2F'+'a'.repeat(64)+'&environment=testservice';
  assert.equal(await h.read({name:'DNC3019227808.pdf',file:{name:'DNC3019227808.pdf',url}}),'ORIGINAL-PDF');
  assert.equal(h.fetched.length,1);
  assert.equal(h.fetched[0].url,url);
  assert.equal(h.legacy.length,0);
});

test('RC1752 preserves protected PDF URL when only the normalized viewer record holds it',async()=>{
  const h=harness();
  assert.equal(await h.read({name:'DNC3019227808.pdf',url:'/api/exporthub-document?blob=x'}),'ORIGINAL-PDF');
  assert.equal(h.fetched[0].url,'/api/exporthub-document?blob=x');
  assert.equal(h.legacy.length,0);
});

test('RC1752 build retains no-cookie Azure auth guard and never removes ExportHUB authorization',()=>{
  const source=fs.readFileSync('assets/rc1059-document-blob.js','utf8');
  assert.match(source,/credentials:'omit'/);
  assert.match(source,/Authorization:'Bearer '\+t/);
  assert.match(source,/redirect:'manual'/);
  assert.match(source,/DOCUMENT_API_LOGIN_REDIRECT/);
  assert.match(build,/helper\.protectedApiUrl/);
});
