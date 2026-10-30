import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('Phase 2 (30.10.2026): seltene Aktionen stehen in beiden Seiten im Menü „Mehr“, Abmelden bleibt sichtbar',()=>{
  for(const file of ['index.html','TESTVERSION.html']){
    const html=read(file);
    const menu=html.slice(html.indexOf('<details class="eh-topbar-more" id="ehTopbarMore">'),html.indexOf('</details>',html.indexOf('id="ehTopbarMore"')));
    assert.ok(menu.length>100,file+': Menü „Mehr“ fehlt');
    for(const id of ['podBackupBtn','backupBtn','importBtn','importFile','printBtn'])assert.match(menu,new RegExp(`id="${id}"`),`${file}: ${id} gehört ins Menü`);
    assert.doesNotMatch(menu,/id="logoutBtn"/,file+': Abmelden muss direkt sichtbar bleiben');
    assert.equal((html.match(/id="podBackupBtn"/g)||[]).length,1,file+': POD-Sicherung doppelt');
  }
});

test('Phase 2: Menü schließt nach Aktion, bei Klick daneben und mit Escape; Kopfzeile ab 901px einzeilig',()=>{
  const js=read('assets/rc1304-theme-switcher.js');
  assert.match(js,/function closeMoreMenu\(/);
  assert.match(js,/event\.key!=='Escape'/);
  assert.match(js,/\.eh-topbar-more-menu button/);
  const css=read('assets/rc1304-theme-switcher.css');
  assert.match(css,/@media \(min-width:901px\)\{\s*html\[data-eh-design\] body\[data-eh-theme\]\[data-eh-theme\] \.topbar\{display:flex!important;flex-wrap:nowrap!important/);
  assert.match(css,/@media \(max-width:900px\)\{\s*html\[data-eh-design\] body\[data-eh-theme\] \.topbar \.eh-topbar-more\{display:none!important\}/);
});

test('Phase 2: „Mehr“ und „Weitere Aktionen“ sind in allen sechs Sprachen übersetzt',()=>{
  for(const lang of ['de','en','pl','es','fr','it']){
    const pack=JSON.parse(read(`assets/i18n/${lang}.json`));
    assert.ok(pack['legacyUi.v2.topbar.more'],lang);
    assert.ok(pack['legacyUi.v2.topbar.moreActions'],lang);
  }
});
