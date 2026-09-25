import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1260: harter TESTSERVICE-Gate behält alle Browser-Specs und schließt nur RC1255 P2 aus',()=>{
  const start=workflow.indexOf('- name: RC1124 TESTSERVICE Browser Gate');
  const end=workflow.indexOf('- name: RC1124 TESTSERVICE Browser-Artefakte');
  assert.ok(start>=0&&end>start);
  const block=workflow.slice(start,end);
  for(const spec of [
    'e2e/specs/navigation.spec.mjs',
    'e2e/specs/notifications.spec.mjs',
    'e2e/specs/public-smoke.spec.mjs',
    'e2e/specs/shipment-create.spec.mjs',
    'e2e/specs/testservice-mutation.spec.mjs',
    'e2e/specs/version-display.spec.mjs'
  ]) assert.ok(block.includes(spec),'Fehlende Browser-Spec: '+spec);
  assert.match(block,/--grep-invert 'RC1255 P2:'/);
});

test('RC1260/RC1272: echter RC1255-Mailtest bleibt sichtbar und benennt den aktuellen Mail.Send-Blocker',()=>{
  assert.match(workflow,/npx playwright test e2e\/specs\/testservice-mutation\.spec\.mjs --project=laptop --grep 'RC1255 P2:'/);
  assert.match(workflow,/rc1255_mail_status=\$\?/);
  assert.match(workflow,/::warning title=RC1255 AVIS-Mail P2::/);
  assert.match(workflow,/Application Permission Mail\.Send fehlt/);
  assert.match(workflow,/Admin-Consent/);
  assert.match(workflow,/RC1255 bleibt offen/);
  assert.doesNotMatch(workflow,/zuletzt Microsoft Graph HTTP 401/);
  assert.doesNotMatch(workflow,/P0-MFA-Rollout/);
});

test('RC1260: Produktionsdeploy bleibt hinter dem harten TESTSERVICE-Gate',()=>{
  const hard=workflow.indexOf('- name: RC1124 TESTSERVICE Browser Gate');
  const prod=workflow.indexOf('- name: Deploy ExportHUB production');
  assert.ok(hard>=0&&prod>hard);
});
