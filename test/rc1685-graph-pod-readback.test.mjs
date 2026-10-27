import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const https = require('https');
const modulePath = require.resolve('../api/shared/graph-drive.js');
const original = Buffer.from('%PDF-1.7\noriginal signed loading list\n' + 'x'.repeat(2048));

function fresh() {
  process.env.EXPORTHUB_GRAPH_TENANT_ID = 'test-tenant';
  process.env.EXPORTHUB_GRAPH_CLIENT_ID = 'test-client';
  process.env.EXPORTHUB_GRAPH_CLIENT_SECRET = 'fake-not-production';
  process.env.EXPORTHUB_POD_DRIVE_USER = 'test@example.invalid';
  process.env.EXPORTHUB_POD_FOLDER = 'Documents/003 Export/ExportHub/Abliefernachweise';
  process.env.EXPORTHUB_POD_DRIVE_ID = 'drive-exact';
  process.env.EXPORTHUB_POD_FOLDER_ID = 'folder-exact';
  delete require.cache[modulePath];
  return require(modulePath);
}

async function fakeHttp(handler, fn) {
  const old = https.request, calls = [];
  https.request = (options, callback) => {
    const req = new EventEmitter();
    req.write = () => {};
    req.destroy = e => queueMicrotask(() => req.emit('error',e));
    req.end = () => queueMicrotask(async () => {
      const call = { method: options.method, host: options.hostname, path: options.path, headers: options.headers || {} };
      calls.push(call);
      try {
        const response = await handler(call, calls.length);
        const res = new EventEmitter();
        res.statusCode = response.status || 200;
        res.headers = response.headers || {};
        callback(res);
        const data = Buffer.isBuffer(response.body)
          ? response.body
          : Buffer.from(typeof response.body === 'string' ? response.body : JSON.stringify(response.body || {}));
        if(data.length) res.emit('data', data);
        res.emit('end');
      } catch(e) {req.emit('error',e);}
    });
    return req;
  };
  try { await fn(calls); }
  finally { https.request = old; }
}

function token() {return {body:{access_token:'test-token',expires_in:3600}};}
function receipt() {return {body:{id:'pdf-remote',name:'POD_TEST.pdf',size:original.length}};}
function expectedHash() {return crypto.createHash('sha256').update(original).digest('hex');}
const downloadUrl='https://tenant.sharepoint.com/secure-download/POD_TEST.pdf?access=short-lived';

test('RC1685: Graph 302 readback verifies original bytes and never forwards Bearer token to SharePoint',async()=>{
  const graph=fresh();
  await fakeHttp((call,n)=>{
    if(n===1)return token();
    if(n===2) {assert.equal(call.method,'PUT');return receipt();}
    if(n===3) {
      assert.equal(call.host,'graph.microsoft.com');
      assert.equal(call.path,'/v1.0/drives/drive-exact/items/pdf-remote/content');
      assert.equal(call.headers.Authorization,'Bearer test-token');
      return{status:302,headers:{location:downloadUrl},body:''};
    }
    if(n===4) {
      assert.equal(call.host,'tenant.sharepoint.com');
      assert.equal(call.headers.Authorization,undefined,'preauthenticated download must NOT receive Graph token');
      return{status:200,body:original};
    }
    throw Error('unexpected request '+n);
  },async calls=>{
    const item=await graph.uploadPdf(original,'POD_TEST.pdf');
    assert.equal(item.driveId,'drive-exact');
    const checked=await graph.verifyPdf(original,item);
    assert.equal(checked.verified,true);
    assert.equal(checked.hash,expectedHash());
    assert.equal(checked.size,original.length);
    assert.equal(calls.length,4);
  });
});

test('RC1685: mismatching Graph readback is rejected without repeating upload',async()=>{
  const graph=fresh();
  await fakeHttp((call,n)=>{
    if(n===1)return token();
    if(n===2)return receipt();
    if(n===3){ const tampered=Buffer.from(original); tampered[120]^=0x01; return{status:200,body:tampered}; }
    throw Error('unexpected request '+n);
  },async calls=>{
    const item=await graph.uploadPdf(original,'POD_TEST.pdf');
    await assert.rejects(graph.verifyPdf(original,item),e=>e.code==='GRAPH_POD_READBACK_HASH_MISMATCH');
    assert.equal(calls.filter(call=>call.method==='PUT').length,1);
  });
});

test('RC1685: untrusted or insecure download redirect fails closed without contacting redirect target',async()=>{
  for(const location of ['http://tenant.sharepoint.com/file', 'https://attacker.example.invalid/steal', 'https://sharepoint.com.evil.example/file']) {
    const graph=fresh();
    await fakeHttp((call,n)=>{
      if(n===1)return token();
      if(n===2)return{status:302,headers:{location},body:''};
      throw Error('untrusted redirect requested');
    },async calls=>{
      await assert.rejects(graph.verifyPdf(original,{id:'pdf-remote',driveId:'drive-exact'}),e=>e.code==='GRAPH_READBACK_REDIRECT_REJECTED');
      assert.equal(calls.length,2);
    });
  }
});

test('RC1685: direct-user-path legacy upload can be read back without guessing drive ID',async()=>{
  const graph=fresh();
  await fakeHttp((call,n)=>{
    if(n===1)return token();
    if(n===2){
      assert.equal(call.path,'/v1.0/users/test%40example.invalid/drive/items/pdf-remote/content');
      return{status:200,body:original};
    }
    throw Error('unexpected request '+n);
  },async()=>{
    const verified=await graph.verifyPdf(original,{id:'pdf-remote',user:'test@example.invalid',directPath:true});
    assert.equal(verified.hash,expectedHash());
  });
});

test('RC1685: Graph denial cannot be interpreted as saved POD',async()=>{
  const graph=fresh();
  await fakeHttp((call,n)=>{
    if(n===1)return token();
    if(n===2)return{status:403,body:{error:{code:'accessDenied',message:'Read permission missing'}}};
    throw Error('unexpected retry');
  },async calls=>{
    await assert.rejects(graph.verifyPdf(original,{id:'pdf-remote',driveId:'drive-exact'}),e=>e.statusCode===403);
    assert.equal(calls.length,2);
  });
});

test('RC1685: oversized Graph download is rejected before buffering the extra PDF data',async()=>{
  const graph=fresh();
  await fakeHttp((call,n)=>{
    if(n===1)return token();
    if(n===2)return{status:200,body:Buffer.concat([original,Buffer.from('EXTRA')])};
    throw Error('unexpected request '+n);
  },async calls=>{
    await assert.rejects(graph.verifyPdf(original,{id:'pdf-remote',driveId:'drive-exact'}),
      e=>e.code==='GRAPH_READBACK_TOO_LARGE');
    assert.equal(calls.length,2);
  });
});
