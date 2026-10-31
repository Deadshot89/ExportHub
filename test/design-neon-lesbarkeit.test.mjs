import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// 31.10.2026: in Neon Night several light-first components kept a white background while the text turned light
// (SOP document, Ladeliste & CMR, overview group bar, academy). On phones the design names were cut off and the
// language select was hidden below 560 px.
const css = fs.readFileSync(new URL('../assets/rc1304-theme-switcher.css', import.meta.url), 'utf8');
const screenBlock = css.slice(css.indexOf('/* Neon Night (31.10.2026)'));

test('Neon: helle Restflächen bekommen dunklen Hintergrund, nur am Bildschirm', () => {
  assert.ok(screenBlock.length > 0, 'Neon-Block fehlt');
  assert.match(screenBlock, /^\/\*[^*]*\*\/\s*@media screen\{/, 'SOP-Ausdruck muss weiß bleiben');
  for (const sel of ['.rc1007-sop-section', '.rc1007-sop-meta', 'rect.rc1007-sop-flow-node', 'text.rc1007-sop-flow-label',
    '.rc543-overview-group-head', '.rc682-packaging-toggle', '#rc576DocumentActions', '#rc576DocumentTabs', '#rc576DocumentStage',
    '#rc576NoShipment', '#rc376UpsAuto.warn', '.rc1092-avis-state', '.rc299-option']) {
    assert.ok(screenBlock.includes(sel), sel + ' fehlt im Neon-Block');
  }
  // the document preview itself (paper) is not darkened
  assert.doesNotMatch(screenBlock, /rc390-docview/);
});

test('Dashboard-Kacheln brechen nicht mitten im Wort um', () => {
  assert.match(css, /\.rc1558-kpi :is\([^)]*\.rc1558-kpi-sub[^)]*\)\{overflow-wrap:break-word!important;word-break:normal!important;hyphens:auto!important\}/);
});

test('Handy: Design-Namen lesbar und Sprache wählbar', () => {
  const phone = css.slice(css.lastIndexOf('@media (max-width:560px){'));
  assert.match(phone, /#languageSelect\{display:block!important/);
  assert.match(phone, /#ehThemeSwitch>span\{display:none!important\}/);
  assert.match(phone, /#ehThemeSelect\{width:100%!important/);
});
