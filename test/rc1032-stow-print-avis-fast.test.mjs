import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');
const avis=fs.readFileSync('assets/rc1015-lieferavis-mail-flow.js','utf8');
const build=fs.readFileSync('.github/rc1013/build-three-env.mjs','utf8');

function between(source,start,end){
  const a=source.indexOf(start);assert.ok(a>=0,start+' fehlt');
  const b=source.indexOf(end,a+start.length);assert.ok(b>a,end+' fehlt');
  return source.slice(a,b);
}

test('RC1032: Stauplan-Druck verwendet ausschließlich die aktuelle rc717-Ladegrafik statt des gesamten Karten-HTML',()=>{
  const source=between(html,'function printStow(){','function normalizeActionButtons');
  assert.match(source,/querySelector\(\s*['"]\.rc717-shell['"]\s*\)/,'Druck muss die aktuelle Ladegrafik gezielt auswählen.');
  assert.doesNotMatch(source,/\+\s*card\.innerHTML\s*\+/,'Das komplette Stauplan-Karten-HTML darf nicht als Druckinhalt verwendet werden.');
  assert.match(source,/rc717-shell/,'Der Druckpfad muss die aktuelle rc717-Grafik kennen.');
  assert.match(source,/A4 landscape/i,'Stauplan muss auf A4 quer ausgegeben werden.');
  assert.match(source,/querySelectorAll\(\s*['"]style['"]\s*\)/,'Die aktuellen Grafik-Styles müssen in das Druckfenster übernommen werden.');
});

test('RC1032: bereits gespeicherte Sendungen erzeugen den Lieferavis-Link ohne erneuten vollständigen Vorab-Save',()=>{
  const source=between(avis,'async function rc1015Toggle(on){','async function rc1021AutoEnable');
  assert.match(source,/if\s*\(\s*on\s*&&\s*!rc1021Persisted\(sh\)\s*\)\s*await\s+rc1015PersistBeforeAvis\(\)/,'Nur noch nicht persistierte Sendungen dürfen vor der Avis-Ausstellung vollständig gespeichert werden.');
  assert.doesNotMatch(source,/if\s*\(\s*on\s*\)\s*\{\s*rc1024ClearDraftDisabled\(sh\);\s*await\s+rc1015PersistBeforeAvis\(\)/,'Gespeicherte Sendungen dürfen nicht mehr pauschal vor jedem Avis-Token erneut gespeichert werden.');
});

test('RC1032: Auto-Enable löst bei bereits persistierten Sendungen keinen zweiten Full-State-Save aus',()=>{
  const source=between(avis,'async function rc1021AutoEnable(reason){','function stripAvisBlocks');
  assert.doesNotMatch(source,/rc1015PersistBeforeAvis\s*\(/,'Auto-Enable darf nicht nochmals den kompletten State speichern, weil rc1021ShouldAutoEnable bereits Persistenz verlangt.');
  assert.match(source,/await\s+base\.toggle\(true\)/,'Auto-Enable muss den Avis direkt ausstellen.');
});

test('RC1032: der geänderte Avis-Fastpath wird in allen drei Umgebungen mit frischem Cache-Key ausgeliefert',()=>{
  assert.match(build,/rc1015-lieferavis-mail-flow\.js\?v=1032/,'Drei-Umgebungen-Build muss den frischen RC1032-Avis-Cache-Key verwenden.');
});
