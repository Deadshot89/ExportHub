import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync('assets/rc1304-theme-switcher.js','utf8');
const css=fs.readFileSync('assets/rc1304-theme-switcher.css','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1304: Switcher exposes exactly Classic and Modern and persists the choice',()=>{
  assert.match(runtime,/var CLASSIC='classic'/);
  assert.match(runtime,/var MODERN='modern'/);
  assert.match(runtime,/Klassisch \/ Alt/);
  assert.match(runtime,/>Neu</);
  assert.match(runtime,/localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(runtime,/localStorage\.setItem\(STORAGE_KEY,value\)/);
  assert.match(runtime,/data-eh-design/);
});

test('RC1304: switching never reloads or changes the URL',()=>{
  assert.doesNotMatch(runtime,/location\.reload\s*\(/);
  assert.doesNotMatch(runtime,/location\.href\s*=/);
  assert.doesNotMatch(runtime,/window\.location\s*=/);
  assert.doesNotMatch(runtime,/history\.(?:pushState|replaceState)\s*\(/);
});

test('RC1304: legacy theme controller is preserved and normalized to current',()=>{
  assert.match(runtime,/window\.ExportHUBThemeSwitcher/);
  assert.match(runtime,/legacy\.apply\('current'\)/);
  assert.match(runtime,/cloneNode\(false\)/);
  assert.match(runtime,/select\.dataset\.rc446='1'/);
});

test('RC1304: design selection is available on login and in the authenticated topbar',()=>{
  assert.match(runtime,/rc1304LoginTheme/);
  assert.match(runtime,/ehLoginThemeSelect/);
  assert.match(runtime,/ehThemeSelect/);
  assert.match(runtime,/ensureLogin/);
  assert.match(runtime,/ensureTopbar/);
});

test('RC1304: modern redesign is scoped and classic remains untouched',()=>{
  assert.match(css,/data-eh-design="modern"/);
  assert.match(css,/--pc-primary:#2563eb/);
  assert.match(css,/\.sidebar/);
  assert.match(css,/\.topbar/);
  assert.match(css,/#content/);
  assert.match(css,/#login/);
  assert.doesNotMatch(css,/body:not\(\[data-eh-design="modern"\]\)/);
});

test('RC1304: release builder injects and ships the redesign in generated environments',()=>{
  assert.match(builder,/rc1304-theme-switcher\.css\?v=1304/);
  assert.match(builder,/rc1304-theme-switcher\.js\?v=1304/);
  assert.match(builder,/patchRc1304ThemeRedesign/);
  assert.match(builder,/'assets\/rc1304-theme-switcher\.css'/);
  assert.match(builder,/'assets\/rc1304-theme-switcher\.js'/);
  assert.match(builder,/html=patchRc1304ThemeRedesign\(html,file\)/);
});
