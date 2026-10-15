import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scenarioPath='assets/training-center/scenarios/first-shipment.js';
const runtimeFiles=[
  'assets/training-center/training-state.js',
  'assets/training-center/demo-adapter.js',
  'assets/training-center/training-write-guard.js',
  'assets/training-center/training-controller.js',
  'assets/training-center/tour-engine.js'
];

const plain=value=>JSON.parse(JSON.stringify(value));

function contextWith(files=[]){
  const context={};
  context.globalThis=context;
  vm.createContext(context);
  for(const file of files)vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  return context;
}

function loadScenario(){
  assert.ok(fs.existsSync(scenarioPath),'Trainingsszenario „Meine erste Sendung“ fehlt');
  const context=contextWith();
  vm.runInContext(fs.readFileSync(scenarioPath,'utf8'),context,{filename:scenarioPath});
  assert.ok(context.ExportHubTrainingScenarioFirstShipment,'ExportHubTrainingScenarioFirstShipment fehlt');
  return context.ExportHubTrainingScenarioFirstShipment;
}

const expected=[
  ['first-shipment-new','Neue Sendung öffnen','shipment.new','click','shipment-new-opened'],
  ['first-shipment-customer','Demo-Kunden auswählen','shipment.customer-search','select','demo-customer-selected'],
  ['first-shipment-location','Empfänger prüfen','shipment.location','select','demo-location-selected'],
  ['first-shipment-details','Sendungsdaten erfassen','shipment.details','input','shipment-details-valid'],
  ['first-shipment-colli','Colli erfassen','shipment.colli','input','colli-valid'],
  ['first-shipment-weight','Gewicht erfassen','shipment.weight','input','weight-valid'],
  ['first-shipment-documents','Dokumente kontrollieren','shipment.documents','confirm','documents-reviewed'],
  ['first-shipment-missing-document','Fehlendes Dokument erkennen','shipment.documents','confirm','missing-document-detected'],
  ['first-shipment-review','Sendungsprüfung durchführen','shipment.review','confirm','shipment-review-complete'],
  ['first-shipment-abd','Zoll-/ABD-Pflicht beurteilen','shipment.abd-decision','decision','abd-decision-correct'],
  ['first-shipment-customs','Beispiel-Zollinformationen prüfen','shipment.customs','confirm','customs-info-reviewed'],
  ['first-shipment-save','Sendung fertigstellen','shipment.save','save-demo','shipment-demo-saved'],
  ['first-shipment-result','Ergebnis kontrollieren','shipment.status','confirm','result-reviewed']
];

test('„Meine erste Sendung“ enthält exakt die 13 freigegebenen Trainingsschritte in Reihenfolge',()=>{
  const scenario=loadScenario();
  assert.equal(scenario.id,'first-shipment');
  assert.equal(scenario.title,'Meine erste Sendung');
  assert.equal(scenario.processId,'shipment-registration');
  assert.equal(scenario.version,'1.0');
  assert.equal(scenario.steps.length,13);
  assert.deepEqual(plain(scenario.steps.map(step=>[step.stepId,step.title,step.targetElement,step.expectedAction,step.validation?.[0]])),expected);
  scenario.steps.forEach((step,index)=>{
    assert.equal(step.order,index+1);
    assert.equal(step.nextStep,index<scenario.steps.length-1?scenario.steps[index+1].stepId:null);
    assert.ok(step.helpText);
    assert.ok(step.successText);
  });
});

test('Demo-Seed enthält nur eindeutig markierte Beispiel-Geschäftsdaten inklusive absichtlich fehlendem Dokument',()=>{
  const scenario=loadScenario();
  const seed=plain(scenario.demoSeed);
  assert.equal(seed.__trainingDemo,true);
  assert.match(seed.customer.id,/^DEMO-/);
  assert.match(seed.location.id,/^DEMO-/);
  assert.match(seed.shipment.id,/^DEMO-/);
  assert.ok(Array.isArray(seed.colli)&&seed.colli.length>0);
  assert.ok(Array.isArray(seed.documents)&&seed.documents.length>=2);
  const missing=seed.documents.filter(doc=>doc.status==='missing');
  assert.equal(missing.length,1,'genau ein Dokument muss absichtlich fehlen');
  assert.ok(seed.customs&&seed.customs.demo===true);
  assert.equal(seed.abdDecision.required,true);
  assert.equal(seed.shipment.saved,false);
});

test('Fehlendes Dokument und ABD/Zoll-Entscheidung sind deterministisch validierbar',()=>{
  const scenario=loadScenario();
  const byId=Object.fromEntries(scenario.steps.map(step=>[step.stepId,step]));
  assert.deepEqual(plain(byId['first-shipment-missing-document'].validation),['missing-document-detected']);
  assert.deepEqual(plain(byId['first-shipment-abd'].validation),['abd-decision-correct']);
  assert.deepEqual(plain(byId['first-shipment-customs'].validation),['customs-info-reviewed']);
  assert.equal(byId['first-shipment-save'].expectedAction,'save-demo');
});

test('kompletter 13-Schritt-Ablauf avanciert nur mit korrekter Aktion und bleibt memory-only',()=>{
  const context=contextWith(runtimeFiles);
  vm.runInContext(fs.readFileSync(scenarioPath,'utf8'),context,{filename:scenarioPath});
  const scenario=context.ExportHubTrainingScenarioFirstShipment;
  const state=context.ExportHubTrainingState;
  const controller=context.ExportHubTrainingController;
  const engine=context.ExportHubTrainingTourEngine;
  const guard=context.ExportHubTrainingWriteGuard;

  controller.start(scenario);
  engine.start({scenario});
  const before=state.snapshot();
  assert.equal(before.__trainingDemo,true);

  for(const step of scenario.steps){
    const wrong=engine.handleAction({action:'wrong',targetElement:step.targetElement,validation:{[step.validation[0]]:true}});
    assert.equal(wrong.advanced,false);
    const descriptor={action:step.expectedAction,targetElement:step.targetElement,validation:{[step.validation[0]]:true}};
    const result=engine.handleAction(descriptor);
    assert.equal(result.advanced,true,`Schritt muss avancieren: ${step.stepId}`);
    if(step.stepId==='first-shipment-save'){
      const write=guard.execute({mode:'training',operation:'shipment.save',payload:{id:'DEMO-SHIP-001',saved:true,status:'Erstellt'}});
      assert.equal(write.persisted,false);
    }
  }

  assert.equal(engine.current().finished,true);
  assert.equal(state.snapshot().shipment.saved,true);
  controller.end();
  assert.equal(state.snapshot(),null);
});
