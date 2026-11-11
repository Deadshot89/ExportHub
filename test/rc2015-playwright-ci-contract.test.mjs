import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const installer = '.github/scripts/rc2015-playwright-browser-ready.sh';
const workflows = [
  '.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml',
  '.github/workflows/rc1189-mobile-navigation-pr-browser.yml',
  '.github/workflows/sopmaster-release-candidate.yml',
  '.github/workflows/rc1564-language-verify.yml',
  '.github/workflows/rc1190-print-browser-pr.yml'
];

test('RC2015: Chromium setup must launch and navigate a browser, never silently skip a failing gate', () => {
  const script = read(installer);
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /npx playwright install chromium/);
  assert.match(script, /chromium\.launch/);
  assert.match(script, /page\.goto/);
  assert.match(script, /process\.exitCode = 1/);
  assert.doesNotMatch(script, /--with-deps|\|\| true/);
});

test('RC2015: affected browser CI gates must run the checked Chromium setup without apt mirrors', () => {
  for (const workflow of workflows) {
    const source = read(workflow);
    assert.ok(source.includes('bash ' + installer), workflow + ' must run the checked real-browser setup');
    assert.doesNotMatch(source, /npx playwright install --with-deps chromium/, workflow + ' must not depend on Ubuntu apt DNS');
  }
  const main = read(workflows[0]);
  assert.match(main, /RC1124 TESTSERVICE Browser Gate/);
  assert.match(main, /Deploy ExportHUB TESTSERVICE/);
  const sop = read(workflows[2]);
  assert.equal(sop.split('bash ' + installer).length - 1, 2, 'both SOPMaster browser gates remain active');
});
