'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('TESTVERSION.html', 'utf8');

function oneLineFunction(name) {
  const re = new RegExp('^function ' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\([^\\n]*\\)\\{[^\\n]*\\}$', 'm');
  const match = source.match(re);
  assert(match, name + ' fehlt oder ist nicht als eigenständige testbare Funktion vorhanden.');
  return vm.runInNewContext('(' + match[0] + ')', Object.create(null));
}

assert(/var BUILD=Object\.freeze\(\{version:'RC964',cache:'964',loginReturn:'\/TESTVERSION\.html\?v=964'\}\);/.test(source), 'RC964 Build-Kennung fehlt.');
assert(source.includes('/* exporthub-rc964-render-metrics */'), 'RC964 Render-Metriken fehlen.');
assert(source.includes('window.__EXPORTHUB_RC964_RENDER_METRICS__'), 'Globale RC964 Messwert-Schnittstelle fehlt.');

const createMetrics = oneLineFunction('rc964CreateRenderMetrics');
const metrics = createMetrics();

for (let i = 0; i < 10; i += 1) metrics.request('dashboard');
metrics.run('dashboard', 24);
let dash = metrics.snapshot('dashboard');
assert.strictEqual(dash.view, 'dashboard');
assert.strictEqual(dash.requests, 10, 'Dashboard muss 10 Render-Anforderungen zählen.');
assert.strictEqual(dash.runs, 1, 'Dashboard darf zunächst nur einen echten Render zählen.');
assert.strictEqual(dash.coalesced, 9, 'Dashboard muss 9 gebündelte Aufrufe ausweisen.');
assert.strictEqual(dash.coalesceRatePct, 90, 'Bündelungsquote muss 90 % betragen.');
assert.strictEqual(dash.totalRenderMs, 24);
assert.strictEqual(dash.avgRenderMs, 24);
assert.strictEqual(dash.maxRenderMs, 24);

metrics.run('dashboard', 40);
dash = metrics.snapshot('dashboard');
assert.strictEqual(dash.runs, 2);
assert.strictEqual(dash.coalesced, 8);
assert.strictEqual(dash.avgRenderMs, 32);
assert.strictEqual(dash.maxRenderMs, 40);

metrics.request('shipment');
metrics.run('shipment', 15.4);
const shipment = metrics.snapshot('shipment');
assert.strictEqual(shipment.requests, 1, 'Ansichten müssen getrennt gezählt werden.');
assert.strictEqual(shipment.runs, 1);
assert.strictEqual(shipment.coalesced, 0);
assert.strictEqual(shipment.avgRenderMs, 15.4);

const all = metrics.snapshotAll();
assert.strictEqual(all.dashboard.requests, 10, 'snapshotAll muss Dashboard enthalten.');
assert.strictEqual(all.shipment.runs, 1, 'snapshotAll muss Sendung enthalten.');

assert(/function stableRender\(\)\{[^\n]*rc964RenderMetrics\.request\(v\)[^\n]*rc964RunMeasured\(context,args,v\)[^\n]*rc963RenderCoordinator\.request[^\n]*rc964RunMeasured\(context,args,v\)/s.test(source), 'stableRender erfasst RC964-Metriken nicht in beiden Render-Pfaden.');
assert(/function download\(\)\{[^\n]*renderMetrics:window\.__EXPORTHUB_RC964_RENDER_METRICS__/s.test(source), 'Fehlerdiagnose-Export enthält renderMetrics nicht.');

console.log('RC964 render metrics regression: OK');
