import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1233: Produktionsrelease prueft QR-Abholung und POD-Viewer explizit live',()=>{
  assert.match(workflow,/name: RC1233 QR-Abholung und POD-Ladelisten-Viewer live prüfen/);
  assert.match(workflow,/\/pickup\.html\?rc1233=/);
  assert.match(workflow,/assets\/rc1059-document-blob\.js\?rc1233=/);
  assert.match(workflow,/\/api\/pickup-health\?rc1233=/);
  assert.match(workflow,/\/api\/exporthub-document\?blob=/);
  assert.match(workflow,/\[ "\$dc" = "401" \]/);
  assert.match(workflow,/AUTH_REQUIRED\|SESSION_INVALID/);
});

test('RC1233: Live-Gate prueft die konkreten reparierten Marker',()=>{
  assert.match(workflow,/grep -Fq "fetch\('\/api\/'" "\$pickup"/);
  assert.match(workflow,/grep -Fq "request\('pickup-status\?token='" "\$pickup"/);
  assert.match(workflow,/grep -Fq "request\('pickup-confirm-v2'" "\$pickup"/);
  assert.match(workflow,/storage==='azure'\|\|storage==='pod'/);
  assert.match(workflow,/grep -Fq 'automatic' "\$viewer"/);
  assert.match(workflow,/grep -Fq '\/api\/exporthub-document\?blob=' "\$viewer"/);
});

test('RC1233: Live-Gate laeuft erst nach Produktionsdeploy und vor den restlichen Live-Smokes',()=>{
  const deploy=workflow.indexOf('- name: Deploy ExportHUB production');
  const gate=workflow.indexOf('- name: RC1233 QR-Abholung und POD-Ladelisten-Viewer live prüfen');
  const next=workflow.indexOf('- name: RC1228 Lieferavis-Slotlogik live prüfen');
  assert.ok(deploy>=0&&gate>deploy&&next>gate);
});

test('RC1233: Produktion und TESTSERVICE werden getrennt verifiziert',()=>{
  assert.match(workflow,/for env in production testservice; do/);
  assert.match(workflow,/if \[ "\$env" = "production" \]; then base="\$prod"; else base="\$testservice"; fi/);
  assert.match(workflow,/blob="rc995\/\$env\/\$key\/automatic\/POD_RC1233\.pdf"/);
  assert.match(workflow,/environment=\$env/);
});


test('RC1235: Live-Gate prüft keine Endpunkte, die pickup.html nicht direkt verwendet',()=>{
  assert.doesNotMatch(workflow,/grep -Fq '\/api\/pickup-pod' "\$pickup"/);
  assert.match(workflow,/request\('pickup-status\?token='/);
  assert.match(workflow,/request\('pickup-confirm-v2'/);
});
