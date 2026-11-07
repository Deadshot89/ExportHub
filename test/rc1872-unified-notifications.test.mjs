import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ui=fs.readFileSync('assets/rc1872-unified-notifications.js','utf8');
const top=fs.readFileSync('assets/rc1820-top-navigation.js','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const html=fs.readFileSync('index.html','utf8');

test('RC1872: exactly one visible destination, preserving both canonical data engines',()=>{
  assert.match(ui,/#rc885WarningButton/);
  assert.match(ui,/#rc885WarningDrawer/);
  assert.match(ui,/display:none!important/);
  assert.match(ui,/getElementById\('index236NotificationCenter'\)/);
  assert.match(ui,/__EXPORTHUB_WARNING_SUMMARY__/);
  assert.match(ui,/data-eh1872-warning-content/);
  assert.match(ui,/data-rc885-route/);
  assert.match(ui,/shipmentoverview/);
  assert.match(ui,/role','tablist'/);
  assert.match(ui,/role','tab'/);
  for(const v of ["['all',l.all]","['warnings',l.warnings]","['tasks',l.tasks]"])
    assert.ok(ui.includes(v),v+' missing');
  assert.match(html,/id='rc885WarningButton'/);
  assert.match(html,/window\.__EXPORTHUB_WARNING_SUMMARY__/);
  assert.match(html,/id="index236NotificationCenter"/);
  assert.match(ui,/lastWarningCount=-1/);
  assert.doesNotMatch(ui,/\.tasks\s*=|\.shipments\s*=|\.warnings\s*=|\.notificationCenter\s*=/);
});

test('RC1872: warning text is added as DOM text, not executable shipment HTML',()=>{
  assert.match(ui,/node\('strong',null,item\.title\|\|g\.label\)/);
  assert.match(ui,/node\('small',null,item\.sub\)/);
  assert.match(ui,/function node\(tag,cls,value\)/);
  assert.match(ui,/el\.textContent=String\(value\)/);
  assert.doesNotMatch(ui,/\binnerHTML\s*=/);
  assert.match(ui,/items\.slice\(0,60\)/);
  assert.match(ui,/if\(!\(Number\(g&&g\.count\)>0\)\)return/);
});

test('RC1872: one bell totals warnings + personal tasks without altering the task metric',()=>{
  assert.match(top,/warningCount=Math\.max\(0,Number\(w\.__EXPORTHUB_WARNING_SUMMARY__/);
  assert.match(top,/c=tasks\+warningCount/);
  assert.match(top,/m\.notifications\.getAttribute\('data-index236-notification-count'\)/);
  assert.match(ui,/data-eh1872-nav-warning/);
  assert.doesNotMatch(ui,/setAttribute\('data-index236-notification-count'/);
});

test('RC1872: UI is included in all release bundles, six languages and old warning engines remain',()=>{
  assert.equal((builder.match(/assets\/rc1872-unified-notifications\.js/g)||[]).length,2);
  assert.match(builder,/injectDeferredRuntimeInHead\(html,'<script id="exporthub-rc1872-unified-notifications"/);
  assert.match(builder,/for\(const file of \['index\.html','TESTVERSION\.html','demo\.html'\]\)/);
  for(const code of ['de','en','pl','es','fr','it'])
    assert.match(ui,new RegExp('(?:^|\\s)'+code+':\\{'));
  assert.match(ui,/exporthub:languagechange/);
  assert.match(ui,/exporthub:warnings-updated/);
  assert.match(ui,/if\(rootObserver\)rootObserver\.disconnect\(\)/);
});

test('RC1872: script syntax and no side effects before application initialization',()=>{
  assert.doesNotThrow(()=>new Function(ui));
  assert.doesNotThrow(()=>new Function(top));
  const listeners=[];
  const win={addEventListener:(name)=>listeners.push(name),ExportHUBI18n:{language:()=> 'de'}};
  const doc={readyState:'loading',addEventListener:(name)=>listeners.push(name)};
  vm.runInNewContext(ui,{window:win,document:doc});
  assert.equal(win.ExportHUBUnifiedNotifications1872.version,'RC1872');
  assert.ok(listeners.includes('DOMContentLoaded'));
  assert.ok(listeners.includes('exporthub:warnings-updated'));
});
