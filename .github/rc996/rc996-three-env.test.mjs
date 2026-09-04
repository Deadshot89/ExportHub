import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);

const BUILD = '.github/rc996/build-three-env.mjs';
const HUB = 'assets/exporthub-environment-hub.js';
const DEMO = 'assets/exporthub-demo-bootstrap.js';
const PROD_APPLY = '.github/rc996/apply-production.mjs';
const WORKFLOW = '.github/workflows/rc996-three-env.yml';

test('RC996 besitzt einen reproduzierbaren Drei-Umgebungen-Build', () => {
  assert.equal(exists(BUILD), true, `${BUILD} fehlt`);
  const src = read(BUILD);
  assert.match(src, /dist-rc996/);
  assert.match(src, /TESTVERSION\.html/);
  assert.match(src, /demo\.html/);
  assert.match(src, /exporthub-environment-hub\.js/);
  assert.match(src, /exporthub-demo-bootstrap\.js/);
});

test('gemeinsamer Umgebungs-Hub kennt exakt Produktion, TESTSERVICE und Demo', () => {
  assert.equal(exists(HUB), true, `${HUB} fehlt`);
  const src = read(HUB);
  assert.match(src, /production/);
  assert.match(src, /testservice/);
  assert.match(src, /demo/);
  assert.match(src, /ExportHUB App/);
  assert.match(src, /touch-action\s*:\s*manipulation/);
  assert.match(src, /ExportHUBAndroid/);
});

test('Demo isoliert Speicher und blockiert echte ExportHUB API-Aufrufe', () => {
  assert.equal(exists(DEMO), true, `${DEMO} fehlt`);
  const src = read(DEMO);
  assert.match(src, /__EXPORTHUB_DEMO_MODE__/);
  assert.match(src, /demo:/);
  assert.match(src, /\/api\//);
  assert.match(src, /Fake/);
  assert.match(src, /Kunde/);
  assert.match(src, /Sendung/);
  assert.match(src, /Aufgabe/);
  assert.match(src, /Warnung/);
});

test('RC996 Workflow baut und deployt TESTSERVICE plus Demo isoliert', () => {
  const src = read(WORKFLOW);
  assert.match(src, /build-three-env\.mjs/);
  assert.match(src, /dist-rc996\/demo\.html/);
  assert.match(src, /assets\/exporthub-environment-hub\.js/);
  assert.match(src, /deployment_environment:\s*testservice/);
  assert.match(src, /github\.ref == 'refs\/heads\/main'/);
});

test('Produktionsanwendung bleibt ein separater Release-Center-Schritt', () => {
  assert.equal(exists(PROD_APPLY), true, `${PROD_APPLY} fehlt`);
  const src = read(PROD_APPLY);
  assert.match(src, /index\.html/);
  assert.match(src, /exporthub-environment-hub\.js/);
  assert.match(src, /RC996/);

  const marker = read('production-version.js');
  assert.match(marker, /RC990/);
  assert.doesNotMatch(marker, /RC996/);
});
