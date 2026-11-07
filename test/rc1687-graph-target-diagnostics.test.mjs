import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const https=require('https');
const modulePath=require.resolve('../api/shared/graph-drive.js');
function fresh(explicit=true) {
  process.env.EXPORTHUB_GRAPH_TENANT_ID='rc1687-test-tenant';
  process.env.EXPORTHUB_GRAPH_CLIENT_ID='rc1687-test-client';
  process.env.EXPORTHUB_GRAPH_CLIENT_SECRET='rc1687-test-client-secret-DO-NOT-LOG';
  process.env.EXPORTHUB_POD_DRIVE_USER='rc1687-private@example.invalid';
  process.env.EXPORTHUB_POD_FOLDER='Documents/003 Export/ExportHub/Abliefernachweise';
  if (explicit) {
    process.env.EXPORTHUB_POD_DRIVE_ID='rc1687-private-drive';
    process.env.EXPORTHUB_POD_FOLDER_ID='rc1687-private-folder';
  } else {
    delete process.env.EXPORTHUB_POD_DRIVE_ID;
    delete process.env.EXPORTHUB_POD_FOLDER_ID;
  }
  delete require.cache[modulePath];
  return require(modulePath);
}
async function fakeRequests(handler, run) {
  const old=https.request, calls=[];
  https.request=(options, callback)=>{
    const req=new EventEmitter();
    req.write=()=>{};
    req.destroy=e=>queueMicrotask(()=>req.emit('error',e));
    req.end=()=>queueMicrotask(()=>{
      const call={method:options.method,path:options.path,headers:options.headers||{}};
      calls.push(call);
      try {
        const data=handler(call,calls.length) || {status:404,body:{error:{code:'itemNotFound',message:'private target must never be logged'}}};
        const response=new EventEmitter();
        response.statusCode=data.status||200;
        response.headers={};
        callback(response);
        response.emit('data', Buffer.from(JSON.stringify(data.body||{})));
        response.emit('end');
      }catch(e){req.emit('error',e);}
    });
    return req;
  };
  try {await run(calls);}
  finally {https.request=old;}
}
function token(){return {body:{access_token:'rc1687-private-token-DO-NOT-LOG',expires_in:3600}};}
test('RC1904: Entra token errors reveal only bounded cause categories, never private OAuth text',async()=>{
  const cases=[
    ['AADSTS7000222: Client secret expired; secret-private-123','CLIENT_SECRET_EXPIRED',400],
    ['AADSTS7000215: Client secret rejected; secret-private-123','CLIENT_SECRET_REJECTED',400],
    ['AADSTS700016: Application missing; secret-private-123','APPLICATION_NOT_FOUND',400],
    ['AADSTS90002: Tenant missing; secret-private-123','TENANT_NOT_FOUND',400],
    ['Unknown upstream error secret-private-123','OAUTH_CREDENTIALS_REJECTED',400],
    ['Temporary endpoint response secret-private-123','TOKEN_ENDPOINT_UNAVAILABLE',429]
  ];
  for(const [description,expected,httpStatus] of cases){
    const drive=fresh();
    await fakeRequests(call=>{
      assert.match(call.path,/\/oauth2\/v2\.0\/token$/);
      return {status:httpStatus,body:{error:'invalid_client',error_description:description}};
    }, async calls=>{
      const result=await drive.diagnoseTarget({environment:'production'});
      assert.equal(result.ok,false);
      assert.equal(result.code,'GRAPH_DIAGNOSTIC_TOKEN_FAILED');
      assert.equal(result.targetMode,'explicit-ids');
      assert.deepEqual(result.checks.map(x=>x.stage),['app-token']);
      assert.equal(result.checks[0].httpStatus,httpStatus);
      assert.equal(result.checks[0].providerCode,expected);
      assert.equal(calls.length,1,'The probe must stop before any Graph target access');
      const safe=JSON.stringify(result);
      for(const privateValue of ['secret-private-123','rc1687-test-client-secret','rc1687-private-drive','rc1687-private-folder'])
        assert.equal(safe.includes(privateValue),false);
    });
  }
});

