'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const file = 'TESTVERSION.html';
const source = fs.readFileSync(file, 'utf8');

function oneLineFunction(name) {
  const re = new RegExp('^function ' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\([^\\n]*\\)\\{[^\\n]*\\}$', 'm');
  const match = source.match(re);
  assert(match, name + ' fehlt oder ist nicht als eigenständige testbare Funktion vorhanden.');
  return vm.runInNewContext('(' + match[0] + ')', Object.create(null));
}

const buildMatch = source.match(/var BUILD=Object\.freeze\(\{version:'RC(\d+)',cache:'(\d+)',loginReturn:'\/TESTVERSION\.html\?v=(\d+)'\}\);/);
assert(buildMatch, 'Build-Kennung fehlt.');
assert(Number(buildMatch[1]) >= 963, 'RC963 oder höher wird erwartet.');
assert.strictEqual(buildMatch[1], buildMatch[2], 'Build-Version und Cache-Version müssen identisch sein.');
assert.strictEqual(buildMatch[1], buildMatch[3], 'Build-Version und Login-Return-Version müssen identisch sein.');
assert(source.includes('/* exporthub-rc963-render-coordinator */'), 'RC963 Render-Koordinator fehlt.');
assert(source.includes('function performStableRender(){'), 'Der bestehende Renderer wurde nicht sauber in performStableRender überführt.');
assert(source.includes('function stableRender(){'), 'Der öffentliche stableRender-Einstieg fehlt.');

const createCoordinator = oneLineFunction('rc963CreateFrameCoordinator');
const needsImmediate = oneLineFunction('rc963NeedsImmediateRender');

// 10 Anforderungen innerhalb eines Frames müssen genau einen echten Render auslösen.
const queued = [];
const cancelled = [];
const coordinator = createCoordinator(
  cb => { queued.push(cb); return queued.length; },
  id => { cancelled.push(id); }
);
const executed = [];
for (let i = 0; i < 10; i += 1) coordinator.request(() => executed.push(i));
assert.strictEqual(queued.length, 1, '10 Render-Anforderungen dürfen nur einen Browser-Frame einplanen.');
assert.deepStrictEqual(executed, [], 'Vor dem Browser-Frame darf der gebündelte Render nicht vorzeitig laufen.');
queued[0]();
assert.deepStrictEqual(executed, [9], 'Im Browser-Frame muss nur der letzte gebündelte Render ausgeführt werden.');
const stats = coordinator.stats();
assert.strictEqual(stats.requests, 10, 'Koordinator muss 10 Anforderungen zählen.');
assert.strictEqual(stats.runs, 1, 'Koordinator darf nur einen echten Render ausführen.');
assert.strictEqual(stats.coalesced, 9, 'Koordinator muss 9 doppelte Anforderungen bündeln.');
assert.strictEqual(stats.scheduled, false, 'Nach dem Frame darf kein Render mehr ausstehen.');

// Ein echter View-Wechsel darf nicht verzögert werden.
assert.strictEqual(needsImmediate('dashboard', 'shipment', false, false), true, 'View-Wechsel muss sofort vollständig rendern.');
assert.strictEqual(needsImmediate('dashboard', 'dashboard', false, false), true, 'Fehlender DOM einer gleichen Ansicht muss sofort neu aufgebaut werden.');
assert.strictEqual(needsImmediate('shipment', 'shipment', true, true), true, 'Aktiver Navigationswechsel muss sofort rendern.');

// Eine bereits montierte Ansicht darf in den gebündelten Patch-Pfad gehen.
assert.strictEqual(needsImmediate('shipment', 'shipment', true, false), false, 'Gleiche montierte Sendung muss im Patch-/Frame-Pfad bleiben.');
assert.strictEqual(needsImmediate('shipmentoverview', 'shipmentoverview', true, false), false, 'Gleiche montierte Sendungsübersicht muss im Patch-/Frame-Pfad bleiben.');
assert.strictEqual(needsImmediate('dashboard', 'dashboard', true, false), false, 'Gleiches montiertes Dashboard muss im Patch-/Frame-Pfad bleiben.');

// Der Wrapper muss echte Wechsel weiterhin synchron behandeln und gleiche Ansichten bündeln.
assert(/function stableRender\(\)\{[^\n]*rc963NeedsImmediateRender\(lastView,v,domMatches,navigationTransition\)[^\n]*rc963RenderCoordinator\.cancel\(\)[^\n]*rc963RenderCoordinator\.request/s.test(source), 'stableRender nutzt den RC963-Koordinator nicht mehr wie vorgesehen.');

console.log('RC963 render performance regression: OK');
