import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const PROD_CONFIG='staticwebapp.config.json';
const PROD_WORKFLOW='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';

test('RC997 Produktion: Pickup und Kunden-Avis bleiben eigene externe Sicherheitsrouten',()=>{
  const cfg=read(PROD_CONFIG);
  assert.match(cfg,/"route"\s*:\s*"\/pickup"[\s\S]*?"rewrite"\s*:\s*"\/pickup\.html"/);
  assert.match(cfg,/"route"\s*:\s*"\/customer-avis"[\s\S]*?"rewrite"\s*:\s*"\/customer-avis\.html"/);
  assert.match(cfg,/"Cache-Control"\s*:\s*"no-store"/);
  assert.match(cfg,/"Referrer-Policy"\s*:\s*"no-referrer"/);
  assert.match(cfg,/"navigationFallback"[\s\S]*?"\/pickup"[\s\S]*?"\/customer-avis"/);
});

test('RC997 Produktion: Release-Center erzeugt den geprüften RC997-Kandidaten vor dem Deploy',()=>{
  const wf=read(PROD_WORKFLOW);
  assert.match(wf,/node \.github\/rc997\/build-three-env\.mjs/);
  assert.match(wf,/\.rc997_production_app/);
  assert.match(wf,/dist-rc997\/index\.html/);
  assert.match(wf,/ExportHUB RC997 environment=production-candidate/);
  assert.match(wf,/production-version\.js/);
  assert.match(wf,/marker_version.*index_version/s);
});

test('RC997 Produktion: Release-Artefakt enthält externe Seiten und deployt nicht den Repo-Root blind',()=>{
  const wf=read(PROD_WORKFLOW);
  for(const name of ['pickup.html','customer-avis.html','location.html','pod-notfall.html']) assert.match(wf,new RegExp(name.replace('.','\\.')));
  assert.match(wf,/app_location:\s*\.rc997_production_app/);
  assert.doesNotMatch(wf,/app_location:\s*\/$/m);
});

test('RC997 Produktion: Live-Gate prüft RC997 Hauptseite sowie Pickup und Kunden-Avis',()=>{
  const wf=read(PROD_WORKFLOW);
  assert.match(wf,/ExportHUB RC997 environment=production-candidate/);
  assert.match(wf,/pickup\.html/);
  assert.match(wf,/customer-avis\.html/);
  assert.match(wf,/exporthub-health/);
  assert.match(wf,/exporthub-state/);
});
