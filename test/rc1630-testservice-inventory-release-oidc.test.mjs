import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {collectTestserviceTeamInventory}=require('../api/shared/testservice-team-inventory.js');

test('RC1630: inventory action is behind verified OIDC, test-only environment, and no team download',()=>{
 const src=fs.readFileSync('api/e2e-test-fixture/index.js','utf8');
 const testEnv=src.lastIndexOf('requireTestservice(req,payload);');
 const oidc=src.lastIndexOf('if(!await githubOidcAuthorized(req))');
 const check=src.indexOf("if(action==='inventory-team'){",oidc);
 const doWrite=src.indexOf("if(action==='prepare')",check);
 assert.ok(testEnv>=0&&oidc>testEnv&&check>oidc&&doWrite>check);
 const action=src.slice(check,doWrite);
 assert.match(action,/collectTestserviceTeamInventory\(container\)/);
 assert.match(action,/action:'inventory-team'/);
 assert.doesNotMatch(action,/\.upload\(|uploadJson\(|mutateTestTeam\(|\.download\(/);
 assert.match(src,/workflow_ref/);
 assert.match(src,/refs\/heads\/main/);
});

test('RC1630: existing OIDC workflow inventory precedes fixture mutation, but cannot disable test gates',()=>{
 const wf=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
 const token=wf.indexOf('audience=exporthub-e2e-fixture');
 const call=wf.indexOf('fixture inventory-team');
 const prepare=wf.indexOf('prepared="$(fixture prepare)"');
 const browser=wf.indexOf("npx playwright test e2e/specs/testservice-mutation.spec.mjs --project=laptop --grep 'RC1255 P2:'");
 assert.ok(token>=0&&call>token&&prepare>call&&browser>prepare);
 assert.match(wf,/RC1630: Inventurdaten unvollständig oder fehlerhaft; keine Speicherfreigabe/);
 assert.match(wf,/v\.billingVerified!==false/);
 assert.match(wf,/v\.scope!=="team-prefix"/);
 assert.match(wf,/v\.environment!=="testservice"/);
 assert.match(wf,/GITHUB_STEP_SUMMARY/);
 assert.doesNotMatch(wf,/EXPORTHUB_TEST_INVENTORY_CONNECTION_STRING/);
});

test('RC1630: read-only inventory omits names even with PII-bearing blob paths',async()=>{
 const items=[
  {name:'testservice/customer-private-123.json',properties:{contentLength:123},isCurrentVersion:true},
  {name:'testservice/customer-private-123.json',versionId:'older',isCurrentVersion:false,properties:{contentLength:98}}
 ];
 const c={async *listBlobsFlat(o){assert.equal(o.prefix,'testservice/');yield* items;}};
 const output=await collectTestserviceTeamInventory(c);
 assert.equal(output.complete,true);
 assert.equal(output.logicalBytes,221);
 assert.equal(output.historicalLogicalBytes,98);
 assert.equal(output.liveLogicalBytes,123);
 assert.equal(output.billingVerified,false);
 assert.equal(output.sharedProductionDependenciesResolved,false);
 assert.doesNotMatch(JSON.stringify(output),/customer-private|123\.json|older/);
});
