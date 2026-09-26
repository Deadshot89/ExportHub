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


test('RC1279: bekannte Mail.Send-Berechtigungslücke blockiert weder TESTSERVICE noch Produktion',()=>{
  for(const [name,env] of [
    ['RC1249 TESTSERVICE AVIS-Mail-Konfiguration prüfen','testservice'],
    ['RC1249 PRODUCTION AVIS-Mail-Konfiguration prüfen','production']
  ]){
    const start=workflow.indexOf('- name: '+name);
    const end=workflow.indexOf('\n      - name:',start+10);
    assert.ok(start>=0&&end>start,name+' fehlt');
    const block=workflow.slice(start,end);
    assert.match(block,new RegExp("ENVIRONMENT='"+env+"'"));
    assert.match(block,/status===503/);
    assert.match(block,/GRAPH_MAIL_PERMISSION_MISSING/);
    assert.match(block,/recipientConfigured===true/);
    assert.match(block,/knownMailSendBlocker/);
    assert.match(block,/::warning title=RC1290 AVIS-Mail P2::/);
    assert.match(block,/Microsoft Graph > Application > Mail\.Send/);
    assert.match(block,/b633e1c5-b582-4048-a93e-9f11b44c7e96/);
    assert.match(block,/Admin Consent erforderlich/);
    assert.match(block,/Release läuft weiter, Mailversand bleibt offen/);
    assert.doesNotMatch(block,/if \[ "\$status" != "200" \]; then cat "\$response"; exit 1; fi/);
  }
});

test('RC1279: unerwartete AVIS-Mail-Readiness bleibt ein harter Releasefehler',()=>{
  const markers=[
    "const ready=status===200",
    "v.configured===true",
    "v.authenticated===true",
    "v.audienceOk===true",
    "v.mailSendGranted===true",
    "console.error('RC1249 '+env+' readiness unerwartet'",
    "process.exit(1);"
  ];
  for(const marker of markers)assert.ok(workflow.includes(marker),'Fehlender RC1279 Fail-closed-Marker: '+marker);
});
