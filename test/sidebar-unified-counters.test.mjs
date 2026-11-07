import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('assets/rc1579-menu-redesign.css','utf8');
const premium=fs.readFileSync('assets/rc1800-premium-design.css','utf8');
const nav=fs.readFileSync('assets/pack-notification-nav.js','utf8');
const pack=fs.readFileSync('assets/pack-notification-internal.js','utf8');
const notifications=fs.readFileSync('assets/rc1872-unified-notifications.js','utf8');

test('Sidebar-Kennzahlen benutzen einen gemeinsamen lesbaren Zähler',()=>{
  assert.match(css,/Einheitliche, kontraststarke Zähler/);
  for(const selector of ['data-pack-notifications-nav','data-exporthub-urgent-nav','data-view="notifications"','.pack-internal-nav-badge','.urgent-nav-count','.eh1872-nav-warning']){
    assert.ok(css.includes(selector),selector+' muss im gemeinsamen Zählerstil stehen');
  }
  assert.match(css,/font:800 14px\/1\.1/);
  assert.match(css,/background:#b42318!important/);
  assert.match(css,/color:#fff!important/);
  assert.match(css,/min-width:28px!important/);
  assert.match(css,/text-shadow:none!important/);
  assert.match(css,/@media\(max-width:1100px\)/);
  assert.match(css,/position:absolute!important/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/\[hidden\]\s*\{\s*display:none!important/);
});

test('Anzeige 0 bleibt neutral, Zähl- und Seitenlogik unangetastet',()=>{
  assert.match(css,/\.urgent-nav-count\[data-has-open="false"\]/);
  assert.match(css,/background:#e2e8f0!important/);
  assert.match(css,/color:#334155!important/);
  assert.match(nav,/\[data-urgent-open-count\]/);
  assert.match(pack,/inboxUnreadCount\(sharedState\(\)\)/);
  assert.match(notifications,/data-eh1872-nav-warning/);
});

// Screenshot regression: Premium/Neu previously painted the red counters dark
// because the blanket menu-text rule inherited the button's foreground.
test('Premium/Neu: rote Menü-Zähler behalten weiße Zahlen statt dunkler Vererbung',()=>{
  const blanket=premium.match(/#nav#nav#nav\[data-rc1579-ready\]>button:not\(\[data-exporthub-urgent-nav\]\) :not\(\.index308-nav-icon\)([^{}]+)\{color:inherit!important\}/);
  assert.ok(blanket,'Premium-Menüregel muss lesbare Ausnahmen berücksichtigen');
  assert.match(blanket[1],/:not\(:is\(/,'Menüfarbe darf nicht blind auf jeden Badge übertragen werden');
  for(const name of ['.pack-internal-nav-badge','.eh1872-nav-warning','.index236-notification-count','.index236-nav-badge','#index236NotificationCount','.notification-count','.nav-count']){
    assert.ok(blanket[1].includes(name),'Premium darf '+name+' nicht überschreiben');
  }
  assert.match(css,/#b42318!important/);
  assert.match(css,/color:#fff!important/);
  assert.match(css,/\.urgent-nav-count\[data-has-open="false"\]/);
  assert.match(css,/color:#334155!important/);
});

test('Premium/Neu: Urgent Order hat dieselbe normale Schriftstärke wie andere Menüpunkte',()=>{
  const rule=premium.match(/#nav\.nav>button\[data-exporthub-urgent-nav\]\[data-urgent-nav-design\]\{([^}]+)\}/);
  const label=premium.match(/#nav\.nav>button\[data-exporthub-urgent-nav\] \.urgent-orders-nav-label\{([^}]+)\}/);
  assert.ok(rule&&label,'Urgent Order und seine Beschriftung brauchen die Premium-Stilregeln');
  assert.match(rule[1],/font-weight:500!important/);
  assert.match(label[1],/font-weight:500!important/);
  assert.doesNotMatch(rule[1]+label[1],/font-weight:(?:650|700|800|900)/);
  assert.match(premium,/#nav#nav#nav\[data-rc1579-ready\]>button:not\(\[data-exporthub-urgent-nav\]\)\{[^}]*font-weight:500!important/);
});

test('Premium/Neu: sanfte rote und graue Zähler bleiben unterscheidbar und lesbar',()=>{
  const start=premium.indexOf('RC1907: Entspannte Zähler');
  assert.ok(start>0,'Premium-Zählerfarben müssen explizit definiert sein');
  const block=premium.slice(start,premium.indexOf('/* 13',start));
  for(const selector of ['.pack-internal-nav-badge','.urgent-nav-count','.eh1872-nav-warning','data-view="notifications"']){
    assert.ok(block.includes(selector),selector+' muss denselben sanften Zählerstil nutzen');
  }
  assert.match(block,/background:#fee4e2!important/);
  assert.match(block,/color:#b42318!important/);
  assert.match(block,/background:#f1f5f9!important/);
  assert.match(block,/color:#475569!important/);
  assert.match(block,/\.urgent-nav-count\[data-has-open="false"\]/);
  assert.match(block,/\[data-count="0"\]/);
});
