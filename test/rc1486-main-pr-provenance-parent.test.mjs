import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyMainPrProvenance} from '../.github/rc1473/verify-main-pr-provenance.mjs';

function response(status,payload){
  return {ok:status>=200&&status<300,status,async json(){return payload}};
}

function env(){
  return {
    GITHUB_EVENT_NAME:'push',
    GITHUB_REF:'refs/heads/main',
    GITHUB_REPOSITORY:'Deadshot89/ExportHub',
    GITHUB_SHA:'abc123',
    GITHUB_TOKEN:'read-only-token'
  };
}

function event(){return {before:'base123',after:'abc123'};}

function mergedPr(){
  return {
    number:636,
    merged_at:'2026-10-11T09:13:44Z',
    merge_commit_sha:'abc123',
    base:{ref:'main',sha:'stale-base-from-pr-open-time'},
    head:{sha:'head123'}
  };
}

test('RC1486: legitimer Merge bleibt erlaubt wenn PR base.sha wegen zwischenzeitlichem Main-Fortschritt veraltet ist',async()=>{
  const urls=[];
  const result=await verifyMainPrProvenance({
    env:env(),eventPayload:event(),attempts:1,sleepImpl:async()=>{},
    fetchImpl:async url=>{
      urls.push(url);
      if(url.endsWith('/pulls'))return response(200,[mergedPr()]);
      if(url.endsWith('/commits/abc123'))return response(200,{sha:'abc123',parents:[{sha:'base123'},{sha:'head123'}]});
      return response(404,{});
    }
  });
  assert.equal(result.checked,true);
  assert.equal(result.pullRequest,636);
  assert.equal(result.before,'base123');
  assert.ok(urls.some(url=>url.endsWith('/commits/abc123')),'Gate muss den tatsächlichen Merge-Commit statt pr.base.sha prüfen');
});

test('RC1486: PR-Zuordnung allein reicht nicht wenn der tatsächliche Commit nicht auf dem Push-before basiert',async()=>{
  await assert.rejects(
    verifyMainPrProvenance({
      env:env(),eventPayload:event(),attempts:1,sleepImpl:async()=>{},
      fetchImpl:async url=>{
        if(url.endsWith('/pulls'))return response(200,[mergedPr()]);
        if(url.endsWith('/commits/abc123'))return response(200,{sha:'abc123',parents:[{sha:'other-base'},{sha:'head123'}]});
        return response(404,{});
      }
    }),
    /DIRECT_MAIN_PUSH_BLOCKED|Merge-Commit|Push-Basis|Eltern/i
  );
});
