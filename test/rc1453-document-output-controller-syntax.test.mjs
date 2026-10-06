import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const controllerId = 'exporthub-rc352-document-output-controller';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

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

function parseInlineScript(code, filename) {
  try {
    new vm.Script(code, { filename });
  } catch (error) {
    const stack = String(error?.stack || error);
    const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lineMatch = stack.match(new RegExp(`${escaped}:(\\d+)`));
    const line = Number(lineMatch?.[1] || 0);
    const lines = code.split('\n');
    const start = Math.max(0, line - 4);
    const end = Math.min(lines.length, line + 3);
    const context = lines
      .slice(start, end)
      .map((value, index) => `${start + index + 1}: ${JSON.stringify(value)}`)
      .join('\n');

    assert.fail(`${filename} is invalid JavaScript\n${stack}\n\nGenerated context:\n${context}`);
  }
}

test('RC1453: source document output controller remains valid JavaScript', () => {
  const html = read(new URL('../index.html', import.meta.url));
  const code = extractInlineScriptById(html, controllerId);
  parseInlineScript(code, `${controllerId}.source.js`);
});

test('RC1453: built demo document output controller remains valid JavaScript', () => {
  execFileSync(process.execPath, ['.github/rc1112/build-three-env.mjs'], { stdio: 'pipe' });
  const demo = read('dist-rc1112/demo.html');
  const code = extractInlineScriptById(demo, controllerId);
  parseInlineScript(code, `${controllerId}.demo.js`);
});
