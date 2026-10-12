import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const nav=fs.readFileSync('assets/pack-notification-nav.js','utf8');

test('RC1501 supersedes RC1474: Packmeldungen navigation no longer watches unrelated DOM mutations',()=>{
  assert.doesNotMatch(nav,/MutationObserver/,'global DOM observation caused visible Packmeldungen re-rendering');
  assert.doesNotMatch(nav,/cloneNode\(true\)/,'Aufgaben must not be cloned as Packmeldungen');
});

test('RC1501: Packmeldungen repairs only on explicit lifecycle events',()=>{
  assert.match(nav,/DOMContentLoaded/);
  assert.match(nav,/exporthub:view-changed/);
  assert.match(nav,/exporthub:pack-language-changed/);
  assert.match(nav,/repairAfterViewChange/);
});

test('RC1501: dedicated entry has its own view identity and owner marker',()=>{
  assert.match(nav,/createElement\(['"]button['"]\)/);
  assert.match(nav,/data-pack-notifications-nav-owner/);
  assert.match(nav,/data-view['"],['"]packnotifications/);
  assert.match(nav,/stopImmediatePropagation/,'Packmeldungen click must not leak into the Aufgaben router');
});
