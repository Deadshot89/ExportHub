import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const scriptPath='.github/rc1473/verify-main-pr-provenance.mjs';
const sharedContractPath='test/rc1018-production-deploy.test.mjs';
const contractPath='.github/workflows/rc1002-main-contract.yml';
const deployPath='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';

async function loadGate(){
  assert.equal(fs.existsSync(scriptPath),true,'RC1473 provenance gate script fehlt');
  const url=pathToFileURL(`${process.cwd()}/${scriptPath}`).href+`?test=${Date.now()}-${Math.random()}`;
  return import(url);
}

function response(status,payload){
  return {ok:status>=200&&status<300,status,async json(){return payload}};
}

function pushEnv(overrides={}){
  return {
    GITHUB_EVENT_NAME:'push',
    GITHUB_REF:'refs/heads/main',
    GITHUB_REPOSITORY:'Deadshot89/ExportHub',
    GITHUB_SHA:'abc123',
    ...overrides
  };
}
function pushEvent(overrides={}){return{before:'base123',after:'abc123',...overrides}}
function validMergedPr(overrides={}){
  return {
    number:619,
    merged_at:'2026-10-10T12:39:53Z',
    merge_commit_sha:'abc123',
    base:{ref:'main',sha:'stale-base'},
    head:{sha:'head123'},
    ...overrides
  };
}
function validCommit(overrides={}){
  return {sha:'abc123',parents:[{sha:'base123'},{sha:'head123'}],...overrides};
}
function provenanceFetch({pr=validMergedPr(),commit=validCommit(),onRequest=()=>{}}={}){
  return async(url,options)=>{
    onRequest(url,options);
    if(url.endsWith('/pulls'))return response(200,[pr]);
    if(url.endsWith('/commits/abc123'))return response(200,commit);
    return response(404,{});
  };
}

test('RC1473: direkter Main-Push ohne zugeordneten gemergten PR wird fail-closed blockiert',async()=>{
  const {verifyMainPrProvenance}=await loadGate();
  let calls=0;
  await assert.rejects(
    verifyMainPrProvenance({
      env:pushEnv(),eventPayload:pushEvent(),
      fetchImpl:async()=>{calls++;return response(200,[])},
      sleepImpl:async()=>{},
      attempts:2
    }),
    /DIRECT_MAIN_PUSH_BLOCKED|gemergten PR/i
  );
  assert.equal(calls,2,'leere PR-Zuordnung soll kurz gegen GitHub-Eventual-Consistency erneut geprüft werden');
});

test('RC1473: gemergter PR nach main mit tatsächlicher Push-Basis erlaubt den Main-Push auch bei veralteter PR-base.sha',async()=>{
  const {verifyMainPrProvenance}=await loadGate();
  const result=await verifyMainPrProvenance({
    env:pushEnv(),eventPayload:pushEvent(),
    fetchImpl:provenanceFetch(),
    sleepImpl:async()=>{}
  });
  assert.equal(result.checked,true);
  assert.equal(result.pullRequest,619);
  assert.equal(result.before,'base123');
});

test('RC1473: offener, fremd basierter oder nicht zum Merge-Commit gehörender PR reicht nicht als Release-Herkunft',async()=>{
  const {verifyMainPrProvenance}=await loadGate();
  await assert.rejects(
    verifyMainPrProvenance({
      env:pushEnv(),eventPayload:pushEvent(),
      fetchImpl:async()=>response(200,[
        {number:1,merged_at:null,merge_commit_sha:'abc123',base:{ref:'main',sha:'base123'},head:{sha:'head123'}},
        {number:2,merged_at:'2026-10-10T12:39:53Z',merge_commit_sha:'abc123',base:{ref:'develop',sha:'base123'},head:{sha:'head123'}},
        {number:3,merged_at:'2026-09-01T10:00:00Z',merge_commit_sha:'other-merge',base:{ref:'main',sha:'old-base'},head:{sha:'head123'}}
      ]),
      sleepImpl:async()=>{},
      attempts:1
    }),
    /DIRECT_MAIN_PUSH_BLOCKED|gemergten PR/i
  );
});

