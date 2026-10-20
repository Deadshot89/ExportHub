import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('assets/rc1555-packaging-management.js','utf8');
const fn=name=>{const start=js.indexOf(`function ${name}(`);assert.ok(start>=0,`${name} missing`);return js.slice(start,js.indexOf('\n',start));};

test('Verpackungen sits in the Management/Administration group of #nav, not below the user card',()=>{
  const anchor=fn('managementAnchor');
  assert.match(anchor,/getElementById\('nav'\)|menu\(\)/,'anchor discovery must be scoped to the #nav menu');
  assert.match(anchor,/data-index321-view=\\?"rights\\?"/,'Verpackungen belongs right after Benutzer & Rechte');
  assert.match(fn('managementGroup'),/data-index308-group/,'fallback must use the Administration group header');
  assert.match(fn('managementGroup'),/management/);
  const place=fn('placeNav');
  assert.match(place,/insertAdjacentElement\('afterend',button\)/);
  assert.doesNotMatch(js,/\.sidebar,\.app-sidebar,#sidebar/,'the sidebar itself must never be used as host (it appends below the profile card)');
  assert.doesNotMatch(fn('ensureNav'),/wrap\.className='rc1555-packaging-nav-wrap'/,'the loose Stammdaten wrap below the menu is gone');
});

test('Verpackungen looks like every other menu entry',()=>{
  const decorate=fn('decorateNav');
  assert.match(decorate,/index308-nav-icon/);
  assert.match(decorate,/index308-nav-label/);
  assert.match(decorate,/tr\('packaging\.masterdata\.nav'\)/,'label stays translated');
  assert.match(fn('ensureNav'),/data-index321-view','packagingmasterdata'/,'canonical menu marker for the shared nav styles');
  assert.match(fn('navCss'),/>button\[data-rc1555-packaging-nav\]'/);
  assert.match(fn('navCss'),/P\+':not\(\[hidden\]\)\{display:flex!important/,'same flex row as index305 entries');
  assert.match(fn('ensureNav'),/if\(!globalAdmin\(\)\)\{if\(button\)button\.hidden=true;return null;\}/,'still admin-only');
});

test('Verpackungen survives menu rebuilds and opens through the app router',()=>{
  assert.match(fn('observeMenu'),/observe\(nav,\{childList:true\}\)/,'menu rebuild (replaceChildren) must re-insert the entry; observer scoped to #nav');
  assert.doesNotMatch(js,/observe\(doc\.body,\{[^}]*childList/,'no body-wide subtree observer');
  assert.match(fn('onViewChange'),/view==='packagingmasterdata'/);
  assert.match(fn('onViewChange'),/open\(\)/);
  assert.match(fn('observeView'),/attributeFilter:\['data-exporthub-view'\]/);
  assert.match(fn('close'),/leaveView\(\)/,'closing returns to the previous view');
  assert.match(js,/addEventListener\('click',navClick,true\)/,'fallback click handler without router');
});
