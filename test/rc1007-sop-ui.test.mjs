import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1007-sop-catalog.js');
await import('../assets/sop/rc1007-sop-ui.js');

const ui=globalThis.ExportHubIsoSopUi;
const catalog=globalThis.ExportHubIsoSopCatalog;

test('UI stellt die vereinbarten SOP-Funktionen bereit',()=>{
  for(const name of ['mount','renderOverview','renderDocument','renderProcessGraphic','printDocument']) assert.equal(typeof ui[name],'function',`${name} fehlt`);
});

test('Übersicht enthält Suche Filter und gelenkte Dokumentdaten',()=>{
  const html=ui.renderOverview({documents:catalog.documents,rights:{read:true,edit:true,admin:true}});
  for(const term of ['SOP-Handbuch','SOP suchen','Bereich','Status','Version','Gültig ab','Nächste Prüfung','Öffnen']) assert.match(html,new RegExp(term,'i'),`${term} fehlt`);
  for(const area of ['Qualitätsmanagement','System / ExportHUB','Versand und Export','Lager','Organisation']) assert.match(html,new RegExp(area.replace('/','\\/'),'i'),`${area} fehlt`);
});

test('Einzelansicht zeigt Dokumentenkopf Pflichtabschnitte Historie und Drucken',()=>{
  const doc=catalog.documents.find(item=>item.number==='SOP-LOG-011');
  const html=ui.renderDocument(doc,{rights:{read:true,edit:true,admin:true}});
  for(const term of ['SOP-LOG-011','QR-Abholung und Verlade-PIN','Prozessverantwortlicher','Geltungsbereich','Verantwortlichkeiten','Voraussetzungen','Schritt-für-Schritt-Ablauf','Prüfpunkte','Abweichungen','Nachweise','Versionshistorie','Drucken']) assert.match(html,new RegExp(term,'i'),`${term} fehlt`);
  assert.match(html,/Bild noch zu erstellen:/);
});

test('Prozessgrafik ist echtes SVG und enthält die Prozessstationen',()=>{
  const doc=catalog.documents.find(item=>item.number==='SOP-LOG-011');
  const svg=ui.renderProcessGraphic(doc);
  assert.match(svg,/<svg[\s>]/i);
  assert.match(svg,/QR-Code öffnen/);
  assert.match(svg,/Abholung abschließen/);
});

test('Lesebenutzer erhält Entwürfe nicht als gültige Arbeitsanweisung',()=>{
  const html=ui.renderOverview({documents:catalog.documents,rights:{read:true,edit:false,admin:false}});
  assert.doesNotMatch(html,/SOP-LOG-011/);
  assert.match(html,/Keine freigegebenen SOPs/i);
});

test('CSS ist auf das SOP-Modul begrenzt und besitzt responsive Grundstruktur',()=>{
  const css=fs.readFileSync('assets/sop/rc1007-sop.css','utf8');
  assert.match(css,/\.rc1007-sop/);
  assert.match(css,/@media\s*\(max-width:\s*760px\)/i);
});
