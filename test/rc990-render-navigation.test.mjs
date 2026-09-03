import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('TESTVERSION.html', 'utf8');

test('RC990: UI-State Snapshot und Restore sind vorhanden', () => {
  assert.match(html, /function\s+rc990CaptureUiState\s*\(/);
  assert.match(html, /function\s+rc990RestoreUiState\s*\(/);
});

test('RC990: Navigation besitzt einen echten View-Verlauf', () => {
  assert.match(html, /rc990ViewHistory/);
  assert.match(html, /function\s+rc990RememberView\s*\(/);
  assert.match(html, /function\s+rc990BackView\s*\(/);
});

test('RC990: Renderplanung dedupliziert denselben Grund pro Frame', () => {
  assert.match(html, /rc990RenderFrame|rc990ScheduleRender/);
  assert.match(html, /requestAnimationFrame/);
});
