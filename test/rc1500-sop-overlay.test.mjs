import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/sop/rc1500-sop-step-contract.js');
await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1500-sop-overlay.js');
const overlay=globalThis.ExportHubSopOverlay;

const base={
  number:'SOP-EH-060',title:'ABD',type:'process',status:'Freigegeben',version:'2.0',currentVersion:'2.0',
  sections:{steps:[{id:'a',text:'Prüfen'},{id:'b',text:'ABD anfordern'}]},
  versions:[{version:'2.0',status:'Freigegeben',title:'ABD',content:{steps:[{id:'a',text:'Prüfen'},{id:'b',text:'ABD anfordern'}]},visuals:[]}],auditTrail:[]
};
function customer(status='Freigegeben',ops=[]){
  return {
    number:'SOP-CUST-C1-060',title:'Kunde C1 ABD',type:'customer',customerId:'C1',baseProcessSop:'SOP-EH-060',
    status,version:'1.0',currentVersion:'1.0',
    versions:[{version:'1.0',status,title:'Kunde C1 ABD',content:{overlays:ops},visuals:[]}],auditTrail:[]
  };
}

test('wendet add-step deterministisch nach dem Zielschritt an und markiert Kundenursprung',()=>{
  assert.ok(overlay,'ExportHubSopOverlay fehlt');
  const result=overlay.resolve({documents:[base,customer('Freigegeben',[{action:'add-step',afterStepId:'a',step:{id:'customer-extra',text:'Kundenportal prüfen'}}])],baseSopNumber:'SOP-EH-060',customerId:'C1',rights:{read:true}});
  assert.equal(result.ok,true);
  assert.deepEqual(result.document.steps.map(step=>step.id),['a','customer-extra','b']);
  const added=result.document.steps.find(step=>step.id==='customer-extra');
  assert.equal(added.origin.type,'customer');
  assert.equal(added.origin.customerId,'C1');
});

test('skip-step markiert den Basisschritt sichtbar als nicht relevant statt ihn still zu löschen',()=>{
  const result=overlay.resolve({documents:[base,customer('Freigegeben',[{action:'skip-step',stepId:'b',reason:'Für C1 nicht erforderlich'}])],baseSopNumber:'SOP-EH-060',customerId:'C1',rights:{read:true}});
  assert.equal(result.ok,true);
  const step=result.document.steps.find(item=>item.id==='b');
  assert.equal(step.notRelevant,true);
  assert.equal(step.customerNote,'Für C1 nicht erforderlich');
});

test('enrich-step ergänzt Warnungen und Prüfungen ohne Kerninhalt zu überschreiben',()=>{
  const result=overlay.resolve({documents:[base,customer('Freigegeben',[{action:'enrich-step',stepId:'b',warnings:['C1-Frist beachten'],checks:[{type:'field-value',key:'country',value:'CH'}]}])],baseSopNumber:'SOP-EH-060',customerId:'C1',rights:{read:true}});
  assert.equal(result.ok,true);
  const step=result.document.steps.find(item=>item.id==='b');
  assert.equal(step.instruction,'ABD anfordern');
  assert.deepEqual(step.warnings,['C1-Frist beachten']);
  assert.equal(step.checks[0].type,'field-value');
});

test('fehlende Basis-SOP liefert expliziten Konflikt',()=>{
  const result=overlay.resolve({documents:[customer()],baseSopNumber:'SOP-EH-060',customerId:'C1',rights:{read:true}});
  assert.equal(result.ok,false);
  assert.ok(result.conflicts.some(item=>item.code==='BASE_NOT_FOUND'));
  assert.equal(result.document,null);
});

test('fehlender Zielschritt im Overlay ist Konflikt und verändert den Basisprozess nicht',()=>{
  const result=overlay.resolve({documents:[base,customer('Freigegeben',[{action:'skip-step',stepId:'missing'}])],baseSopNumber:'SOP-EH-060',customerId:'C1',rights:{read:true}});
  assert.equal(result.ok,false);
  assert.ok(result.conflicts.some(item=>item.code==='STEP_NOT_FOUND'));
  assert.deepEqual(result.document.steps.map(step=>step.id),['a','b']);
});

test('Leser erhalten keinen Draft-Overlay-Inhalt; Editoren dürfen ihn als Preview sehen',()=>{
  const draft=customer('Entwurf',[{action:'add-step',afterStepId:'a',step:{id:'draft-only',text:'Entwurf'}}]);
  const reader=overlay.resolve({documents:[base,draft],baseSopNumber:'SOP-EH-060',customerId:'C1',rights:{read:true}});
  assert.equal(reader.ok,true);
  assert.equal(reader.overlay,null);
  assert.deepEqual(reader.document.steps.map(step=>step.id),['a','b']);
  const editor=overlay.resolve({documents:[base,draft],baseSopNumber:'SOP-EH-060',customerId:'C1',rights:{read:true,edit:true}});
  assert.equal(editor.ok,true);
  assert.equal(editor.overlay.number,'SOP-CUST-C1-060');
  assert.equal(editor.preview,true);
  assert.ok(editor.document.steps.some(step=>step.id==='draft-only'));
});

test('mehrere freigegebene Overlays für denselben Kunden und Prozess werden nie willkürlich gewählt',()=>{
  const second={...customer(),number:'SOP-CUST-C1-060-B'};
  const result=overlay.resolve({documents:[base,customer(),second],baseSopNumber:'SOP-EH-060',customerId:'C1',rights:{read:true}});
  assert.equal(result.ok,false);
  assert.ok(result.conflicts.some(item=>item.code==='AMBIGUOUS_OVERLAY'));
  assert.equal(result.overlay,null);
  assert.deepEqual(result.document.steps.map(step=>step.id),['a','b']);
});

test('destruktives replace-step ist verboten und fail-closed',()=>{
  const result=overlay.resolve({documents:[base,customer('Freigegeben',[{action:'replace-step',stepId:'b',step:{id:'x',text:'Ersetzen'}}])],baseSopNumber:'SOP-EH-060',customerId:'C1',rights:{read:true}});
  assert.equal(result.ok,false);
  assert.ok(result.conflicts.some(item=>item.code==='UNSUPPORTED_DESTRUCTIVE_ACTION'));
  assert.deepEqual(result.document.steps.map(step=>step.id),['a','b']);
});