test('RC1473: manipuliertes oder unpassendes Push-Event wird vor API-Abfrage blockiert',async()=>{
  const {verifyMainPrProvenance}=await loadGate();
  let calls=0;
  await assert.rejects(
    verifyMainPrProvenance({env:pushEnv(),eventPayload:pushEvent({after:'other-sha'}),fetchImpl:async()=>{calls++;return response(200,[])}}),
    /DIRECT_MAIN_PUSH_BLOCKED|passt nicht/i
  );
  assert.equal(calls,0);
});

test('RC1473: PR- und manuelle Verifikationsläufe werden nicht fälschlich blockiert',async()=>{
  const {verifyMainPrProvenance}=await loadGate();
  let calls=0;
  const fetchImpl=async()=>{calls++;return response(500,{})};
  const pr=await verifyMainPrProvenance({env:pushEnv({GITHUB_EVENT_NAME:'pull_request',GITHUB_REF:'refs/pull/1/merge'}),fetchImpl,sleepImpl:async()=>{}});
  const manual=await verifyMainPrProvenance({env:pushEnv({GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main'}),fetchImpl,sleepImpl:async()=>{}});
  assert.equal(pr.checked,false);
  assert.equal(manual.checked,false);
  assert.equal(calls,0);
});

test('RC1473: gemeinsamer Production-Vertrag erzwingt die Herkunftsprüfung auf Modulebene',()=>{
  const shared=fs.readFileSync(sharedContractPath,'utf8');
  assert.match(shared,/verifyMainPrProvenance/,'Production-Vertrag muss den gemeinsamen RC1473-Gate importieren');
  assert.match(shared,/await\s+verifyMainPrProvenance\(\);/,'Production-Vertrag muss die Herkunft vor seinen Assertions fail-closed prüfen');
});

test('RC1473: Main-Contract und Production-Deploy führen den geschützten gemeinsamen Vertrag vor Freigabe/Deployment aus',()=>{
  const main=fs.readFileSync(contractPath,'utf8');
  const deploy=fs.readFileSync(deployPath,'utf8');
  for(const [rel,source,releaseMarker] of [
    [contractPath,main,'Gesamte Node-Regression'],
    [deployPath,deploy,'RC1112 Produktion TESTSERVICE und Demo gemeinsam bauen']
  ]){
    const gate=source.indexOf('test/rc1018-production-deploy.test.mjs');
    const release=source.indexOf(releaseMarker);
    assert.ok(gate>=0,`${rel}: gemeinsamer Production-Vertrag fehlt`);
    assert.ok(release>=0,`${rel}: Release-/Deploy-Marker fehlt`);
    assert.ok(gate<release,`${rel}: Herkunftsprüfung muss vor Freigabe/Deployment liegen`);
  }
});

test('RC1482: Main-Push Provenienzabfragen nutzen den Workflow-Token statt anonymer GitHub-API',async()=>{
  const {verifyMainPrProvenance}=await loadGate();
  const requests=[];
  const result=await verifyMainPrProvenance({
    env:pushEnv({GITHUB_TOKEN:'read-only-token'}),eventPayload:pushEvent(),
    fetchImpl:provenanceFetch({onRequest:(url,options)=>requests.push({url,options})}),
    sleepImpl:async()=>{}
  });
  assert.equal(result.checked,true);
  assert.equal(requests.length,2,'PR-Zuordnung und tatsächlicher Commit müssen geprüft werden');
  for(const request of requests){
    assert.equal(request.options?.headers?.Authorization,'Bearer read-only-token','Provenienz-Gate muss GitHub API authentifiziert aufrufen');
  }
});

test('RC1482: Release-Workflows geben dem Provenienz-Gate nur lesenden PR-Zugriff und Token auf Main-Push',()=>{
  for(const rel of [contractPath,deployPath]){
    const source=fs.readFileSync(rel,'utf8');
    assert.match(source,/permissions:\s*[\s\S]*?contents:\s*read[\s\S]*?pull-requests:\s*read/,`${rel}: pull-requests: read fehlt`);
    assert.match(source,/GITHUB_TOKEN:\s*\$\{\{\s*github\.event_name\s*==\s*'push'\s*&&\s*github\.token\s*\|\|\s*''\s*\}\}/,`${rel}: GitHub-Token muss nur bei Push-Läufen an den Job gegeben werden`);
  }
});
