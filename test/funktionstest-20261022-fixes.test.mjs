import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const layout=fs.readFileSync('assets/rc1306-layout-engine.js','utf8');
const theme=fs.readFileSync('assets/rc1304-theme-switcher.css','utf8');
const customsAi=fs.readFileSync('assets/rc1532-customs-ai.js','utf8');
const packNav=fs.readFileSync('assets/pack-notification-nav.js','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('Funktionstest 22.10.: Layout-Engine holt keine vom App-Router entfernten Ansichten zurück',()=>{
  const restore=layout.slice(layout.indexOf('function restoreNode('),layout.indexOf('function restoreAll('));
  assert.match(restore,/if\(!node\.isConnected\)return false;/);
  assert.ok(restore.indexOf('isConnected')<restore.indexOf('insertBefore'),'Prüfung muss vor dem Wiedereinfügen stehen');
});

test('Funktionstest 22.10.: Warncenter reserviert Platz in der Kopfleiste',()=>{
  assert.match(theme,/body:has\(#rc885WarningButton\) \.topbar \.eh-topbar-actions\{padding-right:150px!important\}/);
});

test('Funktionstest 22.10.: Neon überschreibt die RC971-Formularfarben in derselben Kaskadenebene',()=>{
  const layer=theme.slice(theme.lastIndexOf('@layer rc971{'));
  assert.match(layer,/html\[data-eh-design="neon"\][^{]*label\.field[^{]*\{color:#aac1d7!important\}/);
  assert.match(layer,/html\[data-eh-design="neon"\][^{]*select,textarea\)[^{]*\{background:#0b1728!important/);
});

test('Funktionstest 22.10.: Neon-Dashboard: Widgets, Schnellzugriffe und Erinnerung sind dunkel',()=>{
  assert.match(theme,/html\[data-eh-design="neon"\]\[data-eh-design\] body\{--rc990-surface:#0c192a;/);
  assert.match(theme,/html\[data-eh-design="neon"\] #content \.rc205-quick\{background:#0e1d31!important/);
  assert.match(theme,/html\[data-eh-design="neon"\] \.index236-hint\{background:#0c192a!important/);
});

test('Funktionstest 22.10.: Geänderte Assets bekommen neue Cache-Versionen',()=>{
  assert.match(builder,/rc1304-theme-switcher\.css\?v=1306/);
  assert.match(builder,/rc1306-layout-engine\.js\?v=1306\.1/);
  assert.match(builder,/rc1570-tasks-focus\.js\?v=1725/);
  assert.match(fs.readFileSync('.github/rc1532/build-three-env.mjs','utf8'),/rc1532-customs-ai\.js\?v=1533/);
});

test('Funktionstest 22.10.: KI-Zollexperte zeigt bei Fehlern nicht „Belegt“',()=>{
  assert.match(customsAi,/var uncertain=!!\(result&&\(result\.uncertainty\|\|result\.ok===false\)\);/);
  assert.match(customsAi,/if\(!response\.ok\)\{body\.ok=false;/);
});

test('Funktionstest 22.10.: Packmeldungen-Menüpunkt verliert die aktive Markierung außerhalb der Packmeldungen',()=>{
  assert.match(packNav,/node\.classList\.toggle\('active',!!active\)/);
});
