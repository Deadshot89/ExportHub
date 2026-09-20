import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const health=fs.readFileSync(new URL('../api/exporthub-health/index.js',import.meta.url),'utf8');
const probe=fs.readFileSync(new URL('../.github/workflows/rc1050-storage-probe.yml',import.meta.url),'utf8');

test('RC1060: Health-Marker bezeichnet die Legacy-Dokumentmigration',()=>{
  assert.match(health,/version:\s*['"]RC1060['"]/);
  assert.match(health,/release:\s*['"]legacy-document-migration['"]/);
});

test('RC1060: Storage-Probe führt RC1060-Regressionen aus',()=>{
  assert.match(probe,/RC1060 Dokumentmigration Regression/);
  assert.match(probe,/test\/rc1060-legacy-document-migration\.test\.mjs/);
  assert.match(probe,/test\/rc1060-document-migration-endpoint\.test\.mjs/);
});

test('RC1060: Live-Probe verlangt RC1060 und prüft Migrationsroute ohne Session auf 401',()=>{
  assert.match(probe,/v\.version==='RC1060'/);
  assert.match(probe,/v\.release==='legacy-document-migration'/);
  assert.match(probe,/exporthub-document-migrate/);
  assert.match(probe,/Migrationsroute ohne Session[\s\S]*'401'/);
});


test('RC1185: Storage-Probe läuft auch nach fehlgeschlagenem Main-Release und zeigt Auth-Konfiguration nur als Boolean',()=>{
  assert.match(probe,/github\.event\.workflow_run\.head_branch == 'main'/);
  assert.doesNotMatch(probe,/workflow_run\.conclusion == 'success'/);
  assert.match(probe,/exporthub-auth-probe/);
  const authProbe=fs.readFileSync(new URL('../api/exporthub-auth-probe/index.js',import.meta.url),'utf8');
  assert.match(authProbe,/signingSecretConfigured:\s*Boolean\(/);
  assert.doesNotMatch(authProbe,/signingSecretValue|authSigningSecretValue/);
});
