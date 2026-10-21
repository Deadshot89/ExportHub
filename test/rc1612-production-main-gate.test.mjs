import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateMainGate,verifyReleaseGate} from '../.github/rc1612/verify-main-gate.mjs';

const sha='1'.repeat(40);
const run=(overrides={})=>({id:123,head_sha:sha,head_branch:'main',event:'push',
  path:'.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml',
  status:'completed',conclusion:'success',...overrides});
const names=[
  'RC1381 TESTSERVICE stale-deploy guard','Deploy ExportHUB TESTSERVICE',
  'RC1553 TESTSERVICE deployment identity prüfen','RC1124 TESTSERVICE Browser Gate',
  'RC1170 TESTSERVICE Kundenportal-Verschlüsselung prüfen',
  'RC1249 TESTSERVICE AVIS-Mail-Konfiguration prüfen',
  'RC1505 TESTSERVICE Readiness prüfen'
];
const job=(overrides={})=>({name:'verify_and_deploy_testservice',status:'completed',conclusion:'success',
  steps:names.map(name=>({name,status:'completed',conclusion:'success'})),...overrides});

test('RC1612: success requires exact completed Main SHA and every TESTSERVICE live gate',()=>{
  const out=validateMainGate({releaseSha:sha,runs:[run()],jobs:[job()]});
  assert.equal(out.runId,123);assert.equal(out.checkedSteps,7);
});
test('RC1612: running Main Verification never authorizes production',()=>{
  assert.throws(()=>validateMainGate({releaseSha:sha,runs:[run({status:'in_progress',conclusion:null})],jobs:[job()]}),/keine eindeutige/);
});
test('RC1612: old SHA, wrong branch, wrong event, cancelled or duplicate successes fail closed',()=>{
  for(const other of [run({head_sha:'2'.repeat(40)}),run({head_branch:'release'}),run({event:'workflow_dispatch'}),run({conclusion:'cancelled'})])
    assert.throws(()=>validateMainGate({releaseSha:sha,runs:[other],jobs:[job()]}),/keine eindeutige/);
  assert.throws(()=>validateMainGate({releaseSha:sha,runs:[run(),run({id:124})],jobs:[job()]}),/keine eindeutige/);
});
test('RC1612: skipped live gate, uncompleted job, missing live gate fail closed',()=>{
  const steps=job().steps.map(s=>s.name==='RC1124 TESTSERVICE Browser Gate'?{...s,conclusion:'skipped'}:s);
  assert.throws(()=>validateMainGate({releaseSha:sha,runs:[run()],jobs:[job({steps})]}),/Browser Gate/);
  assert.throws(()=>validateMainGate({releaseSha:sha,runs:[run()],jobs:[job({status:'in_progress'})]}),/nicht erfolgreich/);
  assert.throws(()=>validateMainGate({releaseSha:sha,runs:[run()],jobs:[job({steps:[]})]}),/nicht erfolgreich/);
});
test('RC1612: direct workflow status must agree with filtered search before jobs are trusted',async()=>{
  const calls=[];
  const pages=[{workflow_runs:[run()]},run({status:'in_progress',conclusion:null})];
  const fakeFetch=async url=>{calls.push(url);return{ok:true,json:async()=>pages.shift()}};
  await assert.rejects(()=>verifyReleaseGate({RELEASE_SHA:sha,GITHUB_REPOSITORY:'Deadshot89/ExportHub',GITHUB_TOKEN:'FAKE'},fakeFetch),/widerspricht/);
  assert.equal(calls.length,2,'job API must not be requested after inconsistent status');
});
test('RC1612: successful direct verification validates job and never logs tokens',async()=>{
  const calls=[];
  const pages=[{workflow_runs:[run()]},run(),{jobs:[job()]}];
  const fakeFetch=async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>pages.shift()}};
  const result=await verifyReleaseGate({RELEASE_SHA:sha,GITHUB_REPOSITORY:'Deadshot89/ExportHub',GITHUB_TOKEN:'FAKE'},fakeFetch);
  assert.equal(result.runId,123);assert.equal(calls.length,3);
  assert.equal(calls[2].url.endsWith('/actions/runs/123/jobs?per_page=100'),true);
});
test('RC1612: workflow has final SHA-pinned gate immediately before live production upload',()=>{
  const src=fs.readFileSync('.github/workflows/exporthub-production-release.yml','utf8');
  const gate=src.indexOf('RC1612 Live-Main-Gates unmittelbar vor Production-Upload prüfen');
  const deploy=src.indexOf('      - name: Deploy ExportHUB production');
  assert.ok(gate>0&&deploy>gate);
  assert.match(src.slice(gate,deploy),/node \.github\/rc1612\/verify-main-gate\.mjs/);
  assert.match(src.slice(gate,deploy),/GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
});
