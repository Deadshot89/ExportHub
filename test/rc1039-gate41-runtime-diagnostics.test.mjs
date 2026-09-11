import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const ui=fs.readFileSync('assets/rc1013-gate41-ui.js','utf8');

function extractFunctionBody(source,name,nextName){
  const rx=new RegExp('function\\s+'+name+'\\([^)]*\\)\\{([\\s\\S]*?)\\}\\s*function\\s+'+nextName+'\\(');
  const match=source.match(rx);
  assert.ok(match,name+' fehlt');
  return match[1];
}

test('RC1039: Gate41 Deutschland berechnet den Grundtarif zur Laufzeit korrekt',()=>{
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

test('RC1039: fehlender internationaler Tarif wird landesspezifisch statt als generischer Nullpreis erklärt',()=>{
  assert.match(ui,/function diagnosticMessage\(/,'reine Gate41-Diagnosefunktion fehlt');
  assert.match(ui,/Kein internationaler Gate41-Tarif für/,'landesspezifische internationale Tarifmeldung fehlt');
  assert.match(ui,/Grundfracht manuell eintragen/,'Handlungsweg für fehlenden Auslandstarif fehlt');
});

test('RC1039: bei fehlendem Auslandstarif ist der offizielle Gate41-Frachtkalkulator direkt erreichbar',()=>{
  assert.match(ui,/https:\/\/gate41\.com\/frachtkalkulator\//,'offizieller Gate41-Frachtkalkulator fehlt');
  assert.match(ui,/Gate41-Frachtkalkulator öffnen/,'sichtbare Aktion zum offiziellen Kalkulator fehlt');
});
