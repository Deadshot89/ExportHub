import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('TESTVERSION.html', 'utf8');

function buildNumber(source) {
  const match = source.match(/var BUILD=Object\.freeze\(\{version:'RC(\d+)'/);
  return match ? Number(match[1]) : 0;
}

function functionSource(source, name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} fehlt`);
  const end = nextName ? source.indexOf(`function ${nextName}(`, start + 1) : -1;
  return source.slice(start, end > start ? end : start + 2000);
}

test('RC976: Build ist auf RC976 oder höher angehoben', () => {
  assert.ok(buildNumber(html) >= 976, 'BUILD muss RC976 oder höher sein');
});

test('RC976: Render-Fallback besitzt eine eindeutige technische Markierung', () => {
  assert.match(
    html,
    /data-exporthub-render-fallback=[\\"']1[\\"'][^>]*>[\s\S]{0,220}?Die Ansicht konnte nicht vollständig aufgebaut werden/,
    'Fallback-Meldung muss eindeutig markiert sein'
  );
});

test('RC976: veralteter Render-Fallback wird gezielt entfernt', () => {
  const src = functionSource(html, 'rc976ClearRenderFallback', 'performStableRender');
  assert.match(src, /querySelectorAll\(['"]\[data-exporthub-render-fallback=[^\]]+\]['"]\)/, 'Helper muss ausschließlich markierte Fallbacks suchen');
  assert.match(src, /parentNode\.removeChild\(/, 'Helper muss den alten Fallback aus dem DOM entfernen');
});

test('RC976: jeder neue Render-Versuch räumt zuerst einen alten Fallback auf', () => {
  const src = functionSource(html, 'performStableRender', 'stableRender');
  const tryPos = src.indexOf('try{');
  const clearPos = src.indexOf('rc976ClearRenderFallback(root())');
  assert.ok(tryPos >= 0, 'performStableRender braucht den bestehenden try-Block');
  assert.ok(clearPos > tryPos, 'Fallback muss innerhalb des aktuellen Render-Versuchs entfernt werden');
  assert.ok(clearPos - tryPos < 260, 'Fallback muss direkt zu Beginn des Render-Versuchs entfernt werden');
});

test('RC976: ein aktueller Renderfehler erzeugt den markierten Fallback erneut', () => {
  const catchPos = html.indexOf('catch(renderError)');
  assert.ok(catchPos >= 0, 'Render-catch fehlt');
  const catchSlice = html.slice(catchPos, catchPos + 1200);
  assert.match(catchSlice, /data-exporthub-render-fallback=\\?['"]1\\?['"]/, 'Catch muss den markierten Fallback wieder einsetzen');
});
