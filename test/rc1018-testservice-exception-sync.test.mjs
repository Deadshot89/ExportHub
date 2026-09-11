import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const workflow='.github/workflows/exporthub-testservice.yml';

test('RC1045 TESTSERVICE-Ausnahmeweg nutzt denselben aktuellen Release auf der RC1044/RC1018-Buildkette',()=>{
  const flow=read(workflow),wrapper=read('.github/rc1045/build-three-env.mjs'),previous=read('.github/rc1044/build-three-env.mjs');
  assert.match(flow,/RC1045 TESTSERVICE-Ausnahmevertrag prüfen/);
  assert.match(flow,/test\/rc1018-mail-language-standard\.test\.mjs/);
  assert.match(flow,/test\/rc1018-production-deploy\.test\.mjs/);
  assert.match(flow,/node \.github\/rc1045\/build-three-env\.mjs/);
  assert.match(wrapper,/\.github\/rc1044\/build-three-env\.mjs/);
  assert.match(previous,/\.github\/rc1018\/build-three-env\.mjs/);
  assert.match(flow,/dist-rc1045\/TESTVERSION\.html/);
  assert.match(flow,/dist-rc1045\/demo\.html/);
  assert.match(flow,/\.rc1045_testservice_app/);
  assert.doesNotMatch(flow,/dist-rc1013\//);
  assert.doesNotMatch(flow,/\.rc1013_testservice_app/);
});

test('RC1045 TESTSERVICE-Ausnahmeweg bleibt nur nach ausdrücklicher Abweichungsfreigabe nutzbar',()=>{
  const flow=read(workflow);
  assert.match(flow,/workflow_dispatch/);
  assert.match(flow,/confirm_divergence/);
  assert.match(flow,/ICH ERLAUBE EINE ABWEICHENDE TESTSERVICE-VERSION/);
  assert.match(flow,/Abweichender Einzel-Deploy ist gesperrt/);
  assert.match(flow,/deployment_environment: testservice/);
});
