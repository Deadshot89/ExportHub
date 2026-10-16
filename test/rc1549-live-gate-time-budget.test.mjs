import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config=fs.readFileSync('playwright.config.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1549: serielles Live-TESTSERVICE-Gate hat mindestens 20 Minuten Gesamtbudget',()=>{
  assert.match(config,/workers\s*:\s*1/,'Live-Matrix bleibt absichtlich seriell');
  assert.match(config,/globalTimeout\s*:\s*LIVE\s*\?\s*20\s*\*\s*60\s*\*\s*1000\s*:\s*10\s*\*\s*60\s*\*\s*1000/,'15 Minuten reichen für die gewachsene Live-Matrix nicht mehr aus');
  const start=workflow.indexOf('- name: RC1124 TESTSERVICE Browser Gate');
  const end=workflow.indexOf('- name: RC1124 TESTSERVICE Browser-Artefakte',start);
  assert.ok(start>=0&&end>start,'TESTSERVICE Browser Gate fehlt');
  const gate=workflow.slice(start,end);
  for(const spec of ['navigation.spec.mjs','notifications.spec.mjs','public-smoke.spec.mjs','shipment-create.spec.mjs','multi-truck-live.spec.mjs','testservice-mutation.spec.mjs','version-display.spec.mjs']){
    assert.ok(gate.includes(spec),spec+' muss im Live-Gate bleiben');
  }
});
