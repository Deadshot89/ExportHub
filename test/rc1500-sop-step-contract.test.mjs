import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/sop/rc1500-sop-step-contract.js');
const contract=globalThis.ExportHubSopStepContract;

test('normalisiert Legacy-String ohne die Quelle zu verändern',()=>{
  assert.ok(contract,'ExportHubSopStepContract fehlt');
  const step=contract.normalizeStep('Kunde auswählen',0);
  assert.equal(step.id,'step-1');
  assert.equal(step.order,1);
  assert.equal(step.instruction,'Kunde auswählen');
  assert.equal(step.title,'');
  assert.deepEqual(step.checks,[]);
  assert.deepEqual(step.warnings,[]);
  assert.deepEqual(step.commonErrors,[]);
  assert.deepEqual(step.troubleshooting,[]);
  assert.deepEqual(step.visuals,[]);
  assert.equal(step.tour.enabled,false);
  assert.equal(step.training.enabled,false);
  assert.equal(step.exam.relevant,false);
});

test('übernimmt Legacy {id,text} in den Unified-Step-Vertrag',()=>{
  const source={id:'customer-select',text:'Kunde auswählen'};
  const before=JSON.stringify(source);
  const step=contract.normalizeStep(source,3);
  assert.equal(JSON.stringify(source),before);
  assert.equal(step.id,'customer-select');
  assert.equal(step.order,4);
  assert.equal(step.instruction,'Kunde auswählen');
});

test('erhält strukturierte Felder und ergänzt nur sichere Defaults',()=>{
  const source={
    id:'abd-request-07',order:7,title:'ABD öffnen',instruction:'Öffne ABD anfordern',page:'shipment',
    target:{type:'button',stableKey:'shipment-abd-request',selector:'[data-tour-key="shipment-abd-request"]'},
    expectedAction:'click',checks:[{type:'element-visible',key:'abd-dialog'}],expectedResult:'ABD-Dialog geöffnet',
    warnings:['Nur bei Bedarf'],tour:{enabled:true,highlight:true},training:{enabled:true,sideEffectPolicy:'sandbox'},
    exam:{relevant:true,weight:2,allowHint:false}
  };
  const step=contract.normalizeStep(source,0);
  assert.equal(step.id,'abd-request-07');
  assert.equal(step.order,7);
  assert.equal(step.target.type,'button');
  assert.equal(step.target.stableKey,'shipment-abd-request');
  assert.equal(step.tour.enabled,true);
  assert.equal(step.training.enabled,true);
  assert.equal(step.exam.relevant,true);
  assert.deepEqual(step.checks,source.checks);
  assert.notEqual(step.checks,source.checks);
});

test('stable Tourziel ohne Typ bleibt exakt stableKey plus selector und bekommt kein leeres type-Feld',()=>{
  const source={id:'abd-target',instruction:'ABD prüfen',target:{stableKey:'shipment-abd-decision',selector:'[data-tour-key="shipment-abd-decision"]'}};
  const step=contract.normalizeStep(source,0);
  assert.deepEqual(step.target,{stableKey:'shipment-abd-decision',selector:'[data-tour-key="shipment-abd-decision"]'});
  assert.equal(Object.prototype.hasOwnProperty.call(step.target,'type'),false);
});

test('expliziter nichtleerer Target-Typ bleibt für bestehende strukturierte SOPs erhalten',()=>{
  const step=contract.normalizeStep({id:'with-type',instruction:'Öffnen',target:{type:'button',stableKey:'open-key',selector:'[data-tour-key="open-key"]'}},0);
  assert.deepEqual(step.target,{type:'button',stableKey:'open-key',selector:'[data-tour-key="open-key"]'});
});

test('normalizeSteps liefert deterministische IDs',()=>{
  const steps=contract.normalizeSteps(['A','B',{text:'C'}]);
  assert.deepEqual(steps.map(step=>step.id),['step-1','step-2','step-3']);
});

test('validateSteps lehnt doppelte Step-IDs ab',()=>{
  const result=contract.validateSteps([{id:'dup',text:'A'},{id:'dup',text:'B'}]);
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(error=>/doppelt|duplicate/i.test(error)));
});
