import test from 'node:test';
import assert from 'node:assert/strict';

for(const name of ['ExportHubTrainingTargetRegistry','ExportHubShipmentTrainingTargets'])delete globalThis[name];
await import('../assets/training-center/target-registry.js').catch(()=>{});
await import('../assets/training-center/integration/shipment-targets.js').catch(()=>{});

const Registry=globalThis.ExportHubTrainingTargetRegistry;
const shipment=globalThis.ExportHubShipmentTrainingTargets;

function element(id){
  const attrs=new Map();
  return {id,attrs,setAttribute:(key,value)=>attrs.set(key,String(value)),getAttribute:(key)=>attrs.get(key)||null};
}
function rootFrom(map){
  return {querySelectorAll(selector){return map.get(selector)||[];}};
}

test('TargetRegistry registriert stabile Resolver und liefert genau ein Ziel',()=>{
  assert.ok(Registry,'ExportHubTrainingTargetRegistry fehlt');
  const registry=Registry.create();
  const target=element('one');
  registry.register('shipment.new',(root)=>root.querySelectorAll('#new'));
  assert.equal(registry.find('shipment.new',rootFrom(new Map([['#new',[target]]]))),target);
  assert.deepEqual(registry.keys(),['shipment.new']);
});

test('TargetRegistry lehnt doppelte Keys, fehlende und mehrdeutige Ziele fail-closed ab',()=>{
  assert.ok(Registry,'ExportHubTrainingTargetRegistry fehlt');
  const registry=Registry.create();
  registry.register('shipment.new',(root)=>root.querySelectorAll('#new'));
  assert.throws(()=>registry.register('shipment.new',()=>[]),/TRAINING_TARGET_KEY_DUPLICATE/);
  assert.throws(()=>registry.find('shipment.new',rootFrom(new Map([['#new',[]]]))),/TRAINING_TARGET_MISSING/);
  assert.throws(()=>registry.find('shipment.new',rootFrom(new Map([['#new',[element('a'),element('b')]]]))),/TRAINING_TARGET_AMBIGUOUS/);
  assert.throws(()=>registry.find('unknown',rootFrom(new Map())),/TRAINING_TARGET_KEY_UNKNOWN/);
});

test('Shipment-Integration enthält die aktuellen produktiven Kernselektoren und annotiert sie nur mit data-training-target',()=>{
  assert.ok(Registry&&shipment,'Shipment Training Targets fehlen');
  const required={
    'shipment.new':'#rc380NewShipment',
    'shipment.customer-search':'#shipmentCustomerSearch',
    'shipment.location':'#index289LocationSelect',
    'shipment.customer-block':'#rc363BlockCustomer',
    'shipment.colli':'#rc573ColliCard',
    'shipment.weight':'#rc363WeightModal',
    'shipment.documents':'#rc363BlockDocuments',
    'shipment.abd-decision':'#rc363BlockAbdDecision',
    'shipment.save':'#rc363SaveShipment'
  };
  for(const [key,selector] of Object.entries(required))assert.equal(shipment.selectors[key],selector,key);

  const map=new Map();
  const elements={};
  for(const [key,selector] of Object.entries(required)){elements[key]=element(key);map.set(selector,[elements[key]]);}
  const registry=Registry.create();
  shipment.register(registry);
  const annotated=shipment.annotate(rootFrom(map),registry);
  assert.equal(annotated.length,Object.keys(required).length);
  for(const key of Object.keys(required))assert.equal(elements[key].getAttribute('data-training-target'),key);
});

test('Shipment-Integration verwendet keine Bildschirmkoordinaten und verändert keine produktiven Handler',()=>{
  assert.ok(shipment,'Shipment Training Targets fehlen');
  const serialized=JSON.stringify(shipment.selectors);
  assert.doesNotMatch(serialized,/\bx\b|\by\b|top|left|coordinate/i);
  const source=shipment.sourceContract();
  assert.doesNotMatch(source,/onclick\s*=|addEventListener|\.click\(/);
});
