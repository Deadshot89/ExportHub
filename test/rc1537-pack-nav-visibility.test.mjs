import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const nav=fs.readFileSync('assets/pack-notification-nav.js','utf8');

test('RC1537: Packmeldungen participates in the canonical sidebar navigation styling',()=>{
  assert.match(
    nav,
    /setAttribute\(['"]data-index321-view['"],['"]packnotifications['"]\)/,
    'Packmeldungen must expose the canonical data-index321-view marker so the normal sidebar styles apply'
  );
});

test('RC1537: Packmeldungen can never inherit a faded or disabled-looking visual state',()=>{
  assert.match(nav,/opacity:1!important/,'Packmeldungen needs an explicit full-opacity guard');
  assert.match(nav,/\.pack-notification-nav-label\{[^}]*opacity:1!important/,'the Packmeldungen label must remain fully readable');
});
