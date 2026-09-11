import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const compat=fs.readFileSync(new URL('../assets/rc1063-abd-blob-viewer-compat.js',import.meta.url),'utf8');
const prep=fs.readFileSync(new URL('../.github/rc1049/fix-mail-abd-gate.mjs',import.meta.url),'utf8');

test('RC1063: blobbasierte ABD-Dateien erhalten Öffnen- und Download-Aktionen',()=>{
  assert.match(compat,/ExportHUBDocumentBlob1059/);
  assert.match(compat,/data-rc1063-open-blob/);
  assert.match(compat,/data-rc1063-download-blob/);
  assert.match(compat,/h\.isBlobDocument\(f\)/);
  assert.match(compat,/h\.open\(f,\{name:nameOf\(d\),download:download===true\}\)/);
});

test('RC1063: Kompatibilitätslayer wird nur in Produktion und TESTSERVICE am finalen Build eingebunden',()=>{
  assert.match(prep,/exporthub-rc1063-abd-blob-viewer-compat/);
  assert.match(prep,/assets\/rc1063-abd-blob-viewer-compat\.js\?v=1063/);
  assert.match(prep,/for\(const file of \['index\.html','TESTVERSION\.html'\]\)/);
});
