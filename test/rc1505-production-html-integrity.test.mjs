import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const production=fs.readFileSync('.github/workflows/exporthub-production-release.yml','utf8');
const main=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1505/RC1122: HTML-Integrität wird nach Production-Deploy im manuellen Release geprüft',()=>{
  const deploy=production.indexOf('- name: Deploy ExportHUB production');
  const slot=production.indexOf('- name: RC1228 Lieferavis-Slotlogik live prüfen');
  const integrity=production.indexOf('- name: Live RC1122 HTML-Integrität prüfen');
  const browser=production.indexOf('- name: RC1124 Produktion Read-only Browser Smoke');
  assert.ok(deploy>=0&&slot>deploy&&integrity>slot&&browser>integrity,'RC1122 muss nach Production-/Fach-Live-Gates und vor Browser-Smoke liegen');
  const block=production.slice(integrity,browser);
  assert.match(block,/verify-final-html\.mjs/);
  assert.match(block,/environment=production-candidate/);
  assert.match(block,/environment=testservice/);
  assert.match(block,/environment=demo/);
  assert.match(block,/version:'RC1112'/);
  assert.doesNotMatch(main,/Live RC1122 HTML-Integrität prüfen/,'Main Verification darf keinen Production-HTML-Livecheck enthalten');
});
