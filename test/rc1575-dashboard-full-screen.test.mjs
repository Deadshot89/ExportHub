import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('assets/rc1558-dashboard-overview.css','utf8').replace(/\r\n/g,'\n');
const runtime=fs.readFileSync('assets/rc1558-dashboard-overview.js','utf8').replace(/\r\n/g,'\n');
const FIT='html body[data-rc1558-overview="1"][data-rc1569-fit="1"] #content#content#content:not([data-rc1371-editing="1"])';
const block=css.slice(css.indexOf('/* RC1575'));

test('RC1575 Übersicht und Kacheln teilen die ganze freie Höhe, die Seite scrollt nicht',()=>{
  assert.ok(block.includes(FIT+'{grid-template-rows:minmax(0,3fr) minmax(140px,2fr)!important;overflow:hidden!important}'),'3:2, wächst mit dem Bildschirm');
  assert.match(block,/@media \(max-height:820px\)\{\n  [^\n]*\{grid-template-rows:minmax\(0,2fr\) minmax\(120px,1fr\)!important\}/,'niedrige Bildschirme: Listen behalten Platz');
  assert.ok(block.includes(FIT+' > #rc1558Overview#rc1558Overview{min-height:0!important}'),'keine feste Mindesthöhe mehr, die das Scrollen erzwingt');
  assert.ok(block.includes(FIT+' .rc1558-stack .rc1558-list{min-height:0!important}'),'Listen scrollen innen');
  assert.ok(css.indexOf('/* RC1575')>css.indexOf('{grid-template-rows:minmax(400px,1fr)!important}'),'überschreibt die RC1572-Regel');
});

test('RC1575 Kacheln füllen ihre Zeile, Zahlen und Diagramme wachsen mit',()=>{
  // triple id beats the RC1306 rule #content > :is(section,.card,…):not(#loadListDoc){align-self:start}
  assert.ok(block.includes(FIT+' [data-rc1573-tile]{grid-row:2!important;align-self:stretch!important;height:auto!important;display:flex!important;flex-direction:column!important;flex-wrap:nowrap!important;container-type:size}'));
  assert.ok(block.includes('.rc205-widget{flex:1 1 auto;align-self:stretch!important;width:auto!important;'),'ABD/Palettenkonto über die ganze Kachelbreite');
  assert.match(block,/\.metric strong\{font-size:clamp\(22px,14cqh,44px\)!important\}/);
  assert.match(block,/\.rc1573-tile \.rc1573-bars\{flex:1 1 auto;min-height:60px\}/);
  assert.match(block,/\.rc205-quick-grid\{flex:1 1 0;min-height:0;grid-auto-rows:minmax\(30px,1fr\);overflow-y:auto\}/);
  assert.match(block,/@container \(max-width:240px\)\{\n  \.rc205-quick-card\[data-rc1573-tile\] \.rc205-quick > span\{display:none!important\}/,'schmale Kachel: Beschriftung statt Symbol');
});

test('RC1575 Ein-Seiten-Layout auch auf schmaleren Laptops und gezoomten Browsern',()=>{
  assert.match(runtime,/var FIT_MIN_WIDTH=1100,FIT_MIN_HEIGHT=360;/);
  assert.match(css,/@media \(min-width:1000px\) and \(max-height:820px\)\{/,'kompakte Stufe greift auch unter 1250px');
  assert.ok(block.includes(FIT+' .rc1558-kpis{grid-template-columns:repeat(6,minmax(0,1fr))!important}'),'Kennzahlen bleiben in einer Zeile');
});