test('RC1687: exact Drive and folder metadata checked with GET only, no secrets in response',async()=>{
  const drive=fresh();
  await fakeRequests((call,n)=>{
    if(n===1)return token();
    if(n===2){
      assert.match(call.path,/^\/v1\.0\/drives\/rc1687-private-drive\/items\/rc1687-private-folder\?/);
      return {body:{id:'rc1687-private-folder',folder:{childCount:1}}};
    }
    throw Error('Unexpected HTTP call');
  }, async calls=>{
    const result=await drive.diagnoseTarget();
    assert.equal(result.ok,true);
    assert.equal(result.code,'GRAPH_DIAGNOSTIC_TARGET_READABLE');
    assert.equal(result.targetMode,'explicit-ids');
    assert.deepEqual(result.checks.map(x=>x.stage),['app-token','target-resolver','resolved-folder-read']);
    assert.ok(calls.every(x=>x.method==='POST'||x.method==='GET'));
    assert.equal(calls.filter(x=>x.method==='GET').length,1);
    for (const forbidden of ['rc1687-private-drive','rc1687-private-folder','rc1687-private-token',
      'rc1687-private@example.invalid','003 Export','rc1687-test-client-secret']) {
      assert.equal(JSON.stringify(result).includes(forbidden),false);
    }
  });
});
test('RC1687: Graph 404 on exact folder returns redacted stage and provider code',async()=>{
  const drive=fresh();
  await fakeRequests((call,n)=>n===1?token():
    {status:404,body:{error:{code:'itemNotFound',message:'PRIVATE_FOLDER_NAME: redacted'}}},
    async calls=>{
      const result=await drive.diagnoseTarget();
      assert.equal(result.ok,false);
      assert.equal(result.code,'GRAPH_DIAGNOSTIC_FOLDER_FAILED');
      assert.equal(result.checks.at(-1).status,'not-found');
      assert.equal(result.checks.at(-1).providerCode,'itemNotFound');
      assert.equal(JSON.stringify(result).includes('PRIVATE_FOLDER_NAME'),false);
      assert.equal(calls.filter(x=>x.method==='PUT'||x.method==='DELETE'||x.method==='PATCH').length,0);
    });
});
test('RC1687: Graph 403 is recognized as permission failure, not mistaken for no folder',async()=>{
  const drive=fresh();
  await fakeRequests((call,n)=>n===1?token():
    {status:403,body:{error:{code:'accessDenied',message:'Sensitive Microsoft Graph response'}}},
    async()=>{
      const result=await drive.diagnoseTarget();
      assert.equal(result.ok,false);
      assert.equal(result.checks.at(-1).status,'access-denied');
      assert.equal(result.checks.at(-1).providerCode,'accessDenied');
      assert.equal(JSON.stringify(result).includes('Sensitive Microsoft Graph response'),false);
    });
});
test('RC1687: user folder diagnosis remains read-only even when no default drive exists',async()=>{
  const drive=fresh(false);
  await fakeRequests((call,n)=>{
    if(n===1)return token();
    if(/\/drives\?/.test(call.path))return {body:{value:[]}};
    return {status:404,body:{error:{code:'ResourceNotFound',message:'private user and folder'}}};
  },async calls=>{
    const result=await drive.diagnoseTarget();
    assert.equal(result.ok,false);
    assert.equal(result.targetMode,'user-folder-discovery');
    assert.equal(result.checks.find(x=>x.stage==='user-default-drive').status,'not-found');
    assert.equal(result.checks.find(x=>x.stage==='user-folder-path').status,'not-found');
    assert.equal(result.code,'GRAPH_DIAGNOSTIC_RESOLVER_FAILED');
    assert.ok(calls.length>3);
    assert.ok(calls.every(x=>x.method==='POST'||x.method==='GET'));
    assert.equal(JSON.stringify(result).includes('private user and folder'),false);
  });
});
test('RC1687: OIDC gate precedes diagnostics; daily probes run only in authorized maintenance workflow',()=>{
  const api=fs.readFileSync(new URL('../api/pod-backup-reconcile/index.js',import.meta.url),'utf8');
  const graph=fs.readFileSync(new URL('../api/shared/graph-drive.js',import.meta.url),'utf8');
  const workflow=fs.readFileSync(new URL('../.github/workflows/rc1144-pod-backup-reconcile.yml',import.meta.url),'utf8');
  assert.ok(api.indexOf('githubOidcAuthorized(req)')<api.indexOf('payload.graphTargetDiagnostic === true'));
  assert.match(api,/const diagnostic = await graphDrive\.diagnoseTarget\(\{ environment \}\)/);
  assert.match(api,/diagnosticOnly: true/);
  assert.ok(graph.indexOf('async function diagnoseTarget(options)')<graph.lastIndexOf('module.exports ='));
  assert.ok(workflow.includes('graphTargetDiagnostic'));
  assert.match(workflow,/github\.event\.schedule == '17 2 \* \* \*'/);
  assert.match(workflow,/if: \$\{\{ false \}\}/);
});

