import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/rc1069-performance.js','utf8');

test('RC1104: nach dem Speichern wird die Lager-/QR-Ausgabe für den Druck früh vorgewärmt',()=>{
  assert.match(source,/printPrewarmByKey/,'laufende Druck-Vorbereitung muss pro Sendung geteilt werden');
  assert.match(source,/function prewarmPrintOutput\(/,'Druck-Prewarm-Funktion fehlt');
  assert.match(source,/exporthub:shipment-saved/,'Prewarm muss direkt nach erfolgreichem Sendungsspeichern starten');
  assert.match(source,/(?:w\.)?ExportHUBWarehouse/,'bestehende sichere Location-Registrierung muss verwendet werden');
  assert.match(source,/warehouse\.register\(sh,false\)/,'Prewarm muss exakt den bestehenden Warehouse-Registerpfad verwenden');
});

test('RC1104: Dokumentcenter wärmt Druck und PDF bereits beim Öffnen vor',()=>{
  assert.match(source,/exporthub:documents-opening/,'Dokumentcenter-Prewarm fehlt');
  assert.match(source,/download-all/,'Gesamt-PDF muss auf laufenden Prewarm warten können');
  assert.match(source,/download-load1/,'Ladelisten-PDF muss auf laufenden Prewarm warten können');
});

test('RC1104: Druck wartet auf eine bereits laufende Vorwärmung statt eine zweite Registrierung zu starten',()=>{
  assert.match(source,/function waitForPrintPrewarm\(/,'Druck-Wartepfad fehlt');
  assert.match(source,/data-index352-action=["']print-all["']/,'Gesamtdruck im Dokumentcenter muss erkannt werden');
  assert.match(source,/Gesamtausgabe\\s*drucken|Gesamtdruck/,'Gesamtdruck in der Sendungsansicht muss erkannt werden');
  assert.match(source,/stopImmediatePropagation\(\)/,'Original-Druck darf während laufendem Prewarm nicht parallel starten');
  assert.match(source,/__rc1104PrintResume/,'erneut ausgelöster Original-Druck braucht einen Rekursionsschutz');
});

test('RC1104: Performance-Runtime wird nicht aus einem veralteten Browsercache geladen',()=>{
  const config=JSON.parse(fs.readFileSync('staticwebapp.config.json','utf8'));
  const route=config.routes.find(x=>x.route==='/assets/rc1069-performance.js');
  assert.ok(route,'No-Cache-Route für RC1069/RC1104 fehlt');
  assert.match(String(route.headers&&route.headers['Cache-Control']||''),/no-store|no-cache/i);
});

test('RC1104: keine neue API und keine kostenpflichtige Abhängigkeit wird eingeführt',()=>{
  assert.doesNotMatch(source,/openai|chatgpt|api\.openai\.com/i);
  assert.doesNotMatch(source,/fetch\s*\([^)]*location-booking/i,'RC1104 darf die Lager-API nicht duplizieren');
});
