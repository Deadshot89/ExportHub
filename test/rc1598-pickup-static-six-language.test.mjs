import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const languages=['de','en','pl','es','fr','it'];
const dictionaries=Object.fromEntries(languages.map(lang=>[
  lang,JSON.parse(fs.readFileSync('assets/i18n/'+lang+'.json','utf8'))
]));
const pickup=fs.readFileSync('pickup.html','utf8');
const i18nRuntime=fs.readFileSync('assets/rc1267-i18n.js','utf8');
const prefix='pickup.static.';
const required=[
  'subtitle','recoveryHeading','recoveryDescription','loaderPin','recoveryButton',
  'stepbarLabel','stepShipment','stepCollis','stepContainer','stepDriver','stepConfirm',
  'colliHeading','firstRequired','totalCount','loadedColli','colliNext','colliInfo',
  'containerHelp','photoLoaded','photoNumber','photoSealed','noPhoto','photoSaveInfo',
  'driverAndVehicle','carrierName','returnPallets','digitalConfirmation',
  'customsReceived','customsHelp','driverSignature','tapSign','signatureAlt',
  'driverMandatory','partialConfirm','fullConfirm','signatureInstruction','saveSignature'
];

test('RC1598: all 37 actual pickup-screen labels have six-language translations with source fidelity',()=>{
  assert.deepEqual(Object.keys(dictionaries.de).filter(key=>key.startsWith(prefix)).sort(),
    required.map(name=>prefix+name).sort());
  const originals=new Set();
  for(const name of required){
    const key=prefix+name,german=dictionaries.de[key];
    assert.ok(typeof german==='string'&&german.trim(),key);
    assert.ok(pickup.includes(german),'source text missing in original pickup: '+key);
    assert.ok(!originals.has(german),'duplicate German source text '+german);
    originals.add(german);
    for(const lang of languages){
      const value=dictionaries[lang][key];
      assert.ok(typeof value==='string'&&value.trim(),lang+' missing '+key);
      if(lang!=='de'&&name!=='stepContainer')
        assert.notEqual(value,german,lang+' untranslated '+key);
    }
  }
});

test('RC1598: native German-source runtime translates pickup labels without replacing nested controls',()=>{
  assert.match(pickup,/src="\/assets\/rc1267-i18n\.js\?v=\d+"/);
  assert.match(i18nRuntime,/function buildSourceIndex\(/);
  assert.match(i18nRuntime,/sourceByText\[value\]=key/);
  assert.match(i18nRuntime,/function translateTextNode\(/);
  assert.match(i18nRuntime,/node\.nodeValue=lead\+translated\+trail/);
  assert.match(pickup,/<input id="colli"[^>]+>/);
  assert.match(pickup,/<input id="sealNumber"[^>]+>/);
  assert.match(pickup,/<input id="customsDocumentsConfirmed"[^>]+>/);
  assert.match(pickup,/<input id="signatureData" type="hidden">/);
  assert.match(pickup,/<button id="confirmPartial"[^>]+type="submit"/);
  assert.match(pickup,/<button id="confirm"[^>]+type="submit"/);
  assert.match(pickup,/pickup-confirm-v2/);
});

test('RC1598: neither customs workflow safety nor document-photograph prerequisites were relaxed',()=>{
  assert.match(pickup,/if\(mode==='complete'&&containerRequired&&!seal\)/);
  assert.match(pickup,/if\(mode==='complete'&&containerRequired&&\(!containerPhotos\.loaded\|\|!containerPhotos\.number\|\|!containerPhotos\.sealed\)\)/);
  assert.match(pickup,/if\(customsDocumentsRequired&&!customsConfirmed\)/);
  assert.match(pickup,/!checkColli\(mode\)/);
  assert.match(pickup,/!\/\^\\d\{4\}\$\/\.test\(pin\)/);
});