test('RC1688: alternate Documents path is probed even when first normalized folder returns 404',async()=>{
  const drive=fresh(false);
  await fakeRequests((call,n)=>{
    if(n===1)return token();
    if(call.path.includes('/drives?$select='))return {body:{value:[]}};
    if(call.path.includes('/drive?$select=id'))return {body:{id:'private-default-drive'}};
    if(call.path.includes('/drive/root:/')) {
      if(call.path.includes('/root:/Documents/'))return {
        body:{id:'alternate-folder',folder:{childCount:0},parentReference:{driveId:'alternate-drive'}}
      };
      return {status:404,body:{error:{code:'itemNotFound',message:'private normalized path'}}};
    }
    if(call.path.includes('/drives/alternate-drive/items/alternate-folder'))return {
      body:{id:'alternate-folder',folder:{childCount:0}}
    };
    throw Error('Unexpected Graph path in read-only probe: '+call.path);
  },async calls=>{
    const result=await drive.diagnoseTarget();
    assert.equal(result.ok,true);
    assert.equal(result.code,'GRAPH_DIAGNOSTIC_TARGET_READABLE');
    assert.equal(result.checks.find(x=>x.stage==='user-folder-path').status,'not-found');
    assert.equal(result.checks.find(x=>x.stage==='user-folder-path-alternative-2').status,'ok');
    assert.equal(result.checks.find(x=>x.stage==='resolved-folder-read').status,'ok');
    assert.equal(calls.filter(x=>['PUT','DELETE','PATCH'].includes(x.method)).length,0);
    assert.equal(JSON.stringify(result).includes('private normalized path'),false);
    assert.equal(JSON.stringify(result).includes('alternate-drive'),false);
  });
});

test('RC1688: manual diagnostic dispatch cannot execute either mutating POD backfill step',()=>{
  const workflow=fs.readFileSync(new URL('../.github/workflows/rc1144-pod-backup-reconcile.yml',import.meta.url),'utf8');
  for(const name of ['Offene TESTSERVICE POD-Backups nachholen','Offene PRODUCTION POD-Backups nachholen']){
    const start=workflow.indexOf('- name: '+name);
    assert.ok(start>0, 'reconcile step exists: '+name);
    const preceding=workflow.slice(start,start+440);
    assert.match(preceding,/if: \$\{\{ \(github\.event_name != 'workflow_dispatch' \|\| inputs\.graphTargetDiagnostic != true\) && \(github\.event_name != 'workflow_run' \|\| github\.event\.workflow_run\.name != 'ExportHUB AV-Prüfung'\) \}\}/, 'manual diagnostic and AV workflow-run must both block POD mutations');
  }
  assert.ok((workflow.match(/inputs\.graphTargetDiagnostic != true/g)||[]).length===2);
  assert.match(workflow,/graphTargetDiagnostic:[\s\S]*?type: boolean/);
  assert.match(workflow,/if: \$\{\{ false \}\}/, 'production POD status bulk audit remains disabled');
});
