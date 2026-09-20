import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest=fs.readFileSync('RELEASE_MANIFEST.txt','utf8');

test('RC1188: Root-Release-Manifest ist eindeutig als historischer Snapshot gekennzeichnet',()=>{
  assert.match(manifest,/^HINWEIS: HISTORISCHER SNAPSHOT – NICHT ALS AKTUELLEN RELEASESTAND VERWENDEN/m);
  assert.match(manifest,/Historischer ExportHUB Snapshot RC990/);
  assert.match(manifest,/Diese Datei dokumentiert ausschließlich .*RC990-Snapshot vom 03\.09\.2026/);
});

test('RC1188: aktueller Releasevertrag verweist auf den Drei-Umgebungen-Build statt auf RC990',()=>{
  assert.match(manifest,/\.github\/rc1112\/build-three-env\.mjs/);
  assert.match(manifest,/\.github\/workflows\/azure-static-web-apps-wonderful-forest-0f315e310\.yml/);
  assert.match(manifest,/GitHub-Actions-Releasegates/);
  assert.match(manifest,/RC1112-Manifeste\/Buildmarker/);
});
