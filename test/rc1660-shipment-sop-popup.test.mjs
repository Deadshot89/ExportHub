import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ui=fs.readFileSync('assets/rc1660-shipment-sop-popup.js','utf8');
const css=fs.readFileSync('assets/rc1660-shipment-sop-popup.css','utf8');
const i18nSource=fs.readFileSync('assets/i18n/rc1660-shipment-sop-popup.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const demo=fs.readFileSync('assets/exporthub-demo-bootstrap.js','utf8');

function packs(){const ctx={window:{}};vm.runInNewContext(i18nSource,ctx);return ctx.window.ExportHUBShipmentSop1660I18n.packs}
function api(extra={}){
  const listeners={};
  const doc={readyState:'complete',body:{},activeElement:null,addEventListener(){},getElementById(){return null},querySelector(){return null},querySelectorAll(){return []}};
  const win=Object.assign({innerWidth:1600,innerHeight:900,addEventListener(n,f){listeners[n]=f},setTimeout(){return 1},clearTimeout(){},localStorage:{getItem(){return null},setItem(){}}},extra);
  vm.runInNewContext(i18nSource,{window:win});
  vm.runInNewContext(ui,{window:win,document:doc,URL,Math,JSON,Number,String,Array,Object});
  return win.ExportHUBShipmentSop;
}

test('RC1660: Popup wird im RC1112-Build in allen drei Umgebungen geladen und mitkopiert',()=>{
  for(const asset of ['rc1660-shipment-sop-popup.css?v=1660','i18n/rc1660-shipment-sop-popup.js?v=1660','/assets/rc1660-shipment-sop-popup.js?v=1660'])assert.ok(build.includes(asset),asset);
  for(const rel of ['assets/rc1660-shipment-sop-popup.css','assets/rc1660-shipment-sop-popup.js','assets/i18n/rc1660-shipment-sop-popup.js'])assert.ok(build.includes(`'${rel}',`),rel);
  assert.match(build,/RC1660 SOP-Popup fehlt/);
});

test('RC1660: alle sechs Sprachen haben dieselben Schlüssel und Platzhalter',()=>{
  const all=packs(),de=all.de,keys=Object.keys(de).sort();
  const ph=v=>(String(v).match(/\{\w+\}/g)||[]).sort().join(',');
  for(const lang of ['de','en','pl','es','fr','it']){
    assert.deepEqual(Object.keys(all[lang]).sort(),keys,lang);
    for(const key of keys){assert.ok(String(all[lang][key]).trim(),lang+' '+key);assert.equal(ph(all[lang][key]),ph(de[key]),lang+' '+key)}
  }
  for(const key of [...ui.matchAll(/\bt\('([A-Za-z]+)'/g)].map(m=>m[1]))assert.ok(de[key],'Schlüssel fehlt: '+key);
});

test('RC1660: kein Seitenwechsel, keine produktiven Aktionen, keine globale Ladeanzeige',()=>{
  assert.doesNotMatch(ui,/route\(|setView\(|location\.(assign|href\s*=)|fetch\(|queueSave|flushSave|rc435SelectSop|openCustomerSop\(/);
  assert.match(ui,/data-rc739-no-loading/);
  assert.match(ui,/target="_blank" rel="noopener noreferrer"/);
  assert.match(css,/resize:both/);
  assert.match(css,/@media \(max-width:720px\)/);
});

test('RC1660: Schritte aus Kunden-SOPs und SOP-Handbuch werden eindeutig aufbereitet',()=>{
  const sop=api();
  const legacy=sop.stepsOf({steps:['Portal öffnen.\nMit Zugang anmelden.',{title:'Kundennummer eintragen',text:'D1001 eintragen.'},{title:'',text:''},{title:'Alt',notRelevant:true}]});
  assert.deepEqual(legacy.map(s=>s.title),['Portal öffnen','Kundennummer eintragen']);
  const iso=sop.stepsOf({steps:[{instruction:'Sendung suchen: Bereich Sendungen öffnen.'},{instruction:'Sendung suchen: Suchbegriff eingeben.'},{instruction:'Sendung suchen: Bereich Sendungen öffnen.'}]});
  assert.deepEqual(iso.map(s=>s.group),['Sendung suchen','Sendung suchen','Sendung suchen']);
  assert.deepEqual(iso.map(s=>s.title),['Bereich Sendungen öffnen (1)','Suchbegriff eingeben','Bereich Sendungen öffnen (2)']);
  assert.equal(sop.fieldKind({title:'Transportauftrag speichern',text:''}),'button');
  assert.equal(sop.fieldKind({title:'Abholort auswählen',text:''}),'select');
  assert.equal(sop.fieldKind({title:'Lieferschein prüfen',text:''}),'check');
  assert.equal(sop.fieldKind({title:'Kundennummer eintragen',text:''}),'input');
});

test('RC1660: SOP wird über Kundennummer, Namen oder Portal dem Kunden zugeordnet',()=>{
  const sop=api(),c={id:'C1',account:'3019106452',name:'Bossard AG'};
  const portals=[{name:'DHL Express / MyDHL+',url:'https://mydhl.express.dhl/de/de/auth/login.html'}];
  assert.equal(sop.sopMatches({account:'3019106452'},c,[]),true);
  assert.equal(sop.sopMatches({customerName:'Bossard AG'},c,[]),true);
  assert.equal(sop.sopMatches({portal:'DHL Express / MyDHL+'},c,portals),true);
  assert.equal(sop.sopMatches({portalUrl:'https://mydhl.express.dhl/other'},c,portals),true);
  assert.equal(sop.sopMatches({account:'999',customerName:'Andere GmbH'},c,portals),false);
  assert.equal(sop.sopMatches({customerName:'Alle DHL-Kunden'},c,[]),false);
});

test('RC1660: Demo hat einen Fake-Kunden mit Portal und Kunden-SOP zum Ausprobieren',()=>{
  assert.match(demo,/portalUrl:'https:\/\/example\.invalid\/fake-portal-nord'/);
  assert.match(demo,/id:'DEMO-SOP-NORD'[^\n]*account:'D1001'/);
  assert.match(demo,/warnings,customSops,/);
});
