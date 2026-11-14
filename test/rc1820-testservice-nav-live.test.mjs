import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {
  TESTSERVICE_ORIGIN,MENU_ASSETS,assertMenuHtml,
  assertDeploymentIdentity,assertAssetMatches,waitForVerifiedDeploymentIdentity,verifyPublishedMenu
} from '../scripts/rc1820-testservice-nav-live.mjs';

const SHA='a'.repeat(40);
const goodHtml=MENU_ASSETS.map(x=>`<script id="${x.path.includes('top-')?'exporthub-rc1820-topnav-script':'exporthub-rc1579-menu-script'}" src="/${x.path}?v=${x.version}"></script>`).join('\n');

test('RC1820: TESTSERVICE markup includes both versioned menu scripts',()=>{
  assert.doesNotThrow(()=>assertMenuHtml(goodHtml));
  assert.throws(()=>assertMenuHtml(goodHtml.replace('20261112','1630')),/lacks current menu asset/);
  assert.throws(()=>assertMenuHtml(goodHtml.replace('exporthub-rc1820-topnav-script','stale')),/script tags missing/);
});

test('RC1820: live health cannot pass for wrong SHA, unverified identity, or production',()=>{
  const deployment={verified:true,environment:'testservice',buildId:SHA};
  assert.doesNotThrow(()=>assertDeploymentIdentity({deployment},SHA));
  for(const override of [{buildId:'b'.repeat(40)},{verified:false},{environment:'production'}]){
    assert.throws(()=>assertDeploymentIdentity({deployment:{...deployment,...override}},SHA),/deployed SHA/);
  }
});

test('RC1820: transient stale health identity retries with unique cache keys and exact SHA',async()=>{
  const requests=[],delays=[];
  const expected=SHA;
  const attempts=await waitForVerifiedDeploymentIdentity({
    expectedSha:expected,maxAttempts:3,waitFn:async ms=>delays.push(ms),
    read:async relative=>{
      requests.push(relative);
      const sha=requests.length<3?'b'.repeat(40):expected;
      return Buffer.from(JSON.stringify({deployment:{verified:true,environment:'testservice',buildId:sha}}));
    }
  });
  assert.equal(attempts,3);
  assert.deepEqual(delays,[3000,3000]);
  assert.deepEqual(requests,[
    `/api/exporthub-health?rc1820=${SHA}-1`,
    `/api/exporthub-health?rc1820=${SHA}-2`,
    `/api/exporthub-health?rc1820=${SHA}-3`
  ]);
});

test('RC1820: stale or production identity never passes after bounded retries',async()=>{
  let reads=0;
  const read=async()=>{
    reads++;
    return Buffer.from(JSON.stringify({deployment:{verified:true,environment:'production',buildId:SHA}}));
  };
  await assert.rejects(waitForVerifiedDeploymentIdentity({
    expectedSha:SHA,maxAttempts:3,waitFn:async()=>{},read
  }),/deployed SHA is not verified or differs/);
  assert.equal(reads,3);
});

test('RC1820: HTTP redirects and non-JSON fail without retries or weakening safety',async()=>{
  const waitFn=()=>{throw Error('Unexpected retry')};
  await assert.rejects(waitForVerifiedDeploymentIdentity({
    expectedSha:SHA,waitFn,read:async()=>Buffer.from('<html>redirect</html>')
  }),/not valid JSON/);
  await assert.rejects(waitForVerifiedDeploymentIdentity({
    expectedSha:SHA,maxAttempts:0,read:async()=>{throw Error('Unexpected GET')}
  }),/invalid bounded/);
});

test('RC1820: exact JS bytes must match the checked-out main',()=>{
  assert.doesNotThrow(()=>assertAssetMatches(Buffer.from('exact'),Buffer.from('exact'),'menu.js'));
  assert.throws(()=>assertAssetMatches(Buffer.from('exact'),Buffer.from('stale'),'menu.js'),/published asset differs/);
});

