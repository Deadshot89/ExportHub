import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync(new URL('../assets/rc1371-dashboard-personalization.js',import.meta.url),'utf8');
const engine=fs.readFileSync(new URL('../assets/rc1306-layout-engine.js',import.meta.url),'utf8');
const cssPath=new URL('../assets/rc1371-dashboard-personalization.css',import.meta.url);
const css=fs.existsSync(cssPath)?fs.readFileSync(cssPath,'utf8'):'';

test('RC1371 übernimmt Dashboard-Layout exklusiv ohne RC1306 für andere Views abzuschalten',()=>{
  assert.match(engine,/function dashboardOwnsLayout\s*\(/);
  assert.match(engine,/currentView\(\)==='dashboard'/);
  assert.match(engine,/ExportHUBDashboard1371/);
  assert.match(engine,/if\(dashboardOwnsLayout\(\)\)/);
  assert.match(engine,/genericLayout\(mode==='modern'\?'business':mode\)/);
});

test('RC1371 Runtime besitzt ownsLayout applyTheme und remount',()=>{
  assert.match(runtime,/function ownsLayout\s*\(/);
  assert.match(runtime,/function applyTheme\s*\(/);
  assert.match(runtime,/function remount\s*\(/);
  assert.doesNotMatch(runtime,/cloneNode\s*\(/);
});

test('RC1371 Größen S M L XL werden als Grid-Spans statt Pixelbreiten umgesetzt',()=>{
  assert.match(css,/data-rc1371-size="S"[^}]*grid-column:span 3/);
  assert.match(css,/data-rc1371-size="M"[^}]*grid-column:span 4/);
  assert.match(css,/data-rc1371-size="L"[^}]*grid-column:span 6/);
  assert.match(css,/data-rc1371-size="XL"[^}]*grid-column:1\/-1/);
});

test('RC1371 Responsive Grid reduziert Tablet und kollabiert Smartphone auf eine Spalte',()=>{
  assert.match(css,/grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\s*\(max-width:1120px\)[\s\S]*repeat\(8,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\s*\(max-width:760px\)[\s\S]*grid-template-columns:1fr/);
});

test('RC1371 CSS ist auf personalisiertes Dashboard gescoped und enthält kein transition all',()=>{
  assert.match(css,/\[data-eh-dashboard-personalized="1"\]/);
  assert.match(css,/html\[data-eh-design="glass"\][\s\S]*data-eh-dashboard-personalized/);
  assert.match(css,/html\[data-eh-design="neon"\][\s\S]*data-eh-dashboard-personalized/);
  assert.doesNotMatch(css,/transition\s*:\s*all/i);
});

test('RC1371 zeigt Toolbar-Bearbeitungsaktionen nur im Edit-Mode',()=>{
  assert.match(css,/data-eh-dashboard-personalized="1"\]:not\(\[data-rc1371-editing="1"\]\)[^}]*rc1371-dashboard-toolbar[^}]*:not\(\[data-rc1371-action="toggleEdit"\]\)[^}]*display:none!important/);
});

test('RC1371 zeigt im Edit-Mode einen sichtbaren Drag-Handle-Hinweis',()=>{
  assert.match(css,/data-rc1371-editing="1"[^}]*data-rc1371-widget-id[^}]*::before/);
  assert.match(css,/cursor:grab/);
});
