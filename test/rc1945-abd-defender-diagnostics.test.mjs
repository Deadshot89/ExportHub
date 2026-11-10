import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {PREFIX,collectTestserviceAbdDefenderDiagnostics,matchesObservedPortalAccount}=require('../api/shared/rc1945-abd-defender-diagnostics.js');
const fixtureSource=fs.readFileSync('api/e2e-test-fixture/index.js','utf8');
const workflowSource=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

const NOW=Date.parse('2026-11-09T16:00:00Z');
function harness(items,options={}){
 const accessed=[],methods=[];
 const container={
  async *listBlobsFlat(opts){
   methods.push('LIST');assert.equal(opts.prefix,PREFIX,'only fixed TESTSERVICE quarantine prefix');
   assert.equal(opts.includeDeleted,undefined);
   for(const item of items)yield {name:PREFIX+item.name,properties:{createdOn:new Date(NOW-item.ageMs)}};
  },
  getBlobClient(name){
   assert.ok(name.startsWith(PREFIX),'never access PRODUCTION prefix');
   accessed.push(name);
   return{async getTags(){
    methods.push('GET_TAGS');
    const item=items.find(i=>PREFIX+i.name===name);
    if(item.error)throw item.error;
    return{tags:item.tags||{}};
   }};
  }
 };
 const service={getContainerClient(name){methods.push('CONTAINER');assert.equal(name,'exporthub-abd-quarantine');return container}};
 return{service,accessed,methods};
}

test('RC1945: aggregates clean and delayed pending tags without disclosing names',async()=>{
 const h=harness([
  {name:'safe-a.xlsx',ageMs:60000,tags:{'Malware scanning scan result':'No threats found'}},
  {name:'waiting-b.xlsx',ageMs:180000,tags:{}},
  {name:'stale-c.xlsx',ageMs:9000000,tags:{}}
 ]);
 const report=await collectTestserviceAbdDefenderDiagnostics({service:h.service,containerName:'exporthub-abd-quarantine',clock:()=>NOW});
 assert.equal(report.status,'verified');
 assert.deepEqual(report.states,{clean:1,pending:2,malicious:0,'not-scanned':0,error:0});
 assert.equal(report.recordCount,3);
 assert.equal(report.pendingOver120Seconds,2);
 assert.equal(report.pendingOverTwoHours,1);
 assert.equal(report.environment,'testservice');
 assert.equal(report.resourceOwnershipVerified,false);
 assert.equal(report.billingVerified,false);
 assert.equal(report.configurationChangeApproved,false);
 assert.doesNotMatch(JSON.stringify(report),/safe-a|waiting-b|stale-c|No threats found|rc1294/);
 assert.deepEqual(h.methods,['CONTAINER','LIST','GET_TAGS','GET_TAGS','GET_TAGS']);
});

test('RC1945: malicious, unsupported, error, empty scan results are never interpreted as clean',async()=>{
 const h=harness([
  {name:'m',ageMs:10000,tags:{'Malware scanning scan result':'Malicious'}},
  {name:'n',ageMs:10000,tags:{'Malware scanning scan result':'Not scanned'}},
  {name:'e',ageMs:10000,tags:{'Malware scanning scan result':'Error: scanner unavailable'}},
  {name:'p',ageMs:10000,tags:{}}
 ]);
 const report=await collectTestserviceAbdDefenderDiagnostics({service:h.service,containerName:'exporthub-abd-quarantine',clock:()=>NOW});
 assert.deepEqual(report.states,{clean:0,pending:1,malicious:1,'not-scanned':1,error:1});
});

test('RC1945: access errors report a fixed unverified reason without provider details',async()=>{
 const h=harness([{name:'do-not-log-this.xlsx',ageMs:300000,error:Object.assign(new Error('Storage Key=REDACT_ME'),{statusCode:403})}]);
 const report=await collectTestserviceAbdDefenderDiagnostics({service:h.service,containerName:'exporthub-abd-quarantine',clock:()=>NOW});
 assert.equal(report.status,'unverified');assert.equal(report.reason,'access-denied');
 assert.equal(report.states,null);assert.equal(report.recordCount,null);
 assert.doesNotMatch(JSON.stringify(report),/REDACT_ME|do-not-log-this/);
});

test('RC1945: fails closed for out-of-scope names and truncated inventory',async()=>{
 let service={getContainerClient(){return{
  async *listBlobsFlat(){yield{name:'rc1294/production/secret.pdf',properties:{createdOn:new Date(NOW)}};},
  getBlobClient(){throw Error('must not be called')}
 }}};
 const wrong=await collectTestserviceAbdDefenderDiagnostics({service,containerName:'exporthub-abd-quarantine',clock:()=>NOW});
 assert.equal(wrong.status,'unverified');assert.equal(wrong.reason,'incomplete');assert.equal(wrong.states,null);
 const h=harness([{name:'a',ageMs:1000},{name:'b',ageMs:1000}]);
 const limited=await collectTestserviceAbdDefenderDiagnostics({service:h.service,containerName:'exporthub-abd-quarantine',clock:()=>NOW,limit:1});
 assert.equal(limited.status,'unverified');assert.equal(limited.reason,'incomplete');assert.equal(limited.recordCount,null);
});

test('RC1945: invalid configuration cannot start storage calls',async()=>{
 const h=harness([]);
 for(const containerName of ['','../../production','Invalid_Container']){
  const report=await collectTestserviceAbdDefenderDiagnostics({service:h.service,containerName,clock:()=>NOW});
  assert.equal(report.status,'unverified');assert.equal(report.reason,'configuration');
 }
 assert.deepEqual(h.methods,[]);
});

