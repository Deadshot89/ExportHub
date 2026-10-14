import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('assets/rc1304-theme-switcher.css','utf8');
const marker='RC1532 THEME COMPLETION PASS';

function completionCss(){
  const start=css.indexOf(marker);
  assert.ok(start>=0,`${marker} fehlt`);
  return css.slice(start);
}

test('RC1532: completion pass remains outside Klassisch',()=>{
  const completion=completionCss();
  assert.match(completion,/html\[data-eh-design\]:not\(\[data-eh-design="classic"\]\)/);
  assert.match(completion,/html\[data-eh-design="modern"\]/);
  assert.match(completion,/html\[data-eh-design="glass"\]/);
  assert.match(completion,/html\[data-eh-design="neon"\]/);
  assert.doesNotMatch(completion,/html\[data-eh-design="classic"\]\s/);
  assert.doesNotMatch(completion,/body\[data-eh-theme\]\[data-eh-design="classic"\]/);
});

test('RC1532: native controls and interactive states are fully themed',()=>{
  const completion=completionCss();
  assert.match(completion,/input\[type="checkbox"\]/);
  assert.match(completion,/input\[type="radio"\]/);
  assert.match(completion,/\[role="switch"\]/);
  assert.match(completion,/:focus-visible/);
  assert.match(completion,/\[aria-disabled="true"\]/);
  assert.match(completion,/:disabled/);
  assert.match(completion,/input\[type="date"\]/);
  assert.match(completion,/input\[type="datetime-local"\]/);
});

test('RC1532: menus overlays upload and feedback surfaces no longer fall back to legacy styling',()=>{
  const completion=completionCss();
  assert.match(completion,/\.dropdown-menu/);
  assert.match(completion,/\.context-menu/);
  assert.match(completion,/\.popover/);
  assert.match(completion,/\[role="menu"\]/);
  assert.match(completion,/\[role="listbox"\]/);
  assert.match(completion,/\.tooltip/);
  assert.match(completion,/\[role="tooltip"\]/);
  assert.match(completion,/\.dropzone/);
  assert.match(completion,/\.upload-zone/);
  assert.match(completion,/\.upload-area/);
  assert.match(completion,/input\[type="file"\]/);
});

test('RC1532: operational status loading reporting and secondary navigation are themed',()=>{
  const completion=completionCss();
  assert.match(completion,/\.okbox/);
  assert.match(completion,/\.badbox/);
  assert.match(completion,/\.notice/);
  assert.match(completion,/\.infobox/);
  assert.match(completion,/progress/);
  assert.match(completion,/\.spinner/);
  assert.match(completion,/\.loader/);
  assert.match(completion,/\.skeleton/);
  assert.match(completion,/\.chart-container/);
  assert.match(completion,/\.report-chart/);
  assert.match(completion,/\.pagination/);
  assert.match(completion,/\.breadcrumb/);
  assert.match(completion,/details/);
  assert.match(completion,/summary/);
  assert.match(completion,/footer/);
});

test('RC1532: semantic colors stay independent from each theme accent',()=>{
  const completion=completionCss();
  assert.match(completion,/--eh-sem-success:#15803d/);
  assert.match(completion,/--eh-sem-warning:#b45309/);
  assert.match(completion,/--eh-sem-danger:#b91c1c/);
  assert.match(completion,/--eh-sem-info:#0369a1/);
  assert.match(completion,/\.okbox[\s\S]*var\(--eh-sem-success\)/);
  assert.match(completion,/\.badbox[\s\S]*var\(--eh-sem-danger\)/);
});

test('RC1532: each redesigned theme keeps a distinct component personality',()=>{
  const completion=completionCss();
  assert.match(completion,/html\[data-eh-design="modern"\][\s\S]*--eh-menu-radius:10px/);
  assert.match(completion,/html\[data-eh-design="glass"\][\s\S]*--eh-menu-radius:14px/);
  assert.match(completion,/html\[data-eh-design="neon"\][\s\S]*--eh-menu-radius:7px/);
  assert.match(completion,/html\[data-eh-design="modern"\][\s\S]*\.upload-zone/);
  assert.match(completion,/html\[data-eh-design="glass"\][\s\S]*\.dropdown-menu/);
  assert.match(completion,/html\[data-eh-design="neon"\][\s\S]*\.tooltip/);
});

test('RC1532: completion pass retains responsive safeguards',()=>{
  const completion=completionCss();
  assert.match(completion,/@media\(max-width:760px\)/);
  assert.match(completion,/\.dropdown-menu[\s\S]*max-width:calc\(100vw - 16px\)/);
  assert.match(completion,/\.chart-container[\s\S]*overflow-x:auto/);
  assert.match(completion,/\.pagination[\s\S]*flex-wrap:wrap/);
});
