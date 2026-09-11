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

test('RC1059: Health-Marker bleibt mindestens auf Dokument-Blob-Architektur-Niveau',()=>{
  const source=fs.readFileSync(new URL('../api/exporthub-health/index.js',import.meta.url),'utf8');
  const match=source.match(/version:\s*['"]RC(\d+)['"]/);
  assert.ok(match,'Health-Marker fehlt');
  assert.ok(Number(match[1])>=1059,'Health-Marker darf nicht hinter RC1059 zurückfallen');
  assert.match(source,/release:\s*['"][a-z0-9-]+['"]/);
});
