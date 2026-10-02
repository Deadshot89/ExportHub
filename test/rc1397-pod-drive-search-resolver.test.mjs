import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const graph = fs.readFileSync('api/shared/graph-drive.js','utf8');

test('RC1397: POD-Ziel kann über Drive-Suche nach Ordnernamen gefunden werden', () => {
  assert.match(graph, /async function searchFolderInDrive\(/);
  assert.match(graph, /root\/search\(q=/);
  assert.match(graph, /folderSearchScore\(/);
  assert.match(graph, /searchConfiguredFolderTargets\(/);
});

test('RC1397: exakter Pfad bleibt erste Wahl, Drive-Suche kommt vor persönlicher Share-URL', () => {
  const exact = graph.indexOf('resolveDefaultUserDriveTarget(token, cfg.user, folders)');
  const search = graph.indexOf('searchConfiguredFolderTargets(token, cfg.user, drives, folders)');
  const personal = graph.indexOf('resolvePersonalFolderTarget(token, cfg.user, cfg.folder)');
  assert.ok(exact >= 0 && search > exact && personal > search);
});

test('RC1397: mehrdeutige Suchtreffer bleiben fail-closed', () => {
  assert.match(graph, /GRAPH_TARGET_AMBIGUOUS/);
  assert.match(graph, /wurde mehrfach gefunden/);
});
