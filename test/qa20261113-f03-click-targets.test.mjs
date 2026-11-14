import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

// QA-Bericht 13.11.2026 F03: im Browser gefundene Überlagerungen, hier als Quellvertrag gesichert.
const read=p=>fs.readFileSync(p,'utf8');

test('QA F03: Aufgaben-Erinnerung stapelt sich über "SOP / Hilfe" und bleibt scrollbar',()=>{
  const css=read('assets/taskplanner-v2.css');
  const rule=css.indexOf('body:has(#rc1705-sop-launcher) .tpv2-reminder-host{bottom:76px}');
  assert.ok(rule>0,'Erinnerung muss über dem Launcher liegen');
  assert.match(css,/body:has\(#rc1705-sop-launcher\) \.tpv2-reminder-toast\{max-height:calc\(100dvh - 180px\);overflow-y:auto\}/);
  // Die ansichtsspezifischen Verschiebungen nach oben (RC1762/RC1941) müssen danach stehen und gewinnen.
  for(const marker of ['body:has(#rc626Abd) .tpv2-reminder-host','body:has(#rc1940Documents) .tpv2-reminder-host','body:has([data-sop-editor]) .tpv2-reminder-host']){
    assert.ok(css.indexOf(marker)>rule,marker+' muss nach der allgemeinen Launcher-Regel stehen');
  }
});

test('QA F03: Historien-Filter umbrechen statt rechts aus dem Inhalt zu laufen',()=>{
  const js=read('assets/rc1081-audit-history.js');
  assert.match(js,/\.rc1084-filters\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(150px,1fr\)\)/);
  assert.doesNotMatch(js,/rc1084-filters\{[^}]*minmax\(250px,1\.5fr\)/);
});

test('QA F03: Hit-Test-Spec ist im Layout-Browser-Gate verdrahtet',()=>{
  const wf=read('.github/workflows/rc1306-layout-browser.yml');
  assert.match(wf,/e2e\/specs\/qa-f03-click-targets\.spec\.mjs --global-timeout=\d+ --project=laptop --project=desktop/);
  const spec=read('e2e/specs/qa-f03-click-targets.spec.mjs');
  for(const d of ['classic','premium','neu','frost','graphit','azur','stahl','polar'])assert.ok(spec.includes(`'${d}'`),d);
  assert.match(read('e2e/helpers/qa-hit-targets.mjs'),/elementFromPoint/);
});
