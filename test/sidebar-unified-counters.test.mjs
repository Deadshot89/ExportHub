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
