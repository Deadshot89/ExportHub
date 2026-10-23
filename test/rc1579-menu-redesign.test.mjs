import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const js=fs.readFileSync('assets/rc1579-menu-redesign.js','utf8');
const css=fs.readFileSync('assets/rc1579-menu-redesign.css','utf8');
const i18n=fs.readFileSync('assets/i18n/rc1579-menu-redesign.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function load(){
  const noop=()=>{};
  const doc={readyState:'complete',addEventListener:noop,getElementById:()=>null,querySelector:()=>null,documentElement:{}};
  const win={addEventListener:noop,requestAnimationFrame:noop,setTimeout:noop,localStorage:null};
  vm.runInNewContext(i18n,{window:win});
  vm.runInNewContext(js,{window:win,document:doc,setInterval:()=>0,clearInterval:noop,setTimeout:noop,encodeURIComponent});
  return win;
}
function canonicalViews(file){
  const html=fs.readFileSync(file,'utf8');
  const m=html.match(/var ITEMS=\[([\s\S]*?)\n\];/);
  assert.ok(m,file+': RC325 ITEMS fehlen');
  return [...m[1].matchAll(/view:'([a-z]+)'/g)].map(x=>x[1]);
}
// Menüpunkte, die andere Module zur Laufzeit ergänzen (Aufgabenansicht, Abholkalender, Historie, Packmeldungen) und die Verpackungsverwaltung
const RUNTIME_VIEWS=['taskdetail','pickupcalendar','history','packnotifications','packaging'];

test('RC1579: jeder Menüpunkt hat genau einen Bereich und ein Icon',()=>{
  const menu=load().ExportHUBMenu1579;
  assert.ok(menu,'ExportHUBMenu1579 fehlt');
  const seen=new Map();
  for(const s of menu.sections)for(const v of s.views){assert.ok(!seen.has(v),v+' doppelt in '+seen.get(v)+' und '+s.key);seen.set(v,s.key)}
  for(const file of ['index.html','TESTVERSION.html'])for(const v of [...canonicalViews(file),...RUNTIME_VIEWS]){
    assert.ok(seen.has(v),file+': '+v+' ist keinem Bereich zugeordnet');
    assert.ok(menu.icons.includes(v),file+': '+v+' hat kein Icon');
  }
  for(const s of menu.sections.filter(s=>s.key!=='start'))assert.ok(menu.icons.includes('section-'+s.key),s.key+': Bereichs-Icon fehlt');
});

test('RC1579: Menüknöpfe werden nicht verschoben, nur per CSS geordnet',()=>{
  // RC325 menuValid erwartet die kanonische Reihenfolge direkt in #nav
  assert.doesNotMatch(js,/replaceChildren|insertBefore|insertAdjacentElement/);
  assert.match(js,/order:'\+/);
  assert.doesNotMatch(js,/querySelectorAll\([^)]*button[^)]*\)\.forEach\(function\(b\)\{[^}]*\.remove\(\)/,'Menüknöpfe dürfen nicht entfernt werden');
  // Kopfzeilen sind keine <button>, damit Rechte-, Mobil- und Legacy-Logik sie nicht als Menüpunkt behandeln
  assert.match(js,/createElement\('div'\);h\.className='rc1579-section'/);
  assert.match(js,/setAttribute\('role','button'\)/);
});

test('RC1579: Einklappen greift nur, wenn das Skript bereit ist',()=>{
  assert.match(js,/R=N\+'\[data-rc1579-ready\]'/);
  assert.match(js,/R\+':not\(\[data-rc1579-open~="'\+s\.key\+'"\]\)>'\+item\+'\{display:none!important\}'/);
  const body=css.replace(/\/\*[\s\S]*?\*\//g,'');
  for(const rule of body.split('}').filter(r=>/display:none/.test(r)))assert.match(rule,/data-rc1579-ready|\[hidden\]|data-rc1579-packaging/,'Ausblenden ohne Bereitschaftsmarker: '+rule.trim());
});

test('RC1579: Bereichstexte in allen sechs Sprachen',()=>{
  const packs=load().ExportHUBMenu1579I18n.packs;
  const keys=Object.keys(packs.de).sort();
  for(const lang of ['de','en','pl','es','fr','it']){
    assert.deepEqual(Object.keys(packs[lang]||{}).sort(),keys,lang+': Schlüssel weichen ab');
    for(const k of keys)assert.ok(String(packs[lang][k]).trim(),lang+'.'+k+' leer');
  }
});

test('RC1579: Build bindet Menü-CSS, Texte und Skript ein und kopiert sie',()=>{
  assert.match(build,/function patchRc1579Menu\(html,file\)/);
  assert.match(build,/html=patchRc1577OverviewCompact\(html,file\);\n  html=patchRc1579Menu\(html,file\);/);
  for(const rel of ['assets/rc1579-menu-redesign.css','assets/rc1579-menu-redesign.js','assets/i18n/rc1579-menu-redesign.js'])assert.ok(build.includes(`'${rel}'`),rel+' wird nicht kopiert');
});

test('RC1579: Verpackungen-Knopf in #nav wird ins Admin-Menü einsortiert statt doppelt angezeigt',()=>{
  // RC1555 legt den Knopf mit data-index321-view="packagingmasterdata" direkt in #nav ab
  assert.match(js,/:is\(\[data-rc1579-proxy="packaging"\],\[data-rc1555-packaging-nav\]\)/);
  assert.match(js,/if\(!real\|\|real\.parentNode===nav\)\{if\(proxy\)proxy\.remove\(\)/);
  assert.match(js,/SECTION_OF\.packagingmasterdata='admin'/);
  // Menüknöpfe ohne data-view (nur data-index321-view) bekommen ebenfalls Reihenfolge und Icon
  assert.match(js,/:is\(\[data-view="'\+v\+'"\],\[data-index321-view="'\+v\+'"\]\)/);
});

test('RC1579: gesperrte Menüpunkte bleiben unsichtbar, auch Stellvertreter mit inline display',()=>{
  // RC325 setzt hidden und aria-hidden; copyLook setzt display:flex inline und darf das nicht aushebeln
  assert.match(js,/out\.push\(N\+'>\[hidden\],'\+N\+'>button\[aria-hidden="true"\]\{display:none!important\}'\)/);
});

test('RC1579: Benutzerwechsel wendet die Menürechte sofort neu an',()=>{
  // ohne das bleibt nach der Anmeldung der Menüstand des vorherigen Benutzers (z. B. Administrator) stehen
  assert.match(js,/function applyRights\(\)\{/);
  assert.match(js,/ExportHUBRC325\.buildMenu\(\)/);
  assert.match(js,/applyRights\(\);\n syncing=true;/);
  assert.match(js,/setInterval\(function\(\)\{if\(userSig\(\)!==lastUserSig\)schedule\(\)\},1000\)/);
});
