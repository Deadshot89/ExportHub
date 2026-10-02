import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('api/shared/pod-archive.js', 'utf8');

test('RC1417: optionaler Drive-Backfill hält den Scan-Cursor nicht auf derselben Seite fest', () => {
  const start = source.indexOf('const selectedRequiredCandidates');
  const end = source.indexOf('const saved = []', start);
  assert.ok(start >= 0 && end > start);
  const selectionBlock = source.slice(start, end);
  assert.doesNotMatch(selectionBlock, /driveBackfillCandidates\.length\s*>\s*selectedDriveCandidates\.length/);
  assert.match(selectionBlock, /requiredCandidates\.length\s*>\s*selectedRequiredCandidates\.length/);
  assert.match(selectionBlock, /teamRelinkCandidates\.length\s*>\s*selectedRelinks\.length/);
});

test('RC1417: Cursor-Rücksetzung bleibt ausschließlich an pageWorkDeferred gebunden', () => {
  const start = source.indexOf("if (!reference && pageWorkDeferred)");
  assert.ok(start >= 0);
  const block = source.slice(start, start + 220);
  assert.match(block, /nextContinuationToken = continuationToken/);
  assert.match(block, /scanComplete = false/);
});
