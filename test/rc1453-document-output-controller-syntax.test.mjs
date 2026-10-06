import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extractInlineScriptById(source, id) {
  const scriptRx = /<script(?=[\s>])([^>]*)>([\s\S]*?)<\/script>/gi;
  const matches = [];
  let match;

  while ((match = scriptRx.exec(source))) {
    const attrs = match[1] || '';
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
    if (idMatch?.[1] === id) matches.push(match[2] || '');
  }

  assert.equal(matches.length, 1, `${id}: expected exactly one inline script`);
  return matches[0];
}

test('RC1453: document output controller remains valid JavaScript', () => {
  const id = 'exporthub-rc352-document-output-controller';
  const code = extractInlineScriptById(html, id);

  // Deliberately let vm.Script surface the original parser location/code frame.
  // This protects the public index.html from shipping a syntax-broken controller.
  new vm.Script(code, { filename: `${id}.js` });
});
