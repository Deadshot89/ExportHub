import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const files=[
  'assets/training-center/coverage-registry.js',
  'assets/training-center/coverage.js',
  'assets/training-center/coverage-dashboard.js'
];

function load(){
  const context={};context.globalThis=context;vm.createContext(context);
  for(const file of files){
    assert.ok(fs.existsSync(file),`${file} fehlt`);
    vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  }
  return context;
}

function completeStep(stepId='shipment-new'){
  return {
    stepId,
    title:'Schritt',
    shortInstruction:'Kurz',
    explanation:'Erklärung',
    purpose:'Zweck',
    checkpoints:['Prüfung'],
    commonErrors:['Fehler'],
    warnings:['Hinweis'],
    targetElement:'shipment.new',
    expectedAction:'click',
    validation:['ok'],
    helpText:'Hilfe',
    successText:'Erfolg',
    screenshotId:stepId
  };
}

function centerFixture(){
  const shipmentSteps=[completeStep('shipment-new'),completeStep('shipment-abd')];
  return {
    version:1,
    standardProcesses:[{
      id:'shipment-registration',
      title:'Sendung in ExportHUB360 anmelden',
      version:'1.0',
      status:'released',
      categoryId:'shipping',
      steps:shipmentSteps,
      screenshotIds:['shipment-new','shipment-abd'],
      trainingScenarioIds:['first-shipment']
    }],
    customerSops:[],
    trainings:[{id:'first-shipment',processId:'shipment-registration',steps:[{stepId:'first-shipment-new',targetElement:'shipment.new'}]}],
    screenshots:[
      {id:'shipment-new',processId:'shipment-registration',stepId:'shipment-new',src:'/assets/training-center/screenshots/shipment-new.png'},
      {id:'shipment-abd',processId:'shipment-registration',stepId:'shipment-abd',src:'/assets/training-center/screenshots/shipment-abd.png'}
    ],
    categories:[],favorites:[],recents:[],learningProgress:[]
  };
}

test('neue Coverage Registry enthält exakt 25 Kernprozesse ohne Legacy-SOPMaster-Abhängigkeit',()=>{
  const g=load();
  const registry=g.ExportHubTrainingCoverageRegistry;
  assert.ok(registry,'ExportHubTrainingCoverageRegistry fehlt');
  assert.equal(registry.entries.length,25);
  assert.equal(new Set(registry.entries.map(item=>item.id)).size,25,'IDs müssen eindeutig sein');
  assert.ok(registry.entries.some(item=>item.id==='shipments.create'&&item.standardProcessId==='shipment-registration'));
  assert.ok(registry.entries.some(item=>item.id==='shipment.abd-decision'&&item.requiredStepId==='shipment-abd'));
  const source=files.map(file=>fs.readFileSync(file,'utf8')).join('\n');
  assert.doesNotMatch(source,/ExportHubIsoSop|isoSops|ExportHubSopFunctionRegistry|assets\/sop\//i);
});

test('Coverage bewertet ausschließlich neue Training-Center-Daten und zählt den 25er Sollkatalog',()=>{
  const g=load();
  const result=g.ExportHubTrainingCoverage.scan(centerFixture());
  assert.equal(result.counts.total,25);
  assert.equal(result.counts.complete,2,'Sendung anlegen und ABD-Entscheidung werden durch die neue Standard-SOP abgedeckt');
  assert.equal(result.counts.missing,23);
  assert.equal(result.counts.incomplete,0);
  assert.equal(result.counts.tour,2);
  assert.equal(result.counts.image,2);
  assert.equal(result.percentage,8);
});

test('fehlende Bilder machen eine vorhandene SOP unvollständig, eine fehlende Tour bleibt eine separate Fähigkeit',()=>{
  const g=load();
  const center=centerFixture();
  center.screenshots=[];
  center.trainings=[];
  const result=g.ExportHubTrainingCoverage.scan(center);
  const create=result.items.find(item=>item.id==='shipments.create');
  assert.equal(create.status,'incomplete');
  assert.equal(create.capabilities.image,false);
  assert.equal(create.capabilities.tour,false);
  assert.ok(create.reasons.includes('IMAGE_MISSING'));
  assert.ok(!create.reasons.includes('TOUR_MISSING'),'Tour darf den SOP-Hauptstatus nicht pauschal blockieren');
});

test('Kundenfilter bleibt erhalten und wertet nur neue customerSops aus',()=>{
  const g=load();
  const center=centerFixture();
  center.customerSops=[{id:'customer-1',customerId:'C1',baseProcessId:'shipment-registration',title:'Kundenabweichung',status:'released'}];
  const result=g.ExportHubTrainingCoverage.scan(center,{customerId:'C1'});
  const create=result.items.find(item=>item.id==='shipments.create');
  assert.equal(create.customerOverlay.present,true);
  assert.equal(create.customerOverlay.id,'customer-1');
});

test('Coverage Dashboard behält KPI- und Filterlayout, verwendet aber die neue Bezeichnung',()=>{
  const g=load();
  const model=g.ExportHubTrainingCoverageDashboard.buildModel(centerFixture());
  const html=g.ExportHubTrainingCoverageDashboard.render(model);
  for(const text of ['SOP & Training Center Coverage','Abdeckungsquote','SOP fehlt','SOP unvollständig','SOP vollständig','Tour vorhanden','Bildanleitung vorhanden','Bereich','Status','Kunde','Fähigkeit','Filter zurücksetzen']){
    assert.match(html,new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
  assert.match(html,/8%/);
  assert.match(html,/data-coverage-filter="area"/);
  assert.match(html,/data-coverage-filter="status"/);
  assert.match(html,/data-coverage-filter="customer"/);
  assert.match(html,/data-coverage-filter="capability"/);
});

test('Filterlogik arbeitet auf neuem Coverage-Modell ohne Layoutänderung',()=>{
  const g=load();
  const model=g.ExportHubTrainingCoverageDashboard.buildModel(centerFixture());
  const green=g.ExportHubTrainingCoverageDashboard.filterItems(model.items,{status:'complete'});
  assert.equal(green.length,2);
  const tours=g.ExportHubTrainingCoverageDashboard.filterItems(model.items,{capability:'tour'});
  assert.equal(tours.length,2);
  const shipping=g.ExportHubTrainingCoverageDashboard.filterItems(model.items,{area:'Sendungen'});
  assert.ok(shipping.length>=2);
});
