import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = '.github/workflows/rc1002-main-contract.yml';
const flow = fs.readFileSync(workflow,'utf8');

test('RC1018 Main-Contract folgt dem aktuellen gemeinsamen Release', () => {
  assert.match(flow,/name: RC1018 Main Contract/);
  assert.match(flow,/\.github\/rc1018\/\*\*/);
  assert.match(flow,/RC1018 Mail- und Sprachvertrag/);
  assert.match(flow,/test\/rc1018-mail-language-standard\.test\.mjs/);
  assert.match(flow,/test\/rc1018-production-deploy\.test\.mjs/);
  assert.match(flow,/RC1013 Baseline und RC1018 Produktionsmarker prüfen/);
  assert.match(flow,/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1018'/);
  assert.doesNotMatch(flow,/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1016'/);
});
