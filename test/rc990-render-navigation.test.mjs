import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('TESTVERSION.html', 'utf8');

function block(startPattern, max = 7000) {
  const match = html.match(startPattern);
  if (!match || match.index == null) return '';
  return html.slice(match.index, match.index + max);
}

test('RC990: UI-State Snapshot und Restore sind vorhanden', () => {
  assert.match(html, /function\s+rc990CaptureUiState\s*\(/);
  assert.match(html, /function\s+rc990RestoreUiState\s*\(/);
});

test('RC990: UI Snapshot schützt Eingabewert Cursor und Scrollposition', () => {
  const src = block(/function\s+rc990CaptureUiState\s*\(/, 5000);
  for (const key of ['value', 'start', 'end', 'winY', 'rootTop']) {
    assert.match(src, new RegExp(key));
  }
  assert.match(src, /document\.activeElement/);
});

test('RC990: Restore identifiziert dasselbe Feld und stellt Cursor erst nach DOM-Update wieder her', () => {
  const src = block(/function\s+rc990RestoreUiState\s*\(/, 7000);
  assert.match(src, /snapshot\.(?:id|name|field)/);
  assert.match(src, /setSelectionRange/);
  assert.match(src, /requestAnimationFrame|setTimeout/);
  assert.match(src, /preventScroll/);
});

test('RC990: Renderplanung dedupliziert denselben Grund pro Frame', () => {
  assert.match(html, /var\s+rc990RenderFrame\s*=\s*0/);
  assert.match(html, /function\s+rc990ScheduleRender\s*\(/);
  const src = block(/var\s+rc990RenderFrame\s*=\s*0/, 7000);
  assert.match(src, /if\s*\(rc990RenderFrame\)\s*return/);
  assert.match(src, /rc990RenderFrame\s*=\s*(?:window\.)?requestAnimationFrame/);
  assert.match(src, /rc990RenderFrame\s*=\s*0/);
});

test('RC990: Renderqueue bleibt reine UI-Orchestrierung ohne Speichern oder Azure-Write', () => {
  const src = block(/var\s+rc990RenderFrame\s*=\s*0/, 7000);
  assert.doesNotMatch(src, /saveShipment|saveAction|persist|azure|fetch\s*\(|method\s*:\s*['"]POST['"]/i);
});

test('RC990: bestehende RC950 Layoutplanung delegiert an die deduplizierte RC990 Queue', () => {
  const src = block(/function\s+rc950ScheduleLayout\s*\(/, 3500);
  assert.match(src, /rc990ScheduleRender\s*\(/);
  assert.doesNotMatch(src, /cancelAnimationFrame/);
});

test('RC990: Navigation besitzt einen echten View-Verlauf', () => {
  assert.match(html, /var\s+rc990ViewHistory\s*=\s*\[/);
  assert.match(html, /function\s+rc990RememberView\s*\(/);
  assert.match(html, /function\s+rc990BackView\s*\(/);
});

test('RC990: View-History vermeidet direkte Dubletten und ist begrenzt', () => {
  const src = block(/var\s+rc990ViewHistory\s*=\s*\[/, 6500);
  assert.match(src, /rc990ViewHistory\[rc990ViewHistory\.length\s*-\s*1\]/);
  assert.match(src, /(?:splice|slice|shift)\s*\(/);
  assert.match(src, /function\s+rc990BackView\s*\(/);
});

test('RC990: Zurücknavigation nutzt erst die vorherige App-Ansicht und behält Browser-Fallback', () => {
  const src = block(/function\s+rc990BackView\s*\(/, 5000);
  assert.match(src, /rc990ViewHistory/);
  assert.match(src, /history\.back|window\.history\.back/);
});

test('RC990: Mobile und Desktop verwenden dieselbe View-History', () => {
  assert.doesNotMatch(html, /rc990MobileViewHistory|rc990DesktopViewHistory/);
});
