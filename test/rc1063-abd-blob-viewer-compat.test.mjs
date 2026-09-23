import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const compat=fs.readFileSync(new URL('../assets/rc1063-abd-blob-viewer-compat.js',import.meta.url),'utf8');
const prep=fs.readFileSync(new URL('../.github/rc1049/fix-mail-abd-gate.mjs',import.meta.url),'utf8');
const build=fs.readFileSync(new URL('../.github/rc1048/build-three-env.mjs',import.meta.url),'utf8');
const wrapper=fs.readFileSync(new URL('../.github/rc1112/build-three-env.mjs',import.meta.url),'utf8');

test('RC1063: blobbasierte ABD-Dateien erhalten Öffnen- und Download-Aktionen',()=>{
  assert.match(compat,/ExportHUBDocumentBlob1059/);
  assert.match(compat,/data-rc1063-open-blob/);
  assert.match(compat,/data-rc1063-download-blob/);
  assert.match(compat,/h\.isBlobDocument\(f\)/);
  assert.match(compat,/h\.open\(f,\{name:nameOf\(d\),download:download===true\}\)/);
});

test('RC1063: Kompatibilitätslayer wird nur in Produktion und TESTSERVICE am finalen Build eingebunden',()=>{
  assert.match(prep,/exporthub-rc1063-abd-blob-viewer-compat/);
  assert.match(prep,/assets\/rc1063-abd-blob-viewer-compat\.js\?v=1248/);
  assert.match(prep,/for\(const file of \['index\.html','TESTVERSION\.html'\]\)/);
});


test('RC1248: Dokument-Viewer beobachtet nur das aktive Referenzdatei-Panel',()=>{
  assert.match(compat,/panelObserver\.observe\(panel,\{childList:true,subtree:true\}\)/);
  assert.doesNotMatch(compat,/observe\(w\.document\.documentElement/);
  assert.match(compat,/function bindViewerPanel\(\)/);
  assert.match(compat,/scheduleViewerRefresh\(false\)/);
});

test('RC1248: Start-Probe ist kurz und ersetzt das frühere 60-Sekunden-Polling',()=>{
  assert.match(compat,/tries>=8/);
  assert.match(compat,/,500\)/);
  assert.doesNotMatch(compat,/tries>=60/);
  assert.doesNotMatch(compat,/,1000\)/);
});

test('RC1248: Viewer-Runtime wird mit frischem Cache-Key ausgeliefert und bleibt syntaktisch gültig',()=>{
  assert.match(build,/assets\/rc1063-abd-blob-viewer-compat\.js\?v=1248/);
  assert.match(prep,/assets\/rc1063-abd-blob-viewer-compat\.js\?v=1248/);
  assert.match(wrapper,/assets\\\/rc1063-abd-blob-viewer-compat\\\.js\\\?v=\(\?:1063\|1151\|1248\)/);
  assert.match(wrapper,/assets\/rc1063-abd-blob-viewer-compat\.js\?v=1248/);
  assert.doesNotMatch(wrapper,/Dokumentaktionen Cache-Key fehlt'\);[^\n]*v=1151/);
  execFileSync(process.execPath,['--check','assets/rc1063-abd-blob-viewer-compat.js'],{stdio:'pipe'});
});
