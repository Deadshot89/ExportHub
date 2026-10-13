import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../assets/sop/rc1503-sop-training.js');
await import('../assets/sop/rc1501-sop-tour-ui.js');
const ui=globalThis.ExportHubSopTourUi;

const SOP={number:'SOP-EH-060',title:'ABD Prozess',steps:[{id:'abd-1',instruction:'ABD Bedarf prüfen',tour:{enabled:true}}]};
const SESSION={sopNumber:'SOP-EH-060',title:'ABD Prozess',version:'2.0',mode:'training',status:'active',index:0,total:1,stepNumber:1,percent:0,currentStep:{id:'abd-1',instruction:'ABD Bedarf prüfen',warnings:['Nur Demo-Daten verwenden']}};

test('SOP mit Tour bietet Anleitung und Training als getrennte Aktionen an',()=>{
  const html=ui.startButtonHtml(SOP);
  assert.match(html,/data-sop-tour-start="SOP-EH-060"/);
  assert.match(html,/Anleitung starten/);
  assert.match(html,/data-sop-training-start="SOP-EH-060"/);
  assert.match(html,/Training starten/);
});

test('Training rendert einen vollwertigen Trainingsmodus-Hinweis statt eines kleinen Badges',()=>{
  const html=ui.render(SESSION);
  assert.match(html,/data-sop-training-banner/);
  assert.match(html,/TRAININGSMODUS/);
  assert.match(html,/Keine produktiven Daten werden verändert/);
  assert.match(html,/data-sop-training-simulation-label/);
  assert.match(html,/Simulation/);
  assert.match(html,/ABD Bedarf prüfen/);
  assert.match(html,/Nur Demo-Daten verwenden/);
});

test('normale Anleitung erhält keinen Trainingsbanner',()=>{
  const html=ui.render({...SESSION,mode:'guided'});
  assert.doesNotMatch(html,/data-sop-training-banner/);
  assert.doesNotMatch(html,/data-sop-training-simulation-label/);
});

test('Training CSS ist vollbreit responsiv und klar sichtbar',()=>{
  assert.ok(fs.existsSync('assets/sop/rc1503-sop-training.css'),'Training CSS fehlt');
  const css=fs.readFileSync('assets/sop/rc1503-sop-training.css','utf8');
  assert.match(css,/\.rc1503-sop-training-banner/);
  assert.match(css,/width:\s*100%/);
  assert.match(css,/\.rc1503-sop-training-simulation/);
  assert.match(css,/@media\s*\(max-width:/);
  assert.match(css,/:focus-visible/);
});

test('Tour Runtime besitzt expliziten Demo-Trainingspfad und startet außerhalb Demo nicht lokal',()=>{
  const source=fs.readFileSync('assets/sop/rc1501-sop-tour-runtime.js','utf8');
  assert.match(source,/data-sop-training-start/);
  assert.match(source,/ExportHubSopTraining/);
  assert.match(source,/demo\.html/);
  assert.match(source,/sopTraining/);
  assert.match(source,/TRAINING_DEMO_ONLY|environment.*demo/s);
});

test('Demo-Einstieg kann Trainings-SOP aus der URL aufnehmen',()=>{
  const source=fs.readFileSync('assets/sop/rc1501-sop-tour-runtime.js','utf8');
  assert.match(source,/searchParams\.get\(['"]sopTraining['"]\)/);
  assert.match(source,/startTrainingByNumber/);
});
