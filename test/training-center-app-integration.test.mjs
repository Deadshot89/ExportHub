import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const files=[
  'assets/training-center/model.js',
  'assets/training-center/store.js',
  'assets/training-center/screenshots.js',
  'assets/training-center/catalog/shipment-registration.js',
  'assets/training-center/catalog/dhl-express.js',
  'assets/training-center/scenarios/first-shipment.js',
  'assets/training-center/ui.js',
  'assets/training-center/runtime.js'
];

function load(extra={}){
  const context={console,...extra};context.globalThis=context;vm.createContext(context);
  for(const file of files){
    assert.ok(fs.existsSync(file),`${file} fehlt`);
    vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  }
  return context;
}
function plain(value){return JSON.parse(JSON.stringify(value));}

test('bootstrapCenter startet leerem neuen State mit ausschließlich neuen eingebauten SOPs und Training',()=>{
  const g=load();
  const runtime=g.ExportHubTrainingCenterRuntime;
  assert.equal(typeof runtime.bootstrapCenter,'function','bootstrapCenter fehlt');
  const center=plain(runtime.bootstrapCenter({
    isoSops:[{number:'SOP-EH-OLD',title:'ALT'}],
    sopLearningProgress:[{trainingId:'ALT'}],
    customSops:[{id:'ALT'}]
  }));
  assert.deepEqual(center.standardProcesses.map(item=>item.id),['shipment-registration','dhl-express-registration']);
  assert.deepEqual(center.trainings.map(item=>item.id),['first-shipment']);
  assert.equal(center.screenshots.length,17);
  assert.ok(center.categories.some(item=>item.id==='shipping'));
  assert.ok(center.categories.some(item=>item.id==='training'));
  assert.doesNotMatch(JSON.stringify(center),/SOP-EH-OLD|"ALT"/);
});

test('bootstrapCenter erhält ausschließlich neue persistierte Center-Daten und dedupliziert eingebaute Datensätze',()=>{
  const g=load();
  const runtime=g.ExportHubTrainingCenterRuntime;
  const center=plain(runtime.bootstrapCenter({
    sopTrainingCenter:{
      version:3,
      standardProcesses:[{...plain(g.ExportHubShipmentRegistrationSop),title:'Neue persistierte Fassung'}],
      customerSops:[{id:'customer-new',customerId:'C1',baseProcessId:'shipment-registration',title:'Neue Abweichung'}],
      trainings:[],categories:[{id:'custom',title:'Eigene Kategorie'}],favorites:['shipment-registration'],recents:[],screenshots:[],learningProgress:[]
    },
    isoSops:[{number:'LEGACY'}]
  }));
  assert.equal(center.version,3);
  assert.equal(center.standardProcesses.filter(item=>item.id==='shipment-registration').length,1);
  assert.equal(center.standardProcesses.find(item=>item.id==='shipment-registration').title,'Neue persistierte Fassung');
  assert.ok(center.standardProcesses.some(item=>item.id==='dhl-express-registration'));
  assert.ok(center.customerSops.some(item=>item.id==='customer-new'));
  assert.ok(center.categories.some(item=>item.id==='custom'));
  assert.ok(center.trainings.some(item=>item.id==='first-shipment'));
  assert.equal(center.screenshots.length,17);
});

test('Runtime exponiert start/stop für die echte sop-Route und keinen Legacy-Kompatibilitätsalias',()=>{
  const g=load();
  const runtime=g.ExportHubTrainingCenterRuntime;
  assert.equal(typeof runtime.start,'function','start fehlt');
  assert.equal(typeof runtime.stop,'function','stop fehlt');
  assert.equal(g.ExportHubSopCoverageDashboard,undefined);
  assert.equal(g.ExportHubIsoSopCatalog,undefined);
  const source=fs.readFileSync('assets/training-center/runtime.js','utf8');
  assert.doesNotMatch(source,/rc1007|ExportHubIsoSop|isoSops|ExportHubSopCoverageDashboard|assets\/sop\//i);
  assert.match(source,/data-exporthub-view/);
  assert.match(source,/ExportHubTrainingCoverageDashboard/);
});
