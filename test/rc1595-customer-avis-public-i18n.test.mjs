import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const LANGS=['de','en','pl','es','fr','it'];
const packs=Object.fromEntries(LANGS.map(lang=>[
  lang,JSON.parse(fs.readFileSync('assets/i18n/'+lang+'.json','utf8'))
]));
const html=fs.readFileSync('customer-avis.html','utf8');
const runtime=fs.readFileSync('assets/rc1267-i18n.js','utf8');
const prefix='customerAvis.public.';
const required=[
  'referencePrompt','accessDescription','secureLinkBadge','retentionBadge',
  'noLoginBadge','referenceLabel','checking','sessionFailed','accessFailed',
  'noPackages','malwareCheck','shipmentDataCheck','documentTypeCheck',
  'saveAfterChecks','chooseDateFirst','noFreeSlots','slotsLoadFailed'
];

test('RC1595: all 17 customer-Avis access, safety and slot texts have genuine six-language translations',()=>{
  const actual=Object.keys(packs.de).filter(key=>key.startsWith(prefix)).sort();
  assert.deepEqual(actual,required.map(key=>prefix+key).sort());
  for(const suffix of required){
    const key=prefix+suffix,german=packs.de[key];
    assert.ok(typeof german==='string'&&german.trim(),'missing German source: '+key);
    assert.ok(html.includes(german),'customer Avis does not contain German source: '+key);
    for(const lang of LANGS){
      const value=packs[lang][key];
      assert.ok(typeof value==='string'&&value.trim(),lang+' missing '+key);
      if(lang!=='de')assert.notEqual(value,german,lang+' must not display German for '+key);
      assert.deepEqual([...value.matchAll(/\{\{[\w.-]+\}\}/g)].map(x=>x[0]).sort(),
        [...german.matchAll(/\{\{[\w.-]+\}\}/g)].map(x=>x[0]).sort(),
        lang+' placeholder mismatch '+key);
    }
  }
});

test('RC1595: public customer-Avis still uses the translation observer and protected business endpoints',()=>{
  assert.match(html,/src="\/assets\/rc1267-i18n\.js\?v=1267"/);
  assert.match(runtime,/function buildSourceIndex\(/);
  assert.match(runtime,/sourceByText\[value\]=key/);
  assert.match(runtime,/function translateLegacyValue\(/);
  assert.match(runtime,/observer\.observe\(d\.body,\{subtree:true,childList:true\}\)/);
  assert.match(html,/\/api\/customer-avis/);
  assert.match(html,/action:'authorize'/);
  assert.match(html,/action:'appointment'/);
  assert.match(html,/customer-upload/);
  assert.match(html,/referrer" content="no-referrer"/);
  assert.match(html,/noindex,nofollow,noarchive/);
});

test('RC1595: verified pickup safety instructions are retained and already translated',()=>{
  const samples=[
    '⚠ Sicherheitsvorschriften für die Abholung',
    '• Zutritt zum Gelände nur mit Sicherheitsschuhen.',
    '• Das Tragen einer Sicherheitsweste ist verpflichtend.',
    '• Die Sendungsreferenz / Referenznummer muss bei der Abholung angegeben werden.'
  ];
  for(const german of samples){
    assert.ok(html.includes(german));
    const key=Object.keys(packs.de).find(key=>packs.de[key]===german);
    assert.ok(key,'original pickup safety text has no translation key: '+german);
    for(const lang of LANGS)assert.ok(packs[lang][key]?.trim(),lang+' missing safety text '+key);
  }
});
