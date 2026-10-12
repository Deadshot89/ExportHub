import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../assets/sop/rc1501-sop-tour-ui.js');
const ui=globalThis.ExportHubSopTourUi;

const SOP={number:'SOP-EH-060',title:'ABD Prozess',steps:[{id:'abd-1',instruction:'GEHEIME SCHRITTANWEISUNG',tour:{enabled:true},exam:{relevant:true}}]};
const ACTIVE={
  mode:'exam',status:'active',sopNumber:'SOP-EH-060',title:'ABD Prozess',task:'Führe den ABD-Prozess für die Demo-Sendung vollständig durch.',
  requiredSteps:['abd-1','abd-2'],correctSteps:['abd-1'],errors:[],skippedSteps:[],helpCount:0,
  currentStep:{id:'abd-2',instruction:'GEHEIME SCHRITTANWEISUNG',expectedResult:'GEHEIMES ERGEBNIS',warnings:['GEHEIMER TIPP'],target:{stableKey:'geheimes-ziel'}}
};

test('SOP mit Tour bietet Prüfung als eigenständige Aktion an',()=>{
  const html=ui.startButtonHtml(SOP);
  assert.match(html,/data-sop-exam-start="SOP-EH-060"/);
  assert.match(html,/Prüfung starten/);
});

test('Prüfungsmodus rendert nur Aufgabe und neutralen Fortschritt ohne Lösungshinweise',()=>{
  const html=ui.render(ACTIVE);
  assert.match(html,/data-sop-exam-shell/);
  assert.match(html,/PRÜFUNGSMODUS/);
  assert.match(html,/Führe den ABD-Prozess für die Demo-Sendung vollständig durch/);
  assert.match(html,/1\s+von\s+2/);
  assert.doesNotMatch(html,/GEHEIME SCHRITTANWEISUNG/);
  assert.doesNotMatch(html,/GEHEIMES ERGEBNIS/);
  assert.doesNotMatch(html,/GEHEIMER TIPP/);
  assert.doesNotMatch(html,/geheimes-ziel/);
  assert.doesNotMatch(html,/Tipp/);
});

test('Prüfungsmarkup enthält keine versteckte Lösungs-DOM',()=>{
  const html=ui.render(ACTIVE);
  assert.doesNotMatch(html,/data-sop-exam-solution/);
  assert.doesNotMatch(html,/aria-hidden="true"[^>]*>[^<]*(GEHEIM|Tipp|Ergebnis)/i);
  assert.doesNotMatch(html,/display\s*:\s*none[^>]*(GEHEIM|Tipp|Ergebnis)/i);
});

test('Prüfungsergebnis zeigt Bestanden oder Noch nicht bestanden mit neutraler Zusammenfassung',()=>{
  const passed=ui.render({...ACTIVE,status:'completed',passed:true,correctSteps:['abd-1','abd-2'],skippedSteps:[],errors:[],helpCount:0,finalStateOk:true});
  assert.match(passed,/✅\s*Bestanden/);
  assert.match(passed,/2\s+korrekte Schritte/);

  const failed=ui.render({...ACTIVE,status:'completed',passed:false,correctSteps:['abd-1'],skippedSteps:['abd-2'],errors:[{type:'WRONG_ACTION',stepId:'abd-2'}],helpCount:1,finalStateOk:false});
  assert.match(failed,/❌\s*Noch nicht bestanden/);
  assert.match(failed,/1\s+Fehler/);
  assert.match(failed,/1\s+ausgelassen/);
  assert.match(failed,/1\s+Hilfe/);
  assert.doesNotMatch(failed,/GEHEIME SCHRITTANWEISUNG|GEHEIMES ERGEBNIS|GEHEIMER TIPP|geheimes-ziel/);
});

test('Prüfungsmodus deaktiviert Zielhervorhebung vollständig',()=>{
  let adds=0;
  const element={classList:{add(){adds+=1;},remove(){}},scrollIntoView(){adds+=100;}};
  globalThis.ExportHubSopTourTargets={find(){return {ok:true,element};}};
  ui.highlightCurrent(ACTIVE);
  assert.equal(adds,0,'Exam darf kein Ziel markieren oder anspringen');
});

test('Exam CSS ist responsiv, fokussierbar und besitzt keine Lösungs-Versteckregeln',()=>{
  assert.ok(fs.existsSync('assets/sop/rc1503-sop-exam.css'),'Exam CSS fehlt');
  const css=fs.readFileSync('assets/sop/rc1503-sop-exam.css','utf8');
  assert.match(css,/\.rc1503-sop-exam/);
  assert.match(css,/@media\s*\(max-width:/);
  assert.match(css,/:focus-visible/);
  assert.doesNotMatch(css,/\.rc1503-sop-exam-solution\s*\{[^}]*display\s*:\s*none/is);
});
