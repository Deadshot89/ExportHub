import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const LANGS=['de','en','pl','es','fr','it'];
const packs=Object.fromEntries(LANGS.map(l=>[l,JSON.parse(fs.readFileSync(`assets/i18n/${l}.json`,'utf8'))]));
const runtime=fs.readFileSync('assets/rc1267-i18n.js','utf8').replace(/\r\n/g,'\n');
const legacyKeys=Object.keys(packs.de).filter(k=>/^legacy(Ui|Pattern)\./.test(k));
const placeholders=v=>(String(v).match(/\{\{\s*[\w.-]+\s*\}\}/g)||[]).map(s=>s.replace(/\s/g,'')).sort().join(',');

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

test('RC1567 jeder neue Altbestand-Schlüssel existiert in allen sechs Sprachen mit denselben Platzhaltern',()=>{
  assert.ok(legacyKeys.length>=120,'erwartet mindestens 120 Schlüssel, gefunden '+legacyKeys.length);
  for(const key of legacyKeys){
    for(const l of LANGS){
      assert.equal(typeof packs[l][key],'string',`${l}: ${key} fehlt`);
      assert.ok(packs[l][key].trim(),`${l}: ${key} ist leer`);
      assert.equal(placeholders(packs[l][key]),placeholders(packs.de[key]),`${l}: ${key} Platzhalter`);
    }
  }
});

test('RC1567 Altbestand-Texte werden exakt und über Muster mit Zahlen übersetzt',()=>{
  const e=engine();
  const tr=(s,l)=>e.translateLegacyValue(s,l);
  assert.equal(tr('Aufgaben Planer','en'),'Task planner');
  assert.equal(tr('25 offen','en'),'25 open');
  assert.equal(tr('Montag · 25','en'),'Monday · 25');
  assert.equal(tr('Heute (Sonntag) · 0','fr'),'Aujourd’hui (Dimanche) · 0');
  assert.equal(tr('1. Weihnachtstag · in 68 Tagen','es'),'Navidad · en 68 días');
  assert.equal(tr('Picken 11','it'),'Prelievo 11');
  assert.equal(tr('Dauerhaft in Azure bestätigt · 0,06 s','pl'),'Trwale potwierdzone w Azure · 0,06 s');
  assert.equal(tr('ExportHUB-Benutzer: Demo Administrator','en'),'ExportHUB user: Demo Administrator');
  assert.equal(tr('🏭Lager','en'),'🏭Warehouse');
});

test('RC1567 Muster lassen fremde Daten unverändert und Deutsch bleibt Deutsch',()=>{
  const e=engine();
  const tr=(s,l)=>e.translateLegacyValue(s,l);
  assert.equal(tr('Fake Kunde Nord GmbH','en'),'Fake Kunde Nord GmbH');
  assert.equal(tr('Fake Kunde Nord GmbH · DEMO01','en'),'Fake Kunde Nord GmbH · DEMO01');
  assert.equal(tr('Kunde Nord 3','en'),'Kunde Nord 3','nur bekannte Begriffe werden übersetzt');
  assert.equal(tr('Montag · 25','de'),'Montag · 25');
  assert.equal(tr('25 offen','de'),'25 offen');
  for(const key of legacyKeys.filter(k=>k.startsWith('legacyPattern.')))assert.match(packs.de[key],/\{\{/,key+' braucht einen Platzhalter');
});

test('RC1567 Leistung: Deutsch prüft keine Muster, Ergebnisse werden zwischengespeichert, lange Texte übersprungen',()=>{
  const e=engine();
  let calls=0;const orig=e.sourcePatterns.map(p=>p.re);
  e.sourcePatterns.forEach(p=>{const re=p.re;p.re={exec(s){calls++;return re.exec(s)}}});
  assert.equal(e.translateLegacyValue('Montag · 25','de'),'Montag · 25');
  assert.equal(calls,0,'im Deutschen keine Musterprüfung');
  e.translateLegacyValue('Kunde Nord 3','en');const first=calls;
  e.translateLegacyValue('Kunde Nord 3','en');
  assert.equal(calls,first,'zweiter Aufruf kommt aus dem Zwischenspeicher');
  e.translateLegacyValue('x'.repeat(200)+' 3','en');
  assert.equal(calls,first,'lange Texte werden nicht gegen Muster geprüft');
  e.sourcePatterns.forEach((p,i)=>{p.re=orig[i]});
});