test('RC1945: fixture remains signed and TESTSERVICE-only; diagnostics run before mutation setup',()=>{
 const guard=fixtureSource.indexOf('if(!await githubOidcAuthorized(req))');
 const action=fixtureSource.indexOf("if(action==='diagnose-abd-defender')");
 const mutation=fixtureSource.indexOf("if(action==='prepare')");
 assert.ok(guard>0&&action>guard&&mutation>action);
 assert.ok(fixtureSource.indexOf('requireTestservice(req,payload)')<guard);
 assert.match(fixtureSource,/EXPORTHUB_ABD_QUARANTINE_CONTAINER/);
 assert.match(fixtureSource,/collectTestserviceAbdDefenderDiagnostics/);
 assert.doesNotMatch(fixtureSource.slice(action,fixtureSource.indexOf("if(action==='inventory-blob-policy')",action)),/\.upload\(|\.delete\(|\.setTags\(/);
});

test('RC1945: TESTSERVICE CI uses existing OIDC fixture and never changes Azure security settings',()=>{
 assert.match(workflowSource,/fixture diagnose-abd-defender/);
 assert.match(workflowSource,/RC1945.*Defender/i);
 assert.doesNotMatch(workflowSource,/az security pricing create|az security pricing update|defender-plan enable/i);
});

test('RC1945: stale slow tag response never yields verified inventory',async()=>{
 const h=harness([{name:'delayed.xlsx',ageMs:180000,tags:{}}]);
 let calls=0;
 const report=await collectTestserviceAbdDefenderDiagnostics({
  service:h.service,containerName:'exporthub-abd-quarantine',budgetMs:12000,
  clock:()=>NOW+([0,0,12001][Math.min(calls++,2)])
 });
 assert.equal(report.status,'unverified');
 assert.equal(report.reason,'incomplete');
 assert.equal(report.recordCount,null);
 assert.deepEqual(h.methods,['CONTAINER','LIST','GET_TAGS']);
});

test('RC1945: SDK connection-string failures are redacted before generic fixture error handler',()=>{
 const start=fixtureSource.indexOf("if(action==='diagnose-abd-defender')");
 const end=fixtureSource.indexOf("if(action==='inventory-blob-policy')",start);
 assert.ok(start>0&&end>start);
 const block=fixtureSource.slice(start,end);
 assert.match(block,/try\s*\{[\s\S]*BlobServiceClient\.fromConnectionString\(cs\)/);
 assert.match(block,/catch\s*\(_\)\s*\{[\s\S]*diagnostics=await collectTestserviceAbdDefenderDiagnostics\(\)/);
 assert.doesNotMatch(block,/context\.log|console\.log|message\s*:\s*[^,}]+/);
});

test('RC1960: classify only the actual Azure Blob SDK endpoint, without exposing its identity',()=>{
 assert.equal(matchesObservedPortalAccount('https://exporthubdata89.blob.core.windows.net/'),true);
 assert.equal(matchesObservedPortalAccount('https://differentaccount.blob.core.windows.net/'),false);
 for(const endpoint of [
  '', 'not-a-url','http://exporthubdata89.blob.core.windows.net/',
  'https://exporthubdata89.blob.core.windows.net.attacker.invalid/',
  'https://corporate-custom-domain.example/',
  'https://127.0.0.1:10000/devstoreaccount1',
  'https://exporthubdata89.blob.core.windows.net:8080/',
  'https://exporthubdata89.blob.core.usgovcloudapi.net/'
 ])assert.equal(matchesObservedPortalAccount(endpoint),null,endpoint);
});

test('RC1960: account proof remains behind existing TESTSERVICE OIDC gate',()=>{
 const start=fixtureSource.indexOf("if(action==='diagnose-abd-defender')");
 const end=fixtureSource.indexOf("if(action==='inventory-blob-policy')",start);
 assert.ok(start>0&&end>start);
 const block=fixtureSource.slice(start,end);
 assert.match(block,/matchesObservedPortalAccount\(account\.url\)/);
 assert.match(block,/observedPortalAccountMatchesActiveBlob:diagnostics\.status==='verified'\?observedAccountMatch:null/);
 assert.doesNotMatch(block,/console\.log|context\.log|\.setTags\(|\.upload\(|\.delete\(/);
 assert.ok(fixtureSource.indexOf('if(!await githubOidcAuthorized(req))')<start);
 assert.ok(fixtureSource.indexOf('requireTestservice(req,payload)')<start);
});

test('RC1961: signed TESTSERVICE workflow reports only validated storage-account tri-state',()=>{
 assert.match(workflowSource,/const observedAccountMatch=v\.observedPortalAccountMatchesActiveBlob/);
 assert.match(workflowSource,/observedAccountMatch===true\|\|observedAccountMatch===false\|\|observedAccountMatch===null/);
 assert.match(workflowSource,/v\.status!=="verified"&&observedAccountMatch!==null/);
 assert.match(workflowSource,/report\.observedPortalAccountMatchesActiveBlob=observedAccountMatch/);
 assert.match(workflowSource,/Tatsächliches ABD-Speicherkonto entspricht Portalbefund/);
 const begin=workflowSource.indexOf('const observedAccountMatch=v.observedPortalAccountMatchesActiveBlob');
 const end=workflowSource.indexOf('console.log("RC1945 Defender-Scan-Diagnose ',begin);
 assert.ok(begin>=0&&end>begin);
 assert.doesNotMatch(workflowSource.slice(begin,end),/account\.url|connectionString|AccountKey|sasToken/);
});
