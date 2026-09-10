import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

execFileSync(process.execPath,['.github/rc1018/build-three-env.mjs'],{stdio:'ignore'});
const PAGE=fs.readFileSync('dist-rc1018/customer-avis.html','utf8');
const API=fs.readFileSync('api/customer-avis/index.js','utf8');

function functionBody(name,source=PAGE){
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`${name} fehlt`);
  const brace=source.indexOf('{',start);
  let depth=0;
  for(let i=brace;i<source.length;i++){
    if(source[i]==='{')depth++;
    if(source[i]==='}'&&--depth===0)return source.slice(brace+1,i);
  }
  assert.fail(`${name} ist syntaktisch nicht abgeschlossen`);
}

test('RC1029: automatische Aktualisierung darf ein gerade bearbeitetes Lieferavis-Formular nicht neu rendern',()=>{
  assert.match(PAGE,/var\s+avisFormDirty\s*=\s*false/,'Es fehlt ein expliziter Dirty-State für die Avis-Eingaben.');
  assert.match(PAGE,/function\s+avisFormFocused\s*\(/,'Es fehlt die Erkennung eines gerade fokussierten Avis-Formulars.');
  assert.match(PAGE,/function\s+markAvisFormDirty\s*\(/,'Eingaben werden noch nicht als ungespeichert markiert.');
  const refresh=functionBody('refresh');
  assert.match(refresh,/avisFormDirty/,'15-Sekunden-/Fokus-Refresh ignoriert ungespeicherte Eingaben.');
  assert.match(refresh,/avisFormFocused\(\)/,'Refresh ignoriert den nativen Datums-/Zeitpicker-Fokus noch nicht.');
  const render=functionBody('render');
  assert.match(render,/markAvisFormDirty/,'Das gerenderte Formular markiert Änderungen noch nicht als lokal offen.');
  const submit=functionBody('submit');
  assert.match(submit,/avisFormDirty\s*=\s*false[\s\S]*render\(/,'Nach erfolgreichem Speichern muss erst der Dirty-State beendet und dann der Serverstand gerendert werden.');
});

test('RC1029: Spedition bleibt im öffentlichen Lieferavis reine Anzeige und ist serverseitig nicht änderbar',()=>{
  const render=functionBody('render');
  const formStart=render.indexOf('<form id="avisForm">');
  assert.ok(formStart>=0,'Avis-Formular fehlt.');
  const formEnd=render.indexOf('</form>',formStart);
  const form=render.slice(formStart,formEnd);
  assert.doesNotMatch(form,/name="(?:carrier|spedition|carrierName|speditionName)"/i,'Öffentliches Avis darf kein editierbares Speditionsfeld anbieten.');
  const validate=functionBody('validateAppointment',API);
  const apply=functionBody('applyAppointment',API);
  assert.doesNotMatch(validate+apply,/payload\.(?:carrier|spedition)|\b(?:carrierName|speditionName)\s*:/i,'Avis-API darf die Spedition nicht aus externen Formulardaten übernehmen.');
});
