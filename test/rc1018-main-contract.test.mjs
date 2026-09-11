import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow='.github/workflows/rc1002-main-contract.yml';
const flow=fs.readFileSync(workflow,'utf8');

test('RC1045 Main-Contract schützt aktuellen Release und historische Release-Basis',()=>{
  assert.match(flow,/name: RC1045 Main Contract/);
  assert.match(flow,/\.github\/rc1018\/\*\*/);
  assert.match(flow,/\.github\/rc1043\/\*\*/);
  assert.match(flow,/\.github\/rc1044\/\*\*/);
  assert.match(flow,/\.github\/rc1045\/\*\*/);
  assert.match(flow,/RC1018 Mail- und Sprachbasis/);
  assert.match(flow,/test\/rc1018-mail-language-standard\.test\.mjs/);
  assert.match(flow,/test\/rc1018-production-deploy\.test\.mjs/);
  assert.match(flow,/RC1013 Baseline und RC1045 Produktionsmarker prüfen/);
  assert.match(flow,/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1045'/);
  assert.doesNotMatch(flow,/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1016'/);
});
