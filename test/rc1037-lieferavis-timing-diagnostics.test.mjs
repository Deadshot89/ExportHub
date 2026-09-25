import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const read=(p)=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('RC1037 speichert Lieferavis-Serverzeiten clientseitig und stellt sie der Diagnose bereit',()=>{
  const assetPath='assets/rc1037-lieferavis-timing-diagnostics.js';
  assert.ok(fs.existsSync(path.join(ROOT,assetPath)),'RC1037 Timing-Diagnose-Asset muss vorhanden sein.');
  const src=read(assetPath);
  const build=read('.github/rc1018/fix-mail-wording.mjs');

  assert.match(src,/data\.timing/,'Die RC1036-Timingdaten müssen aus der API-Antwort übernommen werden.');
  for(const key of ['authMs','teamBlobMs','teamReadMs','flagWriteMs','tokenIssueMs','totalMs'])assert.match(src,new RegExp(key),key+' muss übernommen werden.');
  assert.match(src,/sessionStorage/,'Der letzte Messwert muss lokal für die laufende Sitzung verfügbar bleiben.');
  assert.match(src,/exporthub:lieferavis-timing/,'Neue Lieferavis-Timings müssen als Diagnoseereignis gemeldet werden.');
  assert.match(src,/avisTiming\.readState/,'Die Diagnose muss den lokalisierten Team-Read verwenden.');
  assert.match(src,/avisTiming\.writeState/,'Die Diagnose muss den lokalisierten Flag-Write verwenden.');
  assert.match(src,/avisTiming\.createToken/,'Die Diagnose muss den lokalisierten Token-Issue verwenden.');
  assert.match(src,/avisTiming\.total/,'Die Diagnose muss die lokalisierte Gesamtzeit sichtbar machen.');
  assert.match(src,/isGlobalAdmin/,'Die Timing-Karte bleibt auf die bestehende Global-Admin-Diagnose begrenzt.');

  assert.match(build,/rc1037-lieferavis-timing-diagnostics\.js\?v=1038/,'Der gemeinsame Build muss die aktuelle Lieferavis-Timingdiagnose mit frischem Cache-Key laden.');
  assert.match(build,/\['index\.html','TESTVERSION\.html','demo\.html'\]/,'Produktion, TESTSERVICE und Demo müssen gemeinsam injiziert werden.');
});
