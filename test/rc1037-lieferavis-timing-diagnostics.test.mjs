import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const read=(p)=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('RC1037 speichert Lieferavis-Serverzeiten clientseitig und stellt sie der Diagnose bereit',()=>{
  const avis=read('assets/rc1027-lieferavis-immediate.js');
  const diag=read('assets/rc1013-diagnostics.js');

  assert.match(avis,/data\.timing/,'Der Lieferavis-Client muss die RC1036-Timingdaten aus der API-Antwort übernehmen.');
  assert.match(avis,/teamReadMs/,'Team-Read-Laufzeit muss übernommen werden.');
  assert.match(avis,/flagWriteMs/,'Flag-Write-Laufzeit muss übernommen werden.');
  assert.match(avis,/tokenIssueMs/,'Token-Issue-Laufzeit muss übernommen werden.');
  assert.match(avis,/totalMs/,'Gesamtlaufzeit muss übernommen werden.');
  assert.match(avis,/sessionStorage/,'Der letzte Messwert muss lokal für die laufende Sitzung verfügbar bleiben.');
  assert.match(avis,/exporthub:lieferavis-timing/,'Der Client muss ein Diagnoseereignis für neue Lieferavis-Timings auslösen.');

  assert.match(diag,/lieferavis-timing/,'Die Fehlerdiagnose muss Lieferavis-Timingereignisse auswerten.');
  assert.match(diag,/Team-State lesen/,'Die Diagnose muss den Team-Read verständlich beschriften.');
  assert.match(diag,/Team-State speichern/,'Die Diagnose muss den Flag-Write verständlich beschriften.');
  assert.match(diag,/Token erzeugen/,'Die Diagnose muss den Token-Issue verständlich beschriften.');
  assert.match(diag,/Gesamtzeit/,'Die Diagnose muss die Gesamtzeit sichtbar machen.');
});
