import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('Prüfung 29.10.2026: Aufgabenplaner und SOP-Übersicht folgen dem ExportHUB-Design, nicht dem Dunkelmodus des Betriebssystems',()=>{
  for(const file of ['assets/taskplanner-v2.css','assets/sop/rc1506-sop-coverage-dashboard.css']){
    assert.doesNotMatch(read(file),/prefers-color-scheme\s*:\s*dark/,file);
  }
  assert.match(read('assets/taskplanner-v2.css'),/html\[data-eh-design="neon"\]\{--tpv2-surface:/);
  assert.match(read('assets/sop/rc1506-sop-coverage-dashboard.css'),/html\[data-eh-design="neon"\] \.rc1506-dashboard\{/);
});

test('Prüfung 29.10.2026: Seitenleiste und Inhaltsspalte sind bei Laptopbreiten gleich breit',()=>{
  const css=read('assets/rc1304-theme-switcher.css');
  assert.match(css,/@media \(min-width:901px\) and \(max-width:1180px\)\{\s*html\[data-eh-design="classic"\] body\[data-eh-theme\] \.sidebar\{width:var\(--pc-side-width\)!important\}/);
  assert.match(css,/@media \(min-width:901px\) and \(max-width:1100px\)\{\s*html\[data-eh-design\]:not\(\[data-eh-design="classic"\]\) body\[data-eh-theme\]\{--pc-side-width:82px\}/);
});

test('Prüfung 29.10.2026: Sendung erstellen zeigt das Formular vor der Tabelle der gespeicherten Sendungen',()=>{
  const js=read('assets/rc1306-layout-engine.js');
  assert.doesNotMatch(js,/shell\.appendChild\(root\)/);
  assert.equal((js.match(/shell\.insertBefore\(root,shell\.firstChild\)/g)||[]).length,3);
  const css=read('assets/rc1306-layout-engine.css');
  assert.match(css,/@media\(min-width:1121px\) and \(max-width:1599px\)\{/);
  assert.match(css,/#rc363BlockColli:has\(>\.rc363-process-body:empty\)/);
});
