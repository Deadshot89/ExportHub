import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// 31.10.2026: the RC1740 POD list looked up every overview card with a scan over all shipments (≈800 ms per pass
// at 1500 shipments). patchOverview now builds one lookup index per pass; copies() must return the same shipments
// in the same order as the full scan.

const source = fs.readFileSync(new URL('../assets/rc1740-pod-remove.js', import.meta.url), 'utf8');
const fn = (name) => {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' fehlt');
  let depth = 0, i = source.indexOf('{', start);
  for (; i < source.length; i++) { if (source[i] === '{') depth++; else if (source[i] === '}' && --depth === 0) break; }
  return source.slice(start, i + 1);
};

test('POD entfernen: patchOverview nutzt pro Durchlauf einen Index und räumt ihn wieder ab', () => {
  const patch = fn('patchOverview');
  assert.match(patch, /passIndex=buildIndex\(\)/);
  assert.match(patch, /finally\{passIndex=null\}/);
  assert.match(fn('copies'), /if\(passIndex\)return indexedCopies\(key,passIndex\)/);
});

test('POD entfernen: Index liefert dieselben Kopien in derselben Reihenfolge wie die volle Suche', () => {
  const st = { shipments: [], savedShipments: [] };
  const ctx = vm.createContext({ Map, state: () => st });
  const body = ['q', 'arr', 'sid', 'sref', 'sameShipment', 'buildIndex', 'indexedCopies', 'copies'].map(fn).join('\n');
  vm.runInContext('var passIndex=null;' + body + ';this.full=function(k){passIndex=null;return Array.from(copies(k))};this.indexed=function(k){passIndex=buildIndex();try{return Array.from(copies(k))}finally{passIndex=null}}', ctx);

  const a = { id: 'SH-1', ref: 'ABC123' }, b = { id: 'SH-9', ref: 'abc123' }, c = { id: 'SH-1' }, d = { id: 'SH-3', ref: 'XYZ' };
  const e = { id: 'SH-1', ref: 'OTHER' }, f = { savedShipmentId: 'SH-5' }, g = { reference: ' xyz ' }, h = { id: 'XYZ' };
  st.shipments.push(a, d, c, h, f);
  st.savedShipments.push(b, e, g, a);
  st.shipment = b; st.currentShipment = c;
  for (const key of ['SH-1', 'ABC123', 'abc123', 'SH-9', 'XYZ', 'SH-3', 'SH-5', 'OTHER', 'SH-1 ', '', 'NOPE']) {
    assert.deepEqual(ctx.indexed(key), ctx.full(key), JSON.stringify(key));
  }
  assert.equal(ctx.full('ABC123').length, 3, 'Testdaten decken Kopien mit gleicher Referenz und ohne Referenz ab');

  // random overlapping ids/refs (fixed seed), every id and ref as key
  let seed = 7;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const make = () => { const x = {}; if (rnd(4)) x.id = 'S' + rnd(30); if (rnd(3)) x[['ref', 'reference', 'shipmentRef'][rnd(3)]] = (rnd(2) ? 'r' : 'R') + rnd(30); return x; };
  st.shipments = Array.from({ length: 200 }, make); st.savedShipments = Array.from({ length: 80 }, make);
  st.savedShipments.push(st.shipments[5], st.shipments[50]);
  st.shipment = st.shipments[10]; st.currentShipment = make(); st.selectedShipment = null;
  const keys = new Set(['']);
  for (let i = 0; i < 30; i++) keys.add('S' + i).add('r' + i).add('R' + i);
  for (const key of keys) assert.deepEqual(ctx.indexed(key), ctx.full(key), key);
});
