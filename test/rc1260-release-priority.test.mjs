import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainWorkflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
const productionWorkflow=fs.readFileSync('.github/workflows/exporthub-production-release.yml','utf8');

test('RC1260: harter TESTSERVICE-Gate behält alle Browser-Specs und schließt nur RC1255 P2 aus',()=>{
  const start=mainWorkflow.indexOf('- name: RC1124 TESTSERVICE Browser Gate');
  const end=mainWorkflow.indexOf('- name: RC1124 TESTSERVICE Browser-Artefakte');
  assert.ok(start>=0&&end>start);
  const block=mainWorkflow.slice(start,end);
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

test('RC1260/RC1346: RC1255-Outlook-Test bleibt hart und automatische Upload-Mail wird separat diagnostiziert',()=>{
  assert.match(mainWorkflow,/npx playwright test e2e\/specs\/testservice-mutation\.spec\.mjs --project=laptop --grep 'RC1255 P2:'/);
  assert.doesNotMatch(mainWorkflow,/rc1255_mail_status=\$\?/);
  assert.doesNotMatch(mainWorkflow,/set \+e[\s\S]{0,500}RC1255 P2:/);
  assert.doesNotMatch(mainWorkflow,/::warning title=RC1255 AVIS-Mail P2::/);
  assert.match(mainWorkflow,/RC1249 TESTSERVICE AVIS-Mail-Konfiguration prüfen/);
  assert.match(mainWorkflow,/GRAPH_MAIL_PERMISSION_MISSING/);
  assert.match(mainWorkflow,/::warning title=RC1290 AVIS-Mail P2::/);
  assert.match(mainWorkflow,/Microsoft Graph > Application > Mail\.Send/);
  assert.match(mainWorkflow,/Admin Consent erforderlich/);
  assert.doesNotMatch(mainWorkflow,/zuletzt Microsoft Graph HTTP 401/);
  assert.doesNotMatch(mainWorkflow,/P0-MFA-Rollout/);
});

test('RC1505/RC1260: Production bleibt hinter erfolgreicher harter TESTSERVICE-Verifikation',()=>{
  assert.match(mainWorkflow,/RC1124 TESTSERVICE Browser Gate/);
  assert.doesNotMatch(mainWorkflow,/Deploy ExportHUB production/);
  const verify=productionWorkflow.indexOf('- name: RC1505 Erfolgreiche Main Verification für Release-SHA verlangen');
  const prod=productionWorkflow.indexOf('- name: Deploy ExportHUB production');
  assert.ok(verify>=0&&prod>verify,'Production muss hinter dem SHA-festen erfolgreichen Main-Verification-Nachweis liegen');
  assert.match(productionWorkflow.slice(verify,prod),/head_sha/);
  assert.match(productionWorkflow.slice(verify,prod),/conclusion==='success'/);
});

test('RC1279: bekannte Mail.Send-Berechtigungslücke blockiert weder TESTSERVICE noch Produktion',()=>{
  for(const [workflow,name,env] of [
    [mainWorkflow,'RC1249 TESTSERVICE AVIS-Mail-Konfiguration prüfen','testservice'],
    [productionWorkflow,'RC1249 PRODUCTION AVIS-Mail-Konfiguration prüfen','production']
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

test('RC1279: optionale Upload-Mail-Readiness meldet Fehler sichtbar in beiden Umgebungen',()=>{
  const markers=[
    "const ready=status===200",
    "v.configured===true",
    "v.authenticated===true",
    "v.audienceOk===true",
    "v.mailSendGranted===true",
    "console.error('RC1249 '+env+' automatische Upload-Mail weiterhin nicht verfügbar'",
    "process.exit(1);"
  ];
  for(const [name,workflow] of [['TESTSERVICE',mainWorkflow],['PRODUCTION',productionWorkflow]]){
    for(const marker of markers)assert.ok(workflow.includes(marker),`${name}: Fehlender RC1279 Fail-closed-Marker: ${marker}`);
  }
});
