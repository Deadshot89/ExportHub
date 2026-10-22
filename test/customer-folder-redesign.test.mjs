import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const css=fs.readFileSync('assets/customer-folder-redesign.css','utf8');
const js=fs.readFileSync('assets/customer-folder-redesign.js','utf8');
const layout=fs.readFileSync('assets/rc1306-layout-engine.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const cssBody=css.replace(/\/\*[\s\S]*?\*\//g,'');

test('Kundenordner: Build bindet Stylesheet und Skript nach RC1579 ein und kopiert beide mit',()=>{
  assert.match(build,/const CUSTOMER_FOLDER_STYLE_TAG='<link id="exporthub-customer-folder-style" rel="stylesheet" href="\/assets\/customer-folder-redesign\.css\?v=1">'/);
  assert.match(build,/const CUSTOMER_FOLDER_SCRIPT_TAG='<script id="exporthub-customer-folder-script" defer src="\/assets\/customer-folder-redesign\.js\?v=1"><\/script>'/);
  const a=build.indexOf('html=patchRc1579Menu(html,file);'),b=build.indexOf('html=patchCustomerFolderRedesign(html,file);');
  assert.ok(a>=0&&b>a,'Kundenordner-Redesign muss nach RC1579 gepatcht werden');
  assert.match(build,/'assets\/customer-folder-redesign\.css'/);
  assert.match(build,/'assets\/customer-folder-redesign\.js'/);
});

test('Kundenordner: jede Regel ist auf den Kundenordner begrenzt',()=>{
  const flat=cssBody.replace(/@media[^{]*\{/g,'').replace(/@layer[^{]*\{/g,'');
  for(const rule of flat.split('}').map(r=>r.trim()).filter(r=>r.includes('{'))){
    const selector=rule.slice(0,rule.indexOf('{'));
    for(const part of selector.split(/,(?![^(]*\))/).map(s=>s.trim()).filter(Boolean))
      assert.match(part,/#content(#content)*\[data-view="customerfolder"\]|^#cfNav|body\[data-exporthub-view="customerfolder"\]/,'nicht begrenzt: '+part.slice(0,90));
  }
});

test('Kundenordner: feste Abschnittsreihenfolge in allen Designs statt RC1306-Seitenspalte',()=>{
  assert.match(cssBody,/:is\(\.rc1306-generic-lead,\.rc1306-generic-body,\.rc1306-generic-primary,\.rc1306-generic-secondary\)\{display:contents!important\}/);
  const order=['master','mail','locations','contacts','portals','shipments','notes','pallet'].map(k=>{
    const m=cssBody.match(new RegExp(`\\[data-rc565-area="${k}"\\]\\{order:(\\d+)\\}`));
    assert.ok(m,'Reihenfolge fehlt für '+k);return +m[1];
  });
  assert.deepEqual([...order].sort((x,y)=>x-y),order,'Abschnitte müssen in fachlicher Reihenfolge stehen');
  assert.match(cssBody,/#rc565CustomerFolderSaveBar\{order:85\}/);
  assert.match(cssBody,/#rc565CustomerFolderSaveBar\{position:sticky!important;bottom:12px!important/);
});

test('Kundenordner: Feldbeschriftungen werden im RC971-Layer überschrieben (sonst in Neon unlesbar)',()=>{
  const layer=cssBody.slice(cssBody.indexOf('@layer rc971{'));
  assert.ok(cssBody.includes('@layer rc971{'),'Overrides müssen im Layer rc971 liegen');
  assert.match(layer,/#content#content#content\[data-view="customerfolder"\] :is\(\.rc405-section,\.rc565-own-info,\.rc1092-contact-card\) label\.field\{[^}]*color:var\(--cf-muted\)!important/);
  assert.match(layer,/\.rc565-template-grid textarea\{max-height:260px!important/);
});

test('Kundenordner: Laufzeit ist rein darstellend und speichert nie selbst',()=>{
  assert.doesNotMatch(js,/queueSave|flushSave|saveCustomerFolder\s*\(|fetch\s*\(|XMLHttpRequest|localStorage\.setItem/);
  assert.doesNotMatch(js,/\.value\s*=[^=]/,'Feldwerte dürfen nicht geschrieben werden');
  assert.doesNotMatch(js,/\.textContent\s*=(?!=)[^;]*h\b|h\.textContent=/,'Überschriftentexte bleiben unverändert (ältere Module suchen Abschnitte darüber)');
  assert.match(js,/setAttr\(h,'data-cf-num'/);
  assert.match(js,/setAttr\(h,'data-cf-title'/);
});

test('Kundenordner: alle sechs Sprachen haben dieselben Texte',()=>{
  const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};
  vm.runInNewContext(js.replace(/\}\)\(window,document\);\s*$/,'})(window,document);'),ctx);
  const packs=ctx.window.ExportHUBCustomerFolder.i18n;
  const keys=Object.keys(packs.de).sort();
  for(const l of ['de','en','pl','es','fr','it'])assert.deepEqual(Object.keys(packs[l]).sort(),keys,l);
});

test('RC1306: von einem Neu-Rendern abgehängte Knoten werden nicht zurückgeholt',()=>{
  const restore=layout.slice(layout.indexOf('function restoreNode(node){'),layout.indexOf('function restoreAll(){'));
  assert.match(restore,/if\(!node\.isConnected\)return false;/);
  assert.ok(restore.indexOf('isConnected')<restore.indexOf('appendChild'),'Prüfung muss vor dem Zurückhängen stehen');
  assert.match(build,/rc1306-layout-engine\.js\?v=1306\.1/,'Cache-Schlüssel muss erhöht sein, damit Browser die korrigierte Datei laden');
  assert.doesNotMatch(build,/rc1306-layout-engine\.js\?v=1306['"]/);
});
