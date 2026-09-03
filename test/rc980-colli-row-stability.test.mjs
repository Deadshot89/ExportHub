import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('TESTVERSION.html','utf8');

function buildNumber(){
  const m=html.match(/var BUILD=Object\.freeze\(\{version:'RC(\d+)',cache:'(\d+)'/);
  assert.ok(m,'BUILD-Marker fehlt');
  assert.equal(m[1],m[2],'BUILD und Cache müssen identisch sein');
  return Number(m[1]);
}

function css(){
  const m=html.match(/<style id="rc980-colli-row-stability">([\s\S]*?)<\/style>/i);
  return m ? m[1] : '';
}

test('RC980: Build ist auf RC980 oder höher angehoben',()=>{
  assert.ok(buildNumber()>=980,'BUILD muss RC980 oder höher sein');
});

test('RC980: jede Colli-Zeile behält eine feste volle Breite und neue Zeilen wachsen nur nach unten',()=>{
  const s=css();
  assert.ok(s,'RC980 Colli-Stabilitätsstyle fehlt');
  assert.match(s,/#rc363BlockColli #rc573ColliCard #rowsBox\{[^}]*grid-template-columns:minmax\(0,1fr\)!important[^}]*grid-auto-flow:row!important[^}]*grid-auto-rows:max-content!important[^}]*width:100%!important[^}]*min-width:0!important/s,'rowsBox muss exakt eine stabile Spalte mit vertikalem Wachstum verwenden');
  assert.match(s,/#rc363BlockColli #rc573ColliCard \.rc363-owned-row\{[^}]*width:100%!important[^}]*max-width:100%!important[^}]*min-width:0!important[^}]*box-sizing:border-box!important/s,'Jede Colli-Zeile muss ihre volle verfügbare Breite stabil behalten');
});

test('RC980: Desktop-Felder haben dauerhaft dieselben drei Reihen und Spaltenpositionen',()=>{
  const s=css();
  assert.match(s,/\.rc363-colli-grid\{[^}]*grid-template-columns:repeat\(12,minmax\(0,1fr\)\)!important[^}]*grid-template-rows:repeat\(3,max-content\)!important[^}]*grid-auto-flow:row!important/s,'Desktop-Colli muss ein stabiles 12-Spalten-/3-Reihen-Raster besitzen');
  const areas={
    type:'1 / 1 / 2 / 10', action:'1 / 10 / 2 / 13',
    count:'2 / 1 / 3 / 4', weight:'2 / 4 / 3 / 9', ldm:'2 / 9 / 3 / 13',
    l:'3 / 1 / 4 / 5', w:'3 / 5 / 4 / 9', h:'3 / 9 / 4 / 13'
  };
  for(const [field,area] of Object.entries(areas)){
    const escaped=area.replace(/\//g,'\\/');
    assert.match(s,new RegExp(`\\[data-rc363-field="${field}"\\]\\{[^}]*grid-area:${escaped}!important`,'s'),`${field} muss fest auf ${area} liegen`);
  }
});

test('RC980: schmale Ansichten brechen kontrolliert um ohne Reihenbreiten abhängig von der Zeilenanzahl zu machen',()=>{
  const s=css();
  const mediumStart=s.indexOf('@container rc978ShipmentLayout (max-width:760px){');
  const narrowStart=s.indexOf('@container rc978ShipmentLayout (max-width:520px){',mediumStart+1);
  const medium=mediumStart>=0&&narrowStart>mediumStart?s.slice(mediumStart,narrowStart):'';
  assert.ok(medium,'RC980-Regel für mittlere Inhaltsbreite fehlt');
  assert.match(medium,/\.rc363-colli-grid\{grid-template-columns:repeat\(6,minmax\(0,1fr\)\)!important;grid-template-rows:repeat\(4,max-content\)!important\}/,'Mittlere Breite muss kontrolliert auf 6 Spalten / 4 Reihen wechseln');
  const narrow=narrowStart>=0?s.slice(narrowStart):'';
  assert.ok(narrow,'RC980-Regel für sehr schmale Inhaltsbreite fehlt');
  assert.match(narrow,/\.rc363-colli-grid\{grid-template-columns:1fr!important;grid-template-rows:none!important\}/,'Sehr schmale Breite muss sauber einspaltig werden');
  assert.match(narrow,/\.rc363-colli-grid>\[data-rc363-field\]\{grid-column:1!important;grid-row:auto!important\}/,'Alle Felder müssen in der Einspaltenansicht automatisch untereinander laufen');
});

test('RC980: Typografie, Feldhöhe und Colli-Fachlogik bleiben unverändert',()=>{
  const s=css();
  assert.ok(!/font-size|--rc977-colli-font|--rc971-control-h|height:42px/i.test(s),'RC980 darf Schriftgröße oder Feldhöhe nicht neu definieren');
  for(const forbidden of ['rc363BlockCustomer','rc363BlockShipment','rc363BlockDocuments','rc363BlockStow','rc363BlockMail']){
    assert.ok(!s.includes(forbidden),`${forbidden} darf RC980 nicht verändern`);
  }
  const add=html.match(/function addRow\(\)\{([\s\S]*?)\}function removeRow/); 
  assert.ok(add,'addRow-Funktion fehlt');
  assert.match(add[1],/appendChild\(ownedRow\(index,r\)\)/,'Eine neue Zeile muss nur angehängt werden');
  assert.doesNotMatch(add[1],/innerHTML\s*=|replaceChildren\(|replaceWith\(/,'Beim Hinzufügen dürfen bestehende Colli-Zeilen nicht komplett neu aufgebaut werden');
});
