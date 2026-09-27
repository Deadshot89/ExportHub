import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync('assets/rc1304-theme-switcher.js','utf8');
const css=fs.readFileSync('assets/rc1304-theme-switcher.css','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1304: Switcher exposes exactly four designs and persists the choice',()=>{
  assert.match(runtime,/var CLASSIC='classic'/);
  assert.match(runtime,/var MODERN='modern'/);
  assert.match(runtime,/var GLASS='glass'/);
  assert.match(runtime,/var NEON='neon'/);
  assert.match(runtime,/VALUES=\[CLASSIC,MODERN,GLASS,NEON\]/);
  assert.match(runtime,/theme\.classic/);
  assert.match(runtime,/theme\.modernBusiness/);
  assert.match(runtime,/theme\.glass/);
  assert.match(runtime,/theme\.neonNight/);
  assert.match(runtime,/options\.length===4/);
  assert.match(runtime,/localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(runtime,/localStorage\.setItem\(STORAGE_KEY,value\)/);
  assert.match(runtime,/data-eh-design/);
});

test('RC1304: theme switcher uses central i18n keys instead of hard-coded German UI text',()=>{
  assert.match(runtime,/ExportHUBI18n/);
  assert.match(runtime,/theme\.label/);
  assert.match(runtime,/theme\.select/);
  assert.match(runtime,/exporthub:language-changed/);
  assert.doesNotMatch(runtime,/Design auswählen/);
  assert.doesNotMatch(runtime,/Klassisch \/ Alt/);
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

test('RC1304: observer refresh is idempotent and does not rebuild options forever',()=>{
  assert.match(runtime,/var ready=select\.dataset\.rc1304==='1'/);
  assert.match(runtime,/if\(!ready\)\{/);
  assert.match(runtime,/if\(select\.value!==value\)select\.value=value/);
  assert.match(runtime,/function setText\(node,value\)/);
  assert.match(runtime,/if\(node\.textContent!==value\)node\.textContent=value/);
});

test('RC1304: three redesigns are distinct while classic remains untouched',()=>{
  assert.match(css,/data-eh-design="modern"/);
  assert.match(css,/data-eh-design="glass"/);
  assert.match(css,/data-eh-design="neon"/);
  assert.match(css,/--pc-primary:#2563eb/);
  assert.match(css,/--pc-primary:#5b7cfa/);
  assert.match(css,/--pc-primary:#22d3ee/);
  assert.match(css,/html\[data-eh-design\]:not\(\[data-eh-design="classic"\]\)/);
  assert.match(css,/Glass personality/);
  assert.match(css,/Neon Night personality/);
  assert.match(css,/\.sidebar/);
  assert.match(css,/\.topbar/);
  assert.match(css,/#content/);
  assert.match(css,/#login/);
});

test('RC1304: release builder injects and ships the redesign in generated environments',()=>{
  assert.match(builder,/rc1304-theme-switcher\.css\?v=1304/);
  assert.match(builder,/rc1304-theme-switcher\.js\?v=1304/);
  assert.match(builder,/patchRc1304ThemeRedesign/);
  assert.match(builder,/'assets\/rc1304-theme-switcher\.css'/);
  assert.match(builder,/'assets\/rc1304-theme-switcher\.js'/);
  assert.match(builder,/html=patchRc1304ThemeRedesign\(html,file\)/);
});
