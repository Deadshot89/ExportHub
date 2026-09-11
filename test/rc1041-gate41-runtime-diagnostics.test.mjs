import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const ui=fs.readFileSync('assets/rc1013-gate41-ui.js','utf8');
const build=fs.readFileSync('.github/rc1018/build-three-env.mjs','utf8');

function extractFunctionBody(source,name,nextName){
  const rx=new RegExp('function\\s+'+name+'\\([^)]*\\)\\{([\\s\\S]*?)\\}\\s*function\\s+'+nextName+'\\(');
  const match=source.match(rx);
  assert.ok(match,name+' fehlt');
  return match[1];
}

test('RC1041: Gate41 Deutschland berechnet den Grundtarif zur Laufzeit korrekt',()=>{
  const body=extractFunctionBody(html,'gateRate','gateConfiguredBase');
  const gateRate=new Function('num','pallets','kg',body);
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};

  assert.equal(gateRate(num,5,150),46.09);
  assert.equal(Number((gateRate(num,5,150)*5).toFixed(2)),230.45);
  assert.equal(gateRate(num,10,150),43.43);
  assert.equal(gateRate(num,5,350),73.69);
  assert.equal(gateRate(num,5,700),98.61);
  assert.equal(gateRate(num,5,801),0);
});

test('RC1041: Gate41 ist in der Oberfläche ausdrücklich nur für Deutschland freigegeben',()=>{
  assert.match(ui,/nur für nationalen Versand innerhalb Deutschlands freigegeben/);
  assert.match(ui,/nationalOnly:true/);
  assert.match(ui,/save\.disabled=!national/,'Speichern muss für Ausland gesperrt sein');
  assert.doesNotMatch(ui,/gate41\.com\/frachtkalkulator/,'kein externer Auslandskalkulator im National-Only-Modus');
});

test('RC1041: aktueller Drei-Umgebungen-Build sperrt automatische und manuelle Gate41-Auslandspreise',()=>{
  assert.match(build,/function patchGate41NationalOnly\(html\)/);
  assert.match(build,/gateRate\(pallets,kg\)\*pallets:0/,'automatische Auslandstarife dürfen nicht berechnet werden');
  assert.match(build,/manualBase=national\?num\(g\.internationalBase\):0/,'manuelle Auslandspreise dürfen nicht verwendet werden');
  assert.match(build,/Nicht verfügbar/,'Ausland darf nicht mehr als nutzbarer Gate41-Bereich erscheinen');
  assert.match(build,/Paletten – Gate41 Deutschland/,'Gate41 muss sichtbar als Deutschland-Funktion gekennzeichnet sein');
  assert.match(build,/nur für nationalen Versand innerhalb Deutschlands freigegeben/,'Speicher- und UI-Hinweis für Ausland fehlt');
  assert.match(build,/html=patchGate41NationalOnly\(html\)/,'National-Only-Patch muss auf alle drei Umgebungen angewendet werden');
});

test('RC1041: aktueller Drei-Umgebungen-Build lädt die Gate41-Diagnose cache-frisch',()=>{
  assert.match(build,/rc1013-gate41-ui\.js\?v=1041/,'Gate41-Asset wird im aktuellen Build nicht mit RC1041 neu geladen');
});
