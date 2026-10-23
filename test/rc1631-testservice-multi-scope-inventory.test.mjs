import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {collectTestserviceMultiScopeInventory,SCOPES}=require('../api/shared/testservice-multi-scope-inventory.js');
const own=(name,bytes,extra={})=>({name,properties:{contentLength:bytes},...extra});
function fixture(items={},failures=new Set()){
 const calls=[],writes=[];
 const mk=(connection)=>({getContainerClient(container){
   return{async *listBlobsFlat(opts){
    calls.push({connection,container,prefix:opts.prefix,...opts});
    const key=container+'|'+opts.prefix;
    if(failures.has(key))throw new Error('secret-blob-name-token-sas-this-is-sensitive');
    for(const row of items[key]||[])yield row;
   },upload(){writes.push('upload')},createIfNotExists(){writes.push('create')},delete(){writes.push('delete')}};
 }});
 return{services:{primary:mk('primary'),backup:mk('backup')},calls,writes};
}
test('RC1631 scans only seven fixed TESTSERVICE prefixes in six containers',async()=>{
 const f=fixture({'exporthub-teamdata|testservice/':[own('testservice/team.json',10)]});
 const result=await collectTestserviceMultiScopeInventory({
  services:f.services,environment:{EXPORTHUB_STORAGE_CONTAINER:'exporthub-teamdata'}
 });
 assert.equal(SCOPES.length,7);
 assert.equal(new Set(f.calls.map(c=>c.container)).size,6);
 assert.deepEqual(f.calls.map(c=>c.prefix),[
  'testservice/','rc1059/testservice/','testservice/','rc995/testservice/',
  'rc995/testservice/','rc1294/testservice/','rc1220/testservice/'
 ]);
 assert.ok(f.calls.every(c=>c.prefix.includes('testservice/')));
 assert.ok(f.calls.every(c=>c.includeDeleted&&c.includeVersions&&c.includeSnapshots));
 assert.equal(result.complete,true);
 assert.equal(result.scopeCount,7);
 assert.equal(result.totalRecords,1);
 assert.equal(result.totalLogicalBytes,10);
 assert.equal(result.scopes[0].records,1);
 assert.equal(result.scopes[0].status,'listed');
 assert.equal(result.resourceOwnershipVerified,false);
 assert.equal(result.billingVerified,false);
 assert.equal(result.deletionApproved,false);
 assert.equal(result.restoreVerified,false);
 assert.deepEqual(f.writes,[]);
 assert.equal(f.calls.at(-1).connection,'backup');
});
test('RC1631 classifies current version, previous version, snapshots and deleted separately',async()=>{
 const f=fixture({'exporthub-data|testservice/':[
  own('testservice/s',18,{versionId:'v2',isCurrentVersion:true}),
  own('testservice/s',14,{versionId:'v1',isCurrentVersion:false}),
  own('testservice/s',4,{snapshot:'2026-10-20T12:00:00Z'}),
  own('testservice/s',3,{deleted:true})
 ]});
 const r=await collectTestserviceMultiScopeInventory({services:f.services,environment:{}});
 assert.equal(r.scopes[0].records,4);
 assert.deepEqual(Object.fromEntries(Object.entries(r.scopes[0].kinds).map(([k,v])=>[k,v.logicalBytes])),
  {live:18,version:14,snapshot:4,deleted:3});
});
test('RC1631 never mistakes missing container, account or unreadable blob sizes for zero data',async()=>{
 const f=fixture({},new Set(['exporthub-abd-quarantine|rc1294/testservice/']));
 const r=await collectTestserviceMultiScopeInventory({services:f.services,environment:{}});
 assert.equal(r.complete,false);
 assert.equal(r.verifiedScopes,6);
 assert.equal(r.totalLogicalBytes,null);
 assert.equal(r.totalRecords,null);
 const abd=r.scopes.find(s=>s.id==='abd-quarantine');
 assert.deepEqual(abd,{id:'abd-quarantine',status:'unverified',records:null,logicalBytes:null,kinds:null,reason:'other'});
 assert.doesNotMatch(JSON.stringify(r),/secret-blob-name-token-sas-this-is-sensitive/);
 const bad=fixture({'exporthub-data|testservice/':[own('testservice/unreadable',undefined)]});
 const b=await collectTestserviceMultiScopeInventory({services:bad.services,environment:{}});
 assert.equal(b.scopes[0].status,'unverified');assert.equal(b.scopes[0].records,null);
});
test('RC1631 hostile out-of-scope provider result cannot leak a customer name',async()=>{
 const f=fixture({'exporthub-data|testservice/':[own('production/secret-customer-number.pdf',100)]});
 const r=await collectTestserviceMultiScopeInventory({services:f.services,environment:{}});
 assert.equal(r.complete,false);
 assert.equal(r.scopes[0].status,'unverified');
 assert.doesNotMatch(JSON.stringify(r),/secret-customer|production\/|\.pdf/);
});
test('RC1631 respects clock budget, never silently reports partial total as complete',async()=>{
 let counter=0;
 const f=fixture({'exporthub-data|testservice/':[own('testservice/large',10),own('testservice/other',20)]});
 const r=await collectTestserviceMultiScopeInventory({services:f.services,environment:{},maxElapsedMs:2,clock:()=>++counter});
 assert.equal(r.complete,false);
 assert.equal(r.scopes[0].status,'unverified');
 assert.equal(r.totalLogicalBytes,null);
});
test('RC1631 OIDC/TESTSERVICE checks precede multi-scope read-only action',()=>{
 const src=fs.readFileSync('api/e2e-test-fixture/index.js','utf8');
 const env=src.lastIndexOf('requireTestservice(req,payload);');
 const oidc=src.lastIndexOf('if(!await githubOidcAuthorized(req))');
 const action=src.indexOf("if(action==='inventory-scopes'){",oidc);
 const next=src.indexOf("if(action==='inventory-team'){",action);
 assert.ok(env>0&&oidc>env&&action>oidc&&next>action);
 const block=src.slice(action,next);
 assert.match(block,/collectTestserviceMultiScopeInventory/);
 assert.doesNotMatch(block,/createIfNotExists|uploadJson|\.download\(|\.delete\(/);
 assert.match(src,/claims\.ref!=='refs\/heads\/main'/);
});
test('RC1631 release output does not dump Azure secrets or raw inventory response',()=>{
 const wf=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
 const oidc=wf.indexOf('audience=exporthub-e2e-fixture');
 const probe=wf.indexOf('fixture inventory-scopes');
 const mutation=wf.indexOf('prepared="$(fixture prepare)"');
 assert.ok(oidc>=0&&probe>oidc&&mutation>probe);
 assert.match(wf,/x-exporthub-github-oidc: \$oidc_token/);
 assert.match(wf,/ungeprüft/);
 assert.match(wf,/Keine Freigabe für Archivierung, Löschung oder Redundanzumstellung/);
 assert.doesNotMatch(wf,/echo "\$scopes_payload"/);
});

test('RC1631: bounded diagnostic HTTP timeouts cannot turn into indefinite release blocking',()=>{
 const wf=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
 const fixture=wf.slice(wf.indexOf('          fixture() {'),wf.indexOf('          # RC1630:'));
 assert.match(fixture,/inventory-team\|inventory-scopes\)/);
 assert.match(fixture,/inventory_timeout=\(--connect-timeout 8 --max-time 35\)/);
 assert.match(fixture,/curl -sS "\$\{inventory_timeout\[@\]\}"/);
 assert.match(fixture,/if ! fixture_status=/);
 assert.match(fixture,/fixture transport failure action=\$action/);
 assert.doesNotMatch(fixture,/echo "\$oidc_token"/);
 assert.match(wf,/if inventory_payload="\$\(fixture inventory-team\)"; then/);
 assert.match(wf,/if scopes_payload="\$\(fixture inventory-scopes\)"; then/);
});

test('RC1635: cost-diagnostic logs emit fixed category and scope aggregates, never raw Blob response',()=>{
 const wf=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
 const team=wf.indexOf('RC1635 TESTSERVICE-Team-Kategorien');
 const scopes=wf.indexOf('RC1635 TESTSERVICE-Sechs-Container');
 assert.ok(team>0&&scopes>team,'Both signed inventory sections must produce evidence');
 const t=wf.slice(team,team+520),m=wf.slice(scopes,scopes+430);
 assert.match(t,/names\.map\(id=>\(\{id,records:v\.areas\[id\]\.records/);
 assert.match(t,/historicalBytes:keys\.filter\(k=>k!=="live"\)/);
 assert.match(m,/v\.scopes\.map\(x=>\(\{id:x\.id,status:x\.status/);
 assert.match(m,/x\.status==="listed"\?x\.logicalBytes:null/);
 assert.doesNotMatch(t+m,/JSON\.stringify\(v\)|echo.*\$scopes_payload|JSON\.stringify\(scopes_payload\)/);
 assert.match(wf,/const ids=\["team","document-files","container-photos","pickup","pod","abd-quarantine","pod-backup"\]/);
 assert.match(wf,/names\.reduce\(\(a,id\)=>a\+v\.areas\[id\]\.logicalBytes,0\)!==v\.logicalBytes/);
});

test('RC1640: only enumerated non-sensitive failure reasons, no Azure error details',async()=>{
 const expected=[
  [Object.assign(new Error('signed-sas customer name'),{statusCode:404,code:'ContainerNotFound'}),'not-found'],
  [Object.assign(new Error('https://account.blob.core.windows.net/?sig=SECRET'),{statusCode:403,code:'AuthorizationFailure'}),'access-denied'],
  [Object.assign(new Error('private URL'),{statusCode:429}),'transport-error'],
  [Object.assign(new Error('unrecognized sensitive path'),{statusCode:400,code:'SUPER_PRIVATE_CUSTOMER_NAME'}),'other']
 ];
 for(const [e,reason] of expected){
  const services={primary:{getContainerClient(){
   return {async *listBlobsFlat(){throw e}};
  }}};
  const out=await collectTestserviceMultiScopeInventory({services,environment:{}});
  assert.equal(out.complete,false);
  assert.equal(out.scopes[0].reason,reason);
  assert.equal(out.scopes[0].records,null);
  assert.equal(out.scopes[0].logicalBytes,null);
  assert.equal(out.scopes[0].kinds,null);
  assert.equal(out.scopes[1].reason,null);
  assert.doesNotMatch(JSON.stringify(out),/signed-sas|private URL|sig=|SECRET|SUPER_PRIVATE_CUSTOMER_NAME/);
 }
});
test('RC1640: lack of client, unsafe config and expired budget remain explicitly unverified',async()=>{
 const inactive=await collectTestserviceMultiScopeInventory({
  services:{primary:{getContainerClient(){return {listBlobsFlat:null}}}},environment:{}
 });
 assert.equal(inactive.scopes[0].reason,'client-unavailable');
 const invalid=await collectTestserviceMultiScopeInventory({
  services:{primary:fixture().services.primary},environment:{EXPORTHUB_STORAGE_CONTAINER:'example/production'}
 });
 assert.equal(invalid.scopes[0].reason,'configuration');
 const budget=await collectTestserviceMultiScopeInventory({
  services:fixture().services,environment:{},clock:()=>99999,maxElapsedMs:-1
 });
 assert.equal(budget.scopes[0].reason,'time-budget');
 const good=await collectTestserviceMultiScopeInventory({services:fixture().services,environment:{}});
 assert.ok(good.scopes.every(x=>x.status==='listed'&&x.reason===null));
});
