import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const workflow='.github/workflows/exporthub-testservice.yml';

test('RC1046 TESTSERVICE-Ausnahmeweg nutzt denselben aktuellen Release auf der RC1046/RC1044/RC1018-Buildkette',()=>{
  const flow=read(workflow),wrapper=read('.github/rc1046/build-three-env.mjs'),previous=read('.github/rc1046/build-three-env.mjs'),base=read('.github/rc1044/build-three-env.mjs');
  assert.match(flow,/RC1046 TESTSERVICE-Ausnahmevertrag prüfen/);
  assert.match(flow,/test\/rc1018-mail-language-standard\.test\.mjs/);
  assert.match(flow,/test\/rc1018-production-deploy\.test\.mjs/);
  assert.match(flow,/node \.github\/rc1046\/build-three-env\.mjs/);
  assert.match(wrapper,/\.github\/rc1045\/build-three-env\.mjs/);
  assert.match(previous,/\.github\/rc1044\/build-three-env\.mjs/);
  assert.match(base,/\.github\/rc1018\/build-three-env\.mjs/);
  assert.match(flow,/dist-rc1046\/TESTVERSION\.html/);
  assert.match(flow,/dist-rc1046\/demo\.html/);
  assert.match(flow,/\.rc1046_testservice_app/);
  assert.doesNotMatch(flow,/dist-rc1013\//);
  assert.doesNotMatch(flow,/\.rc1013_testservice_app/);
});

test('RC1046 TESTSERVICE-Ausnahmeweg bleibt nur nach ausdrücklicher Abweichungsfreigabe nutzbar',()=>{
  const flow=read(workflow);
  assert.match(flow,/workflow_dispatch/);
  assert.match(flow,/confirm_divergence/);
  assert.match(flow,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(flow,/Abweichender Einzel-Deploy ist gesperrt/);
  assert.match(flow,/deployment_environment: testservice/);
});
