import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const activeWorkflows = [
  '.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml',
  '.github/workflows/rc1002-main-contract.yml',
  '.github/workflows/exporthub-android-test-app.yml',
  '.github/workflows/rc1007-release-verify.yml',
  '.github/workflows/rc1012-abholkalender-verify.yml'
];

for (const file of activeWorkflows) {
  test(`${file}: aktive Checkout- und Node-Actions verwenden Node-24-kompatible v5-Runtime`, () => {
    const flow = fs.readFileSync(file, 'utf8');
    assert.match(flow, /actions\/checkout@v5/, `${file}: checkout@v5 fehlt`);
    assert.match(flow, /actions\/setup-node@v5/, `${file}: setup-node@v5 fehlt`);
    assert.doesNotMatch(flow, /actions\/(?:checkout|setup-node)@v4/, `${file}: alte Node-20-Action v4 ist noch aktiv`);
    assert.match(flow, /package-manager-cache:\s*false/, `${file}: setup-node@v5 muss automatisches Caching explizit deaktivieren`);
  });
}
