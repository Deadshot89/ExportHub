import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const fixture=fs.readFileSync('api/e2e-test-fixture/index.js','utf8');
const spec=fs.readFileSync('e2e/specs/shipment-create.spec.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1171: Fixture erzeugt dedizierten Kunden und Standort mit Run-Cleanup-Marker',()=>{
  assert.match(fixture,/function e2eCustomer\(runId\)/);
  assert.match(fixture,/E2E TEST CUSTOMER/);
  assert.match(fixture,/E2E Test Standort/);
  assert.match(fixture,/_e2eRunId:runId/);
  assert.match(fixture,/team\.state\.customers\.push\(customer\)/);
  assert.match(fixture,/customer:\{id:customer\.id,account:customer\.account,name:customer\.name,locationId:customer\.locations\[0\]\.id/);
});

test('RC1171: Live-Test bedient Kunde Standort Referenz Colli Gewicht und echten Speichern-Button',()=>{
  for(const marker of [
    "#shipmentCustomerSearch",
    "#index289LocationSelect",
    "#rc363SaveShipment",
    "[data-rc363-field=\"count\"] input",
    "[data-rc363-field=\"ldm\"] input",
    "[data-rc363-field=\"l\"] input",
    "[data-rc363-field=\"w\"] input",
    "[data-rc363-field=\"h\"] input",
    "#rc363WeightTarget",
    "Gewicht gleich aufteilen",
    "exporthub:shipment-saved"
  ])assert.ok(spec.includes(marker),marker+' fehlt im UI-Live-Test');
  assert.match(spec,/packaging-option.*Europalette/s);
});

test('RC1175: automatisch erzeugte Referenz bleibt readonly und erfüllt den 6-Zeichen-Vertrag',()=>{
  assert.match(spec,/toHaveAttribute\('readonly',''\)/);
  assert.match(spec,/toHaveAttribute\('aria-readonly','true'\)/);
  assert.match(spec,/Automatisch erzeugte Sendungsreferenz/);
  assert.match(spec,/\^\[A-Z0-9\]\{6\}\$/);
  assert.doesNotMatch(spec,/refInput\.fill\(/);
});

test('RC1171: Erfolg wird erst nach echtem shipment-saved und Server-Reload akzeptiert',()=>{
  assert.match(spec,/__RC1171_SAVED_EVENTS__/);
  assert.match(spec,/settleStateSave\(page,\{timeout:30_000\}\)/);
  assert.match(spec,/page\.reload\(\{waitUntil:'domcontentloaded'\}\)/);
  assert.match(spec,/\/api\/exporthub-state\?mode=read&full=1/);
  assert.match(spec,/persisted\.found\?\.ref/);
  assert.match(spec,/openExportHubView\(page,'shipmentoverview'/);
});

test('RC1171: Testdaten werden ausschließlich per _e2eRunId markiert und Fixture-Cleanup entfernt sie',()=>{
  assert.match(spec,/s\.shipment\._e2eRunId=runId/);
  assert.match(fixture,/removeRunRecords\(team\.state,runId\)/);
  assert.doesNotMatch(spec,/customerName:'E2E TEST CUSTOMER'/);
  assert.doesNotMatch(spec,/state:\{shipments,savedShipments\}/);
});

test('RC1171: TESTSERVICE-Release-Gate führt den UI-Test tatsächlich aus',()=>{
  const start=workflow.indexOf('- name: RC1124 TESTSERVICE Browser Gate');
  const end=workflow.indexOf('- name: Deploy ExportHUB production',start);
  assert.ok(start>=0&&end>start);
  const gate=workflow.slice(start,end);
  assert.match(gate,/e2e\/specs\/shipment-create\.spec\.mjs/);
  assert.match(gate,/EXPORTHUB_E2E_MUTATION='1'/);
  assert.match(gate,/EXPORTHUB_E2E_REFERENCE=/);
});

test('RC1171: geänderte E2E-Dateien sind syntaktisch gültig und manifestiert',()=>{
  execFileSync(process.execPath,['--check','api/e2e-test-fixture/index.js'],{stdio:'pipe'});
  execFileSync(process.execPath,['--check','e2e/specs/shipment-create.spec.mjs'],{stdio:'pipe'});
  assert.match(build,/shipmentCreateUiE2E:'RC1171 UI customer \+ location \+ reference \+ colli \+ save \+ reload \+ overview'/);
});
