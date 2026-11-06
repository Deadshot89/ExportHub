import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('assets/rc1821-design-neu.css','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const topnav=fs.readFileSync('assets/rc1820-top-navigation.css','utf8');

test('RC1821: Design Neu ist nur bei Menü oben aktiv und ändert keine Abläufe',()=>{
  const rules=css.replace(/\/\*[\s\S]*?\*\//g,'').match(/[^{}@]+\{[^{}]*\}/g)||[];
  for(const r of rules){
    const sel=r.slice(0,r.indexOf('{')).trim();
    if(/^(from|to|\d+%)$/.test(sel))continue;
    if(sel.startsWith('#rc383TopPair#rc383TopPair'))continue; // Handy-Fix für alle Designs
    assert.match(sel,/html\[data-eh-layout="top"\] body\[data-eh-layout="top"\]/,sel);
  }
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g,''),/[{;]\s*display\s*:\s*none/,'keine Elemente ausblenden');
});

test('RC1821: Sendungsübersicht trennt Status durch Farben und klare Kachelgrenzen',()=>{
  for(const k of ['entwurf','erstellt','inbearbeitung','wartetabd','offen','nachbearbeitung','bereit','abgeholt','pod','abgeschlossen','archiviert','storniert'])
    assert.match(css,new RegExp(`\\[data-status-key="${k}"\\][^{]*\\{--n-st:#`),k);
  assert.match(css,/article\.rc524-shipment-card\{[^}]*border-top:6px solid var\(--n-st/);
  assert.match(css,/\.rc543-overview-group-head\{[^}]*border-left:6px solid var\(--n-st/);
});

test('RC1821: Formularlayer wird über @layer rc971 mit drei ids übertroffen',()=>{
  assert.match(css,/@layer rc971\{/);
  assert.match(css,/#content#content#content :is\(\.btn,\.ghost,\.soft,\.danger\)/);
});

test('RC1821: volle Breite und Builder bindet das Stylesheet ein',()=>{
  assert.match(topnav,/main\.main\{width:auto!important;max-width:none!important/);
  assert.match(builder,/rc1821-design-neu\.css\?v=1821/);
  assert.match(builder,/'assets\/rc1821-design-neu\.css'/);
  assert.match(builder,/RC1821 Design Neu fehlt/);
});
