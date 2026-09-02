'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('TESTVERSION.html', 'utf8');
const fnMatch = source.match(/function refreshVisuals\(\)\{[^\n]*\}/);
assert(fnMatch, 'refreshVisuals wurde nicht gefunden.');

function makeContext({ dirty = false, editing = false } = {}) {
  const calls = { summary: 0, schedule: 0, render: 0, qr: 0 };
  const active = editing ? {
    tagName: 'INPUT',
    closest(selector) { return selector === '#rc573ColliCard' ? {} : null; }
  } : null;
  const context = {
    rc710StowDirty: dirty,
    document: { activeElement: active },
    updateSummary() { calls.summary += 1; },
    scheduleStowRender(delay, force) {
      calls.schedule += 1;
      calls.scheduleArgs = [delay, force];
      return true;
    },
    renderStowPlan() { calls.render += 1; return true; },
    updateQr() { calls.qr += 1; }
  };
  const refreshVisuals = vm.runInNewContext('(' + fnMatch[0] + ')', context);
  return { refreshVisuals, calls };
}

{
  const { refreshVisuals, calls } = makeContext({ dirty: false, editing: false });
  refreshVisuals();
  assert.strictEqual(calls.summary, 1, 'Zusammenfassung muss weiter aktualisiert werden.');
  assert.strictEqual(calls.qr, 1, 'QR-Status muss weiter aktualisiert werden.');
  assert.strictEqual(calls.schedule, 0, 'Sauberer Stauplan darf keinen neuen Render terminieren.');
  assert.strictEqual(calls.render, 0, 'Unveränderter Stauplan darf nicht direkt neu gerendert werden.');
}

{
  const { refreshVisuals, calls } = makeContext({ dirty: true, editing: false });
  refreshVisuals();
  assert.strictEqual(calls.schedule, 1, 'Geänderter Stauplan muss genau einmal neu terminiert werden.');
  assert.deepStrictEqual(calls.scheduleArgs, [120, true], 'Dirty-Stauplan muss den bestehenden Idle-Renderpfad nutzen.');
  assert.strictEqual(calls.render, 0, 'Dirty-Stauplan darf nicht synchron im Same-View-Refresh gerendert werden.');
}

{
  const { refreshVisuals, calls } = makeContext({ dirty: true, editing: true });
  refreshVisuals();
  assert.strictEqual(calls.schedule, 0, 'Während Colli-Eingabe darf kein Stauplan-Render gestartet werden.');
  assert.strictEqual(calls.render, 0, 'Während Colli-Eingabe darf kein direkter Stauplan-Render laufen.');
}

const build = source.match(/var BUILD=Object\.freeze\(\{version:'RC(\d+)',cache:'(\d+)',loginReturn:'\/TESTVERSION\.html\?v=(\d+)'\}\);/);
assert(build, 'BUILD-Kennung fehlt.');
assert(Number(build[1]) >= 967, 'RC967 oder neuer wird benötigt.');
assert.strictEqual(build[2], build[1], 'BUILD cache muss zur RC-Version passen.');
assert.strictEqual(build[3], build[1], 'BUILD loginReturn muss zur RC-Version passen.');

console.log('RC967 shipment visual refresh performance regression: OK');
