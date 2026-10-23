import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const LANGS=['de','en','pl','es','fr','it'];
const packs=Object.fromEntries(LANGS.map(l=>[l,JSON.parse(fs.readFileSync(`assets/i18n/${l}.json`,'utf8'))]));
const runtime=fs.readFileSync('assets/rc1267-i18n.js','utf8').replace(/\r\n/g,'\n');

function fn(name){
  const start=runtime.indexOf('\nfunction '+name+'(');
  assert.ok(start>=0,name+' fehlt');
  return runtime.slice(start+1,runtime.indexOf('\n}\n',start)+2);
}
function engine(){
  const ctx={resources:{...packs},sourceByText:Object.create(null),sourcePatterns:[],patternCache:new Map(),current:'de',SUPPORTED:LANGS,w:{dispatchEvent(){}},CustomEvent:class{}};
  vm.createContext(ctx);
  vm.runInContext(['q','normalize','interpolate','t','keyForSource','buildSourceIndex','patternForSource','translateLegacyValue'].map(fn).join('\n'),ctx);
  ctx.buildSourceIndex();
  return ctx;
}

test('Sprachpaket: Login-Texte werden in allen Sprachen übersetzt',()=>{
  const e=engine();
  assert.equal(e.translateLegacyValue('Produktion anmelden','en'),'Sign in to Production');
  assert.equal(e.translateLegacyValue('Microsoft-Konto wechseln','fr'),'Changer de compte Microsoft');
  assert.equal(e.translateLegacyValue('Benutzername wird von ExportHUB gemerkt. Das Passwort verwaltet ausschließlich der Browser-Passwortmanager.','en'),'ExportHUB remembers the username. The password is managed only by your browser’s password manager.');
  assert.equal(e.translateLegacyValue('LOGISTIK. VERNETZT.','it'),'LOGISTICA. CONNESSA.');
  for(const l of LANGS.slice(1))assert.notEqual(e.translateLegacyValue('Login-Daten auf diesem Gerät speichern',l),'Login-Daten auf diesem Gerät speichern',l);
});

test('Sprachpaket: Modultexte und Zahlenmuster aus dem Funktionstest',()=>{
  const e=engine();
  assert.equal(e.translateLegacyValue('🗂️ Sammelmodus','en'),'🗂️ Collection mode');
  assert.equal(e.translateLegacyValue('Benutzer und Rechte speichern','pl'),'Zapisz użytkownika i uprawnienia');
  assert.equal(e.translateLegacyValue('🚚 Sendung erstellen','es'),'🚚 Crear envío');
  assert.equal(e.translateLegacyValue('122 Einträge · 122 geändert','en'),'122 entries · 122 changed');
  assert.equal(e.translateLegacyValue('3 Sendungen · 6 Paletten · 6 Pakete','fr'),'3 envois · 6 palettes · 6 colis');
  assert.equal(e.translateLegacyValue('Ladeliste 2 als PDF herunterladen','en'),'Download loading list 2 as PDF');
  assert.equal(e.translateLegacyValue('Seite 1 / 3','it'),'Pagina 1 / 3');
});

test('Sprachpaket: Kundendaten und Vorlagentexte bleiben unverändert',()=>{
  const e=engine();
  assert.equal(e.translateLegacyValue('Waren laut Rechnung/Ladeliste','en'),'Waren laut Rechnung/Ladeliste','Warenbeschreibung ist Sendungsinhalt');
  assert.equal(e.translateLegacyValue('Fake Kunde Nord GmbH','en'),'Fake Kunde Nord GmbH');
  assert.equal(e.translateLegacyValue('Produktion anmelden','de'),'Produktion anmelden');
});

test('Design-Auswahl setzt den Tooltip bei jedem Sprachwechsel neu (kein Schlüssel als Tooltip)',()=>{
  const src=fs.readFileSync('assets/rc1304-theme-switcher.js','utf8');
  const options=src.slice(src.indexOf('function options('),src.indexOf('function replaceLegacySelect('));
  assert.match(options,/select\.title=tr\('theme\.select'\)/);
  assert.match(src,/'exporthub:language-changed'/);
});
