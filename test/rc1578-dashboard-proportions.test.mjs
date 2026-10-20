import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('assets/rc1558-dashboard-overview.css','utf8').replace(/\r\n/g,'\n');
const FIT='html body[data-rc1558-overview="1"][data-rc1569-fit="1"] #content#content#content:not([data-rc1371-editing="1"])';
const block=css.slice(css.indexOf('/* RC1578'));

test('RC1578 Kachelzeile bekommt einen begrenzten Anteil, die Übersicht den Rest',()=>{
  assert.ok(css.indexOf('/* RC1578')>css.indexOf('/* RC1575'),'überschreibt die 3:2-Aufteilung aus RC1575');
  assert.ok(block.includes(FIT+'{grid-template-rows:minmax(0,1fr) clamp(160px,28%,260px)!important}'));
  assert.match(block,/@media \(max-height:820px\)\{\n  [^\n]*\{grid-template-rows:minmax\(0,1fr\) clamp\(130px,30%,200px\)!important\}/);
});

test('RC1578 Listen der Übersicht verteilen wenige Zeilen nicht über die ganze Höhe',()=>{
  assert.ok(block.includes(FIT+' .rc1558-list{align-content:start!important}'));
});
