import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('TESTVERSION.html', 'utf8');

function between(start, end, max = 30000) {
  const i = html.indexOf(start);
  assert.ok(i >= 0, `Startmarker fehlt: ${start}`);
  const tail = html.slice(i, i + max);
  const j = end ? tail.indexOf(end) : -1;
  return j >= 0 ? tail.slice(0, j) : tail;
}

test('RC996 Aufgaben: offene Liste bleibt auf sinnvolle aktuelle Aufgaben begrenzt', () => {
  const src = between('const rawOpen=(state.tasks||[])', 'const duplicatesHidden=', 9000);
  assert.match(src, /!taskCompletedRC777\(t\)/, 'erledigte Aufgaben dürfen nicht wieder offen erscheinen');
  assert.match(src, /taskMeaningfulRC818\(t\)/, 'technische Leer-/Hilfsaufgaben müssen ausgefiltert bleiben');
  assert.match(src, /!taskLinkedTestShipmentRC818\(t\)/, 'Testsendungs-Aufgaben dürfen die echte Aufgabenliste nicht verunreinigen');
  assert.match(src, /taskVisibleInCurrentWeek\(t,currentWeek\)/, 'Aufgaben müssen der aktuellen Woche korrekt zugeordnet bleiben');
  assert.match(src, /dedupeVisibleTasksRC874\(rawOpen\)/, 'sichtbare technische Dubletten müssen zusammengeführt bleiben');
});

test('RC996 Aufgaben: gleiche Aufgabennamen verschiedener Sendungen bleiben getrennt', () => {
  const src = between('function taskDisplayKeyRC874(', 'function taskDedupeScoreRC874', 15000);
  assert.match(src, /linkedShipmentRef\|\|t\.shipmentRef\|\|t\.reference\|\|t\.ref/, 'Sendungsreferenz muss Teil der Aufgabenidentität bleiben');
  assert.match(src, /linkedCustomer\|\|t\.customerName\|\|t\.customer/, 'Kunde muss Teil der Aufgabenidentität bleiben');
  assert.match(src, /linkedAccount\|\|t\.customerAccount/, 'Kundenkonto muss Teil der Aufgabenidentität bleiben');
  assert.match(src, /\[week,date\|\|day,group,title,owner,customer,account,ref,series,time\]/, 'Dedupe darf verschiedene Sendungen nicht nur wegen gleichem Titel zusammenlegen');
});

test('RC996 Aufgaben: Gruppen und Tagesfilter bleiben bedienbar', () => {
  assert.match(html, /Gruppen\\u00f6ffnen|Gruppen öffnen/, 'Schalter Gruppen öffnen fehlt');
  assert.match(html, /Gruppen schlie\\u00dfen|Gruppen schließen/, 'Schalter Gruppen schließen fehlt');
  assert.match(html, /Alle Tage/);
  assert.match(html, /Heute/);
  assert.match(html, /Montag/);
  assert.match(html, /Dienstag/);
  assert.match(html, /Mittwoch/);
  assert.match(html, /Donnerstag/);
  assert.match(html, /Freitag/);
});

test('RC996 Aufgaben: sichtbares 3-2-1 Kachelraster bleibt erhalten', () => {
  assert.match(html, /#content \.rc229-task-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)\s*!important/s, 'Desktop muss drei Aufgabenkacheln nebeneinander erlauben');
  assert.match(html, /@media\s*\(max-width:\s*1000px\)[\s\S]{0,5000}#content \.rc229-task-grid[\s\S]{0,1000}grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important/s, 'mittlere Breite muss zwei Aufgabenkacheln nutzen');
  assert.match(html, /@media\s*\(max-width:\s*700px\)[\s\S]{0,5000}#content \.rc229-task-grid[\s\S]{0,1000}grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/s, 'Smartphone muss einspaltig bleiben');
});

test('RC996 Planer: Drag-and-drop verwendet die tatsächlich getroffene Tagesfläche', () => {
  const hit = between('function rc946TaskPointerDayAt(', 'function rc946TaskPointerClear', 5000);
  assert.match(hit, /document\.elementFromPoint\(/, 'Drop-Ziel muss unter dem echten Zeiger ermittelt werden');
  assert.match(hit, /closest\('\[data-i218-drop-date\]'\)/, 'getroffene Tagesfläche muss verwendet werden');
  const up = between("document.addEventListener('pointerup'", "document.addEventListener('pointercancel'", 8000);
  assert.match(up, /rc946TaskPointerDayAt\(e\)/, 'pointerup muss das reale Ziel erneut bestimmen');
  assert.match(up, /moveTask\(id,day\.getAttribute\('data-i218-drop-date'\),day\)/, 'Move muss das getroffene Ziel einschließlich Tagescontainer übernehmen');
});

test('RC996 Planer: Wochen-Dedupe respektiert Sendungsreferenz und Serienidentität', () => {
  const src = between('function logicalTaskKeyRC896(', 'function openTasksForWeek', 10000);
  assert.match(src, /linkedShipmentRef\|\|t\.shipmentRef\|\|t\.reference\|\|t\.ref/, 'Planer-Dedupe muss Sendungsreferenz berücksichtigen');
  assert.match(src, /recurringSeriesId\|\|t\.weeklySeriesId\|\|t\.seriesId/, 'wiederkehrende Aufgaben brauchen ihre Serienidentität');
});

test('RC996 Planer: RC994 lokaler Reconcile bleibt ohne Vollrender aktiv', () => {
  const src = between('function plannerQueueReconcileRC907()', 'function moveTask(', 6000);
  assert.doesNotMatch(src, /\brender\s*\(/, 'Drag darf keinen kompletten Planner-Render auslösen');
  assert.match(src, /plannerReconcileAfterMoveRC994\s*\(/);
});
