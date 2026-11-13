import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {
  TESTSERVICE_ORIGIN,MENU_ASSETS,assertMenuHtml,
  assertDeploymentIdentity,assertAssetMatches,verifyPublishedMenu
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
      if(url.pathname==='/TESTVERSION.html')return new Response(goodHtml);
      const asset=MENU_ASSETS.find(x=>url.pathname==='/'+x.path);
      assert.ok(asset,`unexpected URL ${url.pathname}`);
      assert.equal(url.searchParams.get('v'),asset.version);
      return new Response(fs.readFileSync(path.join(root,asset.path)));
    };
    const result=await verifyPublishedMenu({expectedSha:SHA,fetchImpl,root});
    assert.equal(result.verified,true);
    assert.equal(result.menuAssets,2);
    assert.equal(requested.length,4);
    assert.ok(requested.every(x=>x.options.method==='GET'));
  }finally{fs.rmSync(root,{recursive:true,force:true})}
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
