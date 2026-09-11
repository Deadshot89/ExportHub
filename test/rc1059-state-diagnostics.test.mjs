import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('RC1059: State-Diagnose zählt Blob-Dokumente aggregiert',()=>{
  const source=fs.readFileSync(new URL('../api/exporthub-state/index.js',import.meta.url),'utf8');
  const start=source.indexOf('function stateSizeDiagnostics(state)');
  const end=source.indexOf('async function latestValidTeamFallback',start);
  assert.ok(start>=0&&end>start);
  const block=source.slice(start,end);
  assert.match(block,/blobDocumentEntries/);
  assert.match(block,/storage\s*===?\s*['"]blob['"]/);
  assert.match(block,/return\s*\{[^}]*blobDocumentEntries/);
  assert.doesNotMatch(block,/return\s*\{[^}]*blobName/);
  assert.doesNotMatch(block,/return\s*\{[^}]*sha256/);
});

test('RC1059: Health-Marker bezeichnet die Dokument-Blob-Architektur',()=>{
  const source=fs.readFileSync(new URL('../api/exporthub-health/index.js',import.meta.url),'utf8');
  assert.match(source,/version:\s*['"]RC1059['"]/);
  assert.match(source,/release:\s*['"]document-blob-storage['"]/);
});