test('RC1820: read-only end-to-end HTTP mirror accepts exact TESTSERVICE assets',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rc1820-menu-'));
  try{
    for(const asset of MENU_ASSETS){
      const target=path.join(root,asset.path);
      fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.writeFileSync(target,`// ${asset.path} reviewed`);
    }
    const requested=[];
    const fetchImpl=async (target,options)=>{
      const url=new URL(target);requested.push({url,options});
      assert.equal(url.origin,TESTSERVICE_ORIGIN);
      assert.equal(options.method,'GET');
      assert.equal(options.redirect,'manual');
      if(url.pathname==='/api/exporthub-health')return new Response(JSON.stringify({deployment:{verified:true,environment:'testservice',buildId:SHA}}));
      if(url.pathname==='/')return new Response(goodHtml);
      const asset=MENU_ASSETS.find(x=>url.pathname==='/'+x.path);
      assert.ok(asset,`unexpected URL ${url.pathname}`);
      assert.equal(url.searchParams.get('v'),asset.version);
      return new Response(fs.readFileSync(path.join(root,asset.path)));
    };
    const result=await verifyPublishedMenu({expectedSha:SHA,fetchImpl,root});
    assert.equal(result.verified,true);
    assert.equal(result.menuAssets,2);
    assert.equal(requested.length,4);
    assert.equal(requested[0].url.searchParams.get('rc1820'),SHA+'-1');
    assert.equal(requested[1].url.pathname,'/','menu HTML must be read through canonical TESTSERVICE entry');
    assert.equal(requested[1].url.searchParams.get('rc1820'),SHA);
    assert.ok(requested.every(x=>x.options.method==='GET'));
    assert.ok(requested.every(x=>x.options.redirect==='manual'));
    assert.ok(requested.every(x=>x.url.pathname!=='/TESTVERSION.html'));
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('RC1820: canonical TESTSERVICE root rewrites to TESTVERSION without direct file fetch',()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const config=JSON.parse(fs.readFileSync(path.join(root,'staticwebapp.testservice.config.json'),'utf8'));
  const route=config.routes.find(entry=>entry.route==='/');
  assert.equal(route?.rewrite,'/TESTVERSION.html');
  assert.ok(route?.allowedRoles?.includes('anonymous'));
});

test('RC1820: canonical root redirect fails closed instead of masking an unverified document',async()=>{
  const fetchImpl=async target=>{
    if(new URL(target).pathname==='/api/exporthub-health')
      return new Response(JSON.stringify({deployment:{verified:true,environment:'testservice',buildId:SHA}}));
    return new Response('',{status:301,headers:{Location:'https://login.microsoftonline.com/'}});
  };
  await assert.rejects(verifyPublishedMenu({expectedSha:SHA,fetchImpl}),/GET \/ HTTP 301/);
});

test('RC1820: Microsoft redirects block release proof',async()=>{
  const fetchImpl=async()=>new Response('',{status:302,headers:{Location:'https://login.microsoftonline.com/'}});
  await assert.rejects(verifyPublishedMenu({expectedSha:SHA,fetchImpl}),/HTTP 302/);
});

test('RC1820: invalid expected SHA fails before any network request',async()=>{
  await assert.rejects(verifyPublishedMenu({expectedSha:'short',fetchImpl:()=>{throw Error('Unexpected network call')}}),/40-character/);
});

test('RC1820: published asset expectations stay synchronized with the current build',()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const builder=fs.readFileSync(path.join(root,'.github/rc1112/build-three-env.mjs'),'utf8');
  for(const asset of MENU_ASSETS){
    assert.ok(builder.includes('/'+asset.path+'?v='+asset.version),
      'Live gate expects an outdated script version: '+asset.path);
  }
});

test('RC1820: main workflow tests deployed assets after identity and before other live gates',()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const workflowPath=path.join(root,'.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.ok(fs.existsSync(workflowPath),'Release workflow must exist in the repository');
  const workflow=fs.readFileSync(workflowPath,'utf8');
  const identity=workflow.indexOf('- name: RC1553 TESTSERVICE deployment identity prüfen');
  const gate=workflow.indexOf('- name: RC1820 TESTSERVICE ausgelieferte Menüs prüfen');
  const other=workflow.indexOf('- name: RC1943 Dokumente erstellen Excel-Upload auf TESTSERVICE ausgeliefert');
  assert.ok(identity>=0&&gate>identity&&other>gate,'Live menu gate must run immediately after verified TESTSERVICE identity');
  assert.match(workflow,/node scripts\/rc1820-testservice-nav-live\.mjs "\$GITHUB_SHA"/);
});
