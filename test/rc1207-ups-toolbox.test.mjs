import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function load(){const code=fs.readFileSync(new URL('../assets/rc1206-shipping-rules.js',import.meta.url),'utf8');const document={readyState:'loading',querySelector(){return null},addEventListener(){},documentElement:{}};const window={addEventListener(){}};const ctx={window,document,Event:function(){},setTimeout(){return 1},clearTimeout(){}};vm.createContext(ctx);vm.runInContext(code,ctx);return window.ExportHUBRC1206ShippingRules}
test('UPS Standard zones from 2026 toolbox',()=>{const x=load();assert.equal(x.resolveUpsZone('NL','5657 EA'),'3');assert.equal(x.resolveUpsZone('BE','1000'),'3');assert.equal(x.resolveUpsZone('FR','75001'),'4');assert.equal(x.resolveUpsZone('FR','20000'),'4');assert.equal(x.resolveUpsZone('IT','20100'),'4');assert.equal(x.resolveUpsZone('IT','90100'),'5');assert.equal(x.resolveUpsZone('PL','60000'),'31');assert.equal(x.resolveUpsZone('PL','93000'),'31');assert.equal(x.resolveUpsZone('CZ','11000'),'3');assert.equal(x.resolveUpsZone('IT','50999'),'4');assert.equal(x.resolveUpsZone('IT','51000'),'5');assert.equal(x.resolveUpsZone('AT','1010'),'4');assert.equal(x.resolveUpsZone('CH','8000'),'6');assert.equal(x.resolveUpsZone('SK','81101'),'31');assert.equal(x.resolveUpsZone('HU','1011'),'41')});
test('UPS Standard weight tiers from toolbox',()=>{const x=load();assert.equal(x.upsRate('3',1),7.93);assert.equal(x.upsRate('3',5),8.55);assert.equal(x.upsRate('3',30),27.71);assert.equal(x.upsRate('4',50),78.03);assert.equal(x.upsRate('31',70),88.93);assert.equal(x.upsRate('6',70),159.11);assert.equal(x.upsRate('3',71),0)});
test('carrier packaging rules remain separated',()=>{const s=fs.readFileSync(new URL('../assets/rc1206-shipping-rules.js',import.meta.url),'utf8');assert.match(s,/restrictPackaging\('ups',\/karton/);assert.match(s,/restrictPackaging\('gate',\/palette/)});

test('UPS postcode validation prevents silent wrong zones',()=>{const x=load();assert.equal(x.validUpsPostal('NL','5657 EA'),true);assert.equal(x.validUpsPostal('NL','5657'),false);assert.equal(x.validUpsPostal('BE','1000'),true);assert.equal(x.validUpsPostal('FR','75001'),true);assert.equal(x.validUpsPostal('FR','ABCDE'),false);assert.equal(x.validUpsPostal('GB','SW1A 1AA'),true)});


test('UPS postcode normalization handles spaces and hyphens before zone lookup',()=>{const x=load();assert.equal(x.validUpsPostal('NL','5657-EA'),true);assert.equal(x.resolveUpsZone('IT','50 999'),'4');assert.equal(x.resolveUpsZone('IT','51-000'),'5')});

test('UPS individual carton weights are rated separately',()=>{const x=load();const expected=x.upsRate('3',10)+x.upsRate('3',23)+x.upsRate('3',35);assert.equal(x.upsIndividualBase('3',[10,23,35]),Math.round(expected*100)/100);assert.notEqual(x.upsIndividualBase('3',[10,23,35]),x.upsRate('3',68/3)*3)});

test('UPS Standard export fuel is fixed to toolbox contract value',()=>{const x=load();assert.equal(x.fuelPct(),36);const base=27.71*3;assert.equal(Math.round(base*x.fuelPct())/100,29.93)});


test('RC1227: Italienische Zieladresse 60044 Albacina-Fabriano AN wird als Italien erkannt',()=>{const x=load();assert.equal(x.inferCountryFromAddress('60044 Albacina-Fabriano AN'),'IT');assert.equal(x.countryCode('Italia'),'IT');assert.equal(x.resolveUpsZone('IT','60044'),'5')});

test('RC1227: Ortskürzel MG bleibt weiterhin kein Länderkennzeichen',()=>{const x=load();assert.equal(x.inferCountryFromAddress('41189 Mönchengladbach MG'),'')});

test('RC1227: sichtbare UPS-Ausgabe kennzeichnet komplette Lieferung',()=>{const s=fs.readFileSync(new URL('../assets/rc1206-shipping-rules.js',import.meta.url),'utf8');assert.match(s,/Gesamtkosten komplette Lieferung/);assert.match(s,/Grundpreis komplette Lieferung/);assert.ok(s.includes("'Fuel '+pct.toFixed(2)+' % · komplette Lieferung'"))});
