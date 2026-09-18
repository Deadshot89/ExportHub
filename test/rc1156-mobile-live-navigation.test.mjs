import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const helper=fs.readFileSync('e2e/helpers/exporthub-browser.mjs','utf8');

test('RC1156: sichtbarer Mobile-Menübutton ist autoritativ für den Offen-Zustand',()=>{
  assert.match(helper,/async function mobileToggleExpanded\(/);
  assert.match(helper,/getAttribute\('aria-expanded'\)/);
  assert.match(helper,/if\(expanded!==null\)return expanded/);
  assert.match(helper,/if\(await menuIsOpen\(page\)\)return true/);
});

test('RC1156: Navigation bestätigt den tatsächlichen View-Wechsel und versucht geschlossene Mobile-Menüs erneut',()=>{
  assert.match(helper,/async function activateNavigationTarget\(/);
  assert.match(helper,/data-exporthub-view/);
  assert.match(helper,/attempts:/);
  assert.match(helper,/continue attempts/);
  assert.match(helper,/if\(responsiveViewport\(page\)\)menuOpened=/);
});

test('RC1156: fehlgeschlagener Klick wird nicht als erfolgreicher View-Wechsel akzeptiert',()=>{
  assert.match(helper,/if\(!changed\)return false/);
  assert.match(helper,/if\(await activateNavigationTarget\(page,item,module,requiredText\)\)return module/);
});
