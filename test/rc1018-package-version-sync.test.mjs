import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const marker=fs.readFileSync('production-version.js','utf8');
const match=marker.match(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC(\d+)'/);

assert.ok(match,'Autoritativer Produktionsmarker fehlt');
const rc=match[1];

test('npm-Paketversion folgt dem autoritativen ExportHUB-Release',()=>{
  assert.equal(pkg.version,`1.0.0-rc${rc}`);
});

test('npm-Paketbeschreibung nennt den aktuellen ExportHUB-Release',()=>{
  assert.match(pkg.description,new RegExp(`ExportHUB RC${rc}\\b`));
  assert.doesNotMatch(pkg.description,/aktueller .*RC\d+/i);
});
