import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const helper=fs.readFileSync('e2e/helpers/exporthub-browser.mjs','utf8');

test('RC1157: tatsächliche sichtbare Sidebar ist autoritativ für den Offen-Zustand',()=>{
  assert.match(helper,/async function mobileNavOnScreen\(/);
  assert.match(helper,/getElementById\('nav'\)/);
  assert.match(helper,/getBoundingClientRect\(\)/);
  assert.match(helper,/if\(await mobileNavOnScreen\(page\)\)return true/);
  assert.match(helper,/if\(expanded===false\)return false/);
});

test('RC1157: Navigation bestätigt aktive Zielansicht oder echte Inhaltsänderung und versucht erneut',()=>{
  assert.match(helper,/async function activateNavigationTarget\(/);
  assert.match(helper,/aria-current/);
  assert.match(helper,/contentView===mod\|\|bodyView===mod\|\|text!==beforeText/);
  assert.match(helper,/attempts:/);
  assert.match(helper,/continue attempts/);
  assert.match(helper,/if\(responsiveViewport\(page\)\)menuOpened=/);
});

test('RC1157: fehlgeschlagener Klick wird nicht als erfolgreicher View-Wechsel akzeptiert',()=>{
  assert.match(helper,/if\(!changed\)return false/);
  assert.match(helper,/if\(await activateNavigationTarget\(page,item,module,requiredText\)\)return module/);
});
