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

test('RC1473: direkter Main-Push ohne zugeordneten gemergten PR wird fail-closed blockiert',async()=>{
  const {verifyMainPrProvenance}=await loadGate();
  let calls=0;
  await assert.rejects(
    verifyMainPrProvenance({
      env:pushEnv(),
      fetchImpl:async()=>{calls++;return response(200,[])},
      sleepImpl:async()=>{},
      attempts:2
    }),
    /DIRECT_MAIN_PUSH_BLOCKED|gemergten PR/i
  );
  assert.equal(calls,2,'leere PR-Zuordnung soll kurz gegen GitHub-Eventual-Consistency erneut geprüft werden');
});

test('RC1473: gemergter PR nach main erlaubt den Main-Push',async()=>{
  const {verifyMainPrProvenance}=await loadGate();
  const result=await verifyMainPrProvenance({
    env:pushEnv(),
    fetchImpl:async()=>response(200,[{number:619,merged_at:'2026-10-10T12:39:53Z',base:{ref:'main'}}]),
    sleepImpl:async()=>{}
  });
  assert.equal(result.checked,true);
  assert.equal(result.pullRequest,619);
});

test('RC1473: offener oder fremd basierter PR reicht nicht als Release-Herkunft',async()=>{
  const {verifyMainPrProvenance}=await loadGate();
  await assert.rejects(
    verifyMainPrProvenance({
      env:pushEnv(),
      fetchImpl:async()=>response(200,[
        {number:1,merged_at:null,base:{ref:'main'}},
        {number:2,merged_at:'2026-10-10T12:39:53Z',base:{ref:'develop'}}
      ]),
      sleepImpl:async()=>{},
      attempts:1
    }),
    /DIRECT_MAIN_PUSH_BLOCKED|gemergten PR/i
  );
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
