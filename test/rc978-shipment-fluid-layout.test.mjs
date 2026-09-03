import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('TESTVERSION.html','utf8');

function buildVersion(){
  const m=html.match(/var BUILD=Object\.freeze\(\{version:'RC(\d+)',cache:'(\d+)'/);
  return m ? {version:Number(m[1]),cache:Number(m[2])} : {version:0,cache:0};
}

function shipmentStyle(){
  const start=html.indexOf("style.textContent='.rc894-full-stack");
  const end=start<0 ? -1 : html.indexOf("';\n (document.head||document.documentElement).appendChild(style)",start);
  return start>=0 && end>start ? html.slice(start,end) : '';
}

test('RC978: Build ist auf RC978 oder höher angehoben',()=>{
  const build=buildVersion();
  assert.ok(build.version>=978,'BUILD muss RC978 oder höher sein');
  assert.ok(build.cache>=978,'Cache muss RC978 oder höher sein');
});

test('RC978: Sendungsraster reagiert auf die echte Inhaltsbreite statt auf die Fensterbreite',()=>{
  const css=shipmentStyle();
  assert.ok(css,'Kanonischer Sendungs-Style fehlt');
  assert.match(css,/#rc363FixedShipmentLayout\{[^}]*container-type:inline-size!important[^}]*container-name:rc978ShipmentLayout!important/i,'Das feste Sendungslayout muss ein Inline-Size-Container sein');
  assert.match(css,/@container rc978ShipmentLayout \(max-width:1180px\)/i,'Mittlere Breite muss per Container Query gesteuert werden');
  assert.match(css,/@container rc978ShipmentLayout \(max-width:760px\)/i,'Einspaltige Breite muss per Container Query gesteuert werden');
  assert.doesNotMatch(css,/@media\(max-width:1380px\)\{\.rc894-full-stack/i,'Das obere Sendungsraster darf nicht mehr über die Browserbreite bei 1380px umschalten');
});

test('RC978: Desktop-Zeile schließt Kunde, Sendungsdaten und Colli ohne sichtbare Zwischenlöcher ab',()=>{
  const css=shipmentStyle();
  assert.match(css,/\.rc894-full-stack\{[^}]*grid-template-columns:minmax\(340px,1\.05fr\) minmax\(390px,1\.15fr\) minmax\(360px,\.95fr\)!important[^}]*align-items:stretch!important/i,'Desktop muss drei Spalten mit gestreckter Kartenzeile behalten');
  assert.match(css,/#rc383TopPair\.rc894-full-stack>#rc363BlockCustomer,#rc383TopPair\.rc894-full-stack>#rc363BlockShipment,#rc383TopPair\.rc894-full-stack>#rc363BlockColli\{[^}]*align-self:stretch!important[^}]*height:auto!important/i,'Die drei oberen Karten müssen die gemeinsame Zeile ausfüllen');
});

test('RC978: Bei mittlerer Inhaltsbreite wird Colli vollbreit unter Kunde und Sendungsdaten angeordnet',()=>{
  const css=shipmentStyle();
  const medium=css.match(/@container rc978ShipmentLayout \(max-width:1180px\)\{([\s\S]*?)\}@container rc978ShipmentLayout \(max-width:760px\)/i)?.[1] || '';
  assert.ok(medium,'Mittlere Container-Regel fehlt');
  assert.match(medium,/#rc383TopPair\.rc894-full-stack\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important\}/i,'Mittlere Breite muss zweispaltig sein');
  assert.match(medium,/#rc383TopPair\.rc894-full-stack>#rc363BlockColli\{grid-column:1\/-1!important;grid-row:2!important\}/i,'Colli muss in Zeile 2 beide Spalten belegen');
  assert.match(medium,/#rc383TopPair\.rc894-full-stack>#rc363BlockDocuments\{grid-column:1\/-1!important;grid-row:auto!important\}/i,'Dokumente & ABD müssen weiterhin vollbreit bleiben');
});

test('RC978: Bei schmaler Inhaltsbreite werden alle oberen Prozesskarten sauber einspaltig gestapelt',()=>{
  const css=shipmentStyle();
  const narrow=css.match(/@container rc978ShipmentLayout \(max-width:760px\)\{([\s\S]*?)\}(?:@media|';|$)/i)?.[1] || '';
  assert.ok(narrow,'Schmale Container-Regel fehlt');
  assert.match(narrow,/#rc383TopPair\.rc894-full-stack\{grid-template-columns:1fr!important\}/i,'Schmale Breite muss einspaltig sein');
  assert.match(narrow,/#rc383TopPair\.rc894-full-stack>\.rc363-process-block\{grid-column:1\/-1!important;grid-row:auto!important\}/i,'Alle oberen Prozesskarten müssen automatisch untereinander laufen');
});

test('RC978: Stauplan, Mailbereich und Speichern-Ausgabe bleiben vom neuen Raster unberührt',()=>{
  const css=shipmentStyle();
  const queries=(css.match(/@container rc978ShipmentLayout[\s\S]*$/i)||[''])[0];
  assert.doesNotMatch(queries,/#rc363BlockStow|#rc363BlockMail|#rc363BlockActions|#rc543MailArea|#rc380StowPlan/i,'RC978 darf nachgelagerte Funktionsbereiche nicht umpositionieren');
});
