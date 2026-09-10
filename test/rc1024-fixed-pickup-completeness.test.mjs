import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const seed = require('../api/shared/rc1014-fixed-pickup-seed.js');

function key(item){ return `${item.siteLabel}|${item.weekday}`; }

test('Essentra-Seed enthält die eindeutig belegten fehlenden festen Abholungen', () => {
  const actual = new Set(seed.defaultsForCompany('ESSENTRA').map(key));
  const required = [
    'Esysco|1',
    'Gaggenau|1',
    'Barcelona|1',
    'Madrid|1',
    'Adolf Würth|2',
    'Gorenje Slovenien|2',
    'BSH Hausgeräte|3',
    'Contitech|3',
    'Adolf Würth|4',
    'Madrid|4',
    'Barcelona|4',
    'Polen|4',
    'Schweden|5'
  ];
  for (const expected of required) assert.equal(actual.has(expected), true, `Fehlende FIX-Abholung: ${expected}`);
});

test('bestehende aktuelle FIX-Abholungen bleiben erhalten und NEFF bleibt entfernt', () => {
  const actual = new Set(seed.defaultsForCompany('ESSENTRA').map(key));
  for (const expected of ['Frankreich|1','Italien|1','O’Hare|1','Faurecia|2','BMP|3']) {
    assert.equal(actual.has(expected), true, `Bestehende FIX-Abholung fehlt: ${expected}`);
  }
  assert.equal([...actual].some(value => /^Neff\|/i.test(value)), false);
});
