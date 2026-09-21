import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1114-shipping-neutral.js','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function api(){
  const window={addEventListener(){},setTimeout(){},requestAnimationFrame(){}};
  const document={readyState:'loading',addEventListener(){},documentElement:{},getElementById(){return null}};
  const context={window,document,console,MutationObserver:undefined};
  vm.runInNewContext(runtime,context,{filename:'rc1114-shipping-neutral.js'});
  return window.ExportHUBRC1114ShippingNeutral;
}

test('RC1114: Gate41 verschwindet aus sichtbaren Versandkostentexten',()=>{
  const a=api();
  assert.equal(a.version,'RC1114.1');
  const samples=[
    ['Paletten – Gate41','Paletten / Maut'],
    ['Gate41-Ergebnis','Paletten-/Maut-Ergebnis'],
    ['Gate41-Stammdaten Deutschland','Paletten- und Maut-Stammdaten Deutschland'],
    ['Gate41-Stammdaten speichern','Paletten-/Maut-Stammdaten speichern'],
    ['Kein passender Gate41-Tarif hinterlegt','Kein passender Palettentarif hinterlegt']
  ];
  for(const [input,expected] of samples){
    const out=a.replaceText(input);
    assert.equal(out.includes('Gate41'),false,input+' darf Gate41 nicht mehr sichtbar enthalten');
    assert.match(out,new RegExp(expected.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&')));
  }
});

test('RC1114.1: redundante Hinweise in Versandkosten werden ausgeblendet',()=>{
  const a=api();
  assert.equal(a.shouldSuppressNotice('Aus geöffneter Sendung: J6U8AT · 9000003001 · Essentra Components S.L.U.'),true);
  assert.equal(a.shouldSuppressNotice('Paletten / Maut: Start- und Zielort müssen vollständig angegeben sein, bevor ein belastbarer Preis angezeigt werden kann.'),true);
  assert.equal(a.shouldSuppressNotice('Gate41: Start- und Zielort müssen vollständig angegeben sein, bevor ein belastbarer Preis angezeigt werden kann.'),true);
  assert.equal(a.shouldSuppressNotice('UPS-Ergebnis'),false);
  assert.equal(a.shouldSuppressNotice('Paletten-/Maut-Ergebnis'),false);
});

test('RC1114: UPS-Begriffe bleiben unverändert',()=>{
  const a=api();
  assert.equal(a.replaceText('Pakete – UPS'),'Pakete – UPS');
  assert.equal(a.replaceText('UPS-Ergebnis'),'UPS-Ergebnis');
});

test('RC1114: RC1112-Builder liefert die neutrale Oberfläche in alle drei Umgebungen aus',()=>{
  assert.match(builder,/rc1114-shipping-neutral\.js\?v=1114/);
  assert.match(builder,/fs\.copyFileSync\(rc1114ShippingSrc,rc1114ShippingOut\)/);
  assert.match(builder,/shippingProviderNeutralUi:'RC1114'/);
});
