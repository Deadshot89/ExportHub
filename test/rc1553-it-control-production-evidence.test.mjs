import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const health=require('../api/exporthub-health/index.js');
const workflow=fs.readFileSync(new URL('../.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml',import.meta.url),'utf8');

function withEnv(values,fn){
  const previous={};
  for(const [key,value] of Object.entries(values)){
    previous[key]=process.env[key];
    if(value==null)delete process.env[key];
    else process.env[key]=String(value);
  }
  return Promise.resolve().then(fn).finally(()=>{
    for(const [key,value] of Object.entries(previous)){
      if(value==null)delete process.env[key];
      else process.env[key]=value;
    }
  });
}

async function invoke(headers={}){
  const context={};
  await health(context,{method:'GET',headers});
  return {
    status:context.res.status,
    headers:context.res.headers||{},
    body:JSON.parse(context.res.body)
  };
}

test('RC1553: Health exposes verified deployment identity from runtime metadata',async()=>{
  await withEnv({
    EXPORTHUB_DEPLOY_BUILD_ID:'0123456789abcdef0123456789abcdef01234567',
    EXPORTHUB_DEPLOY_VISIBLE_RELEASE:'RC1553',
    EXPORTHUB_DEPLOY_TECHNICAL_BUILD:'RC1112',
    EXPORTHUB_DEPLOY_BUILT_AT:'2026-10-16T14:00:00.000Z',
    EXPORTHUB_DEPLOY_ENVIRONMENT:'testservice',
    EXPORTHUB_RELEASE_METADATA_PATH:path.join(os.tmpdir(),'does-not-exist-exporthub.json')
  },async()=>{
    const result=await invoke({'x-correlation-id':'corr-rc1553-123'});
    assert.equal(result.status,200);
    assert.equal(result.body.ok,true);
    assert.equal(result.body.deployment.verified,true);
    assert.equal(result.body.deployment.status,'verified');
    assert.equal(result.body.deployment.buildId,'0123456789abcdef0123456789abcdef01234567');
    assert.equal(result.body.deployment.visibleRelease,'RC1553');
    assert.equal(result.body.deployment.technicalBuild,'RC1112');
    assert.equal(result.body.deployment.environment,'testservice');
    assert.equal(result.body.deployment.source,'runtime-env');
    assert.equal(result.body.correlationId,'corr-rc1553-123');
    assert.equal(result.headers['X-Correlation-ID'],'corr-rc1553-123');
  });
});

test('RC1553: Missing deployment metadata fails closed instead of claiming a verified version',async()=>{
  await withEnv({
    EXPORTHUB_DEPLOY_BUILD_ID:null,
    EXPORTHUB_DEPLOY_VISIBLE_RELEASE:null,
    EXPORTHUB_DEPLOY_TECHNICAL_BUILD:null,
    EXPORTHUB_DEPLOY_BUILT_AT:null,
    EXPORTHUB_DEPLOY_ENVIRONMENT:null,
    EXPORTHUB_RELEASE_METADATA_PATH:path.join(os.tmpdir(),'missing-exporthub-release-metadata.json')
  },async()=>{
    const result=await invoke();
    assert.equal(result.status,200);
    assert.equal(result.body.deployment.verified,false);
    assert.equal(result.body.deployment.status,'unknown');
    assert.equal(result.body.deployment.buildId,null);
    assert.match(result.body.correlationId,/^[a-zA-Z0-9._:-]{8,128}$/);
  });
});

test('RC1553: unsafe incoming correlation IDs are not echoed',async()=>{
  await withEnv({EXPORTHUB_RELEASE_METADATA_PATH:path.join(os.tmpdir(),'missing-exporthub-release-metadata.json')},async()=>{
    const result=await invoke({'x-correlation-id':'Bearer secret-token with spaces'});
    assert.notEqual(result.body.correlationId,'Bearer secret-token with spaces');
    assert.match(result.body.correlationId,/^[a-zA-Z0-9._:-]{8,128}$/);
  });
});

test('RC1553: deploy workflow materializes checked-out release metadata before Azure deploys',()=>{
  assert.match(workflow,/RC1553 deployment metadata/i);
  assert.match(workflow,/git rev-parse HEAD/);
  assert.match(workflow,/api\/release-metadata\.json/);
  assert.match(workflow,/visibleRelease/);
  assert.match(workflow,/technicalBuild/);
  const metadataWrites=(workflow.match(/api\/release-metadata\.json/g)||[]).length;
  assert.ok(metadataWrites>=2,'TESTSERVICE und Produktion brauchen jeweils Deployment-Metadaten');
});

test('RC1553: legacy RC1060 health contract remains present for existing probes',()=>{
  const source=fs.readFileSync(new URL('../api/exporthub-health/index.js',import.meta.url),'utf8');
  assert.match(source,/version:\s*['"]RC1060['"]/);
  assert.match(source,/release:\s*['"]legacy-document-migration['"]/);
});
