'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('TESTVERSION.html', 'utf8');

function extractFunction(name) {
  const token = 'function ' + name + '(';
  const start = source.lastIndexOf(token);
  assert(start >= 0, name + ' wurde nicht gefunden.');
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', esc = false, line = false, block = false;
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i], n = source[i + 1];
    if (line) { if (c === '\n') line = false; continue; }
    if (block) { if (c === '*' && n === '/') { block = false; i += 1; } continue; }
    if (quote) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { line = true; i += 1; continue; }
    if (c === '/' && n === '*') { block = true; i += 1; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    else if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('Ende von ' + name + ' nicht gefunden.');
}

const updateSummarySource = extractFunction('updateSummary');

function textNode(initial) {
  let value = String(initial);
  let writes = 0;
  return {
    get textContent() { return value; },
    set textContent(v) { writes += 1; value = String(v); },
    get writes() { return writes; }
  };
}

function createHarness({ fallback = false, rowCount = 0 } = {}) {
  const labels = {
    count: textNode('Collis'),
    weight: textNode('Gewicht'),
    ldm: textNode('Lademeter')
  };
  const values = {
    count: textNode('4'),
    weight: textNode('12,5 kg'),
    ldm: textNode('0,80')
  };
  for (const key of Object.keys(values)) values[key].previousElementSibling = labels[key];

  const lineValue = textNode(String(rowCount));
  const lineBox = {};
  const summary = {
    querySelector(selector) {
      if (selector === '[data-rc901-summary="lines"]') return lineBox;
      return null;
    },
    appendChild() { throw new Error('Bestehende Zeilen-Summary darf nicht neu erzeugt werden.'); }
  };

  const fallbackBoxes = [
    { textContent: 'Collis 4', querySelector(sel) { return sel === 'b,strong' ? values.count : sel === 'span' ? labels.count : null; } },
    { textContent: 'Gewicht 12,5 kg', querySelector(sel) { return sel === 'b,strong' ? values.weight : sel === 'span' ? labels.weight : null; } },
    { textContent: 'Lademeter 0,80', querySelector(sel) { return sel === 'b,strong' ? values.ldm : sel === 'span' ? labels.ldm : null; } }
  ];

  const card = {
    querySelector(selector) { return selector === '.rc344-summary' ? summary : null; },
    querySelectorAll() { return fallbackBoxes; }
  };

  const rows = Array.from({ length: rowCount }, (_, i) => ({ type: 'Box', count: i + 1, weight: 1, ldm: 0, l: 1, w: 1, h: 1 }));
  let dirtyCalls = 0;
  const document = {
    getElementById(id) {
      if (id === 'rc573ColliCard') return card;
      if (id === 'rc901Sum_lines') return lineValue;
      if (!fallback && id.startsWith('rc344Sum_')) return values[id.slice('rc344Sum_'.length)] || null;
      return null;
    },
    createElement() { throw new Error('Bestehende Summary darf kein neues Element benötigen.'); }
  };

  const context = {
    document,
    rc902LastStowRowsSig: rows.map(r => [r.type, r.count, r.weight, r.ldm, r.l, r.w, r.h].join(':')).join('|'),
    totals() { return { count: 4, weight: 12.5, ldm: 0.8 }; },
    shipment() { return { rows }; },
    arr(v) { return Array.isArray(v) ? v : []; },
    low(v) { return String(v || '').toLowerCase(); },
    q(v) { return String(v == null ? '' : v).trim(); },
    num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; },
    markStowDirty() { dirtyCalls += 1; }
  };
  const updateSummary = vm.runInNewContext('(' + updateSummarySource + ')', context);
  return { updateSummary, labels, values, lineValue, get dirtyCalls() { return dirtyCalls; } };
}

{
  const h = createHarness({ fallback: false, rowCount: 0 });
  h.updateSummary();
  const writes = Object.values(h.values).reduce((n, x) => n + x.writes, 0)
    + Object.values(h.labels).reduce((n, x) => n + x.writes, 0)
    + h.lineValue.writes;
  assert.strictEqual(writes, 0, 'Unveränderte Standard-Summary darf keinen Text-DOM-Write auslösen.');
}

{
  const h = createHarness({ fallback: true, rowCount: 0 });
  h.updateSummary();
  const writes = Object.values(h.values).reduce((n, x) => n + x.writes, 0)
    + Object.values(h.labels).reduce((n, x) => n + x.writes, 0)
    + h.lineValue.writes;
  assert.strictEqual(writes, 0, 'Unveränderte Fallback-Summary darf keinen Text-DOM-Write auslösen.');
}

const build = source.match(/var BUILD=Object\.freeze\(\{version:'RC(\d+)',cache:'(\d+)',loginReturn:'\/TESTVERSION\.html\?v=(\d+)'\}\);/);
assert(build, 'BUILD-Kennung fehlt.');
assert(Number(build[1]) >= 968, 'RC968 oder neuer wird benötigt.');
assert.strictEqual(build[2], build[1], 'BUILD cache muss zur RC-Version passen.');
assert.strictEqual(build[3], build[1], 'BUILD loginReturn muss zur RC-Version passen.');

console.log('RC968 shipment summary DOM performance regression: OK');
