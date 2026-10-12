import test from 'node:test';
import assert from 'node:assert/strict';
await import('../assets/sop/rc1500-sop-step-contract.js');
await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1007-sop-catalog.js');
await import('../assets/sop/rc1016-sop-consolidation.js');
await import('../assets/sop/rc1500-sop-overlay.js');
await import('../assets/sop/rc1502-sop-visuals.js');
await import('../assets/sop/rc1502-sop-editor.js').catch(()=>{});

const model=globalThis.ExportHubIsoSopModel;
const catalog=globalThis.ExportHubIsoSopCatalog;
const editor=globalThis.ExportHubSopEditor;

function released(number='SOP-EH-060'){
  const source=catalog.get(number);
  assert.ok(source,`${number} fehlt`);
  return model.seedState({},[source]).isoSops[0];
}
function current(doc,version){
  const wanted=version||doc.draftVersion||doc.currentVersion;
  return (doc.versions||[]).find(item=>item.version===wanted);
}

test('Editor API ist vorhanden und erzeugt Draft ohne freigegebene Historie zu verändern',()=>{
  assert.ok(editor,'ExportHubSopEditor fehlt');
  const source=released();
  const before=JSON.stringify(source.versions);
  const next=editor.createDraft(source,{version:'2.1',actor:'Admin',reason:'Arbeitsablauf präzisieren'});
  assert.equal(JSON.stringify(source.versions),before,'Quelle wurde mutiert');
  assert.equal(next.draftVersion,'2.1');
  assert.equal(current(next,'2.0').status,'Freigegeben');
  assert.equal(current(next,'2.1').status,'Entwurf');
});

test('addStep moveStep updateStep und removeStep arbeiten nur auf Draft und erhalten stabile IDs',()=>{
  let doc=editor.createDraft(released(),{version:'2.1',actor:'Admin',reason:'Schritte pflegen'});
  const originalReleased=JSON.stringify(current(doc,'2.0').content.steps);
  const firstId=current(doc,'2.1').content.steps[0].id;
  doc=editor.addStep(doc,{version:'2.1',step:{id:'step-extra',title:'Zusatzprüfung',instruction:'Zusatzprüfung durchführen.'},afterStepId:firstId});
  assert.equal(current(doc,'2.1').content.steps[1].id,'step-extra');
  doc=editor.updateStep(doc,{version:'2.1',stepId:'step-extra',patch:{instruction:'Zusatzprüfung dokumentieren.',expectedResult:'Dokumentiert'}});
  assert.equal(current(doc,'2.1').content.steps.find(step=>step.id==='step-extra').expectedResult,'Dokumentiert');
  doc=editor.moveStep(doc,{version:'2.1',stepId:'step-extra',toIndex:0});
  assert.equal(current(doc,'2.1').content.steps[0].id,'step-extra');
  doc=editor.removeStep(doc,{version:'2.1',stepId:'step-extra'});
  assert.equal(current(doc,'2.1').content.steps.some(step=>step.id==='step-extra'),false);
  assert.equal(JSON.stringify(current(doc,'2.0').content.steps),originalReleased,'Freigegebene Fassung wurde verändert');
  assert.throws(()=>editor.addStep(released(),{step:{id:'x',instruction:'x'}}),/Entwurf|Draft/i);
});

test('copyDocument erzeugt unabhängigen Entwurf mit neuer Nummer und unveränderter Quelle',()=>{
  const source=released('SOP-EH-100');
  const snapshot=JSON.stringify(source);
  const copy=editor.copyDocument(source,{number:'SOP-COPY-100',title:'Kopie SOP-Handbuch',version:'1.0',actor:'Admin',reason:'Vorlage'});
  assert.equal(JSON.stringify(source),snapshot);
  assert.equal(copy.number,'SOP-COPY-100');
  assert.equal(copy.title,'Kopie SOP-Handbuch');
  assert.equal(copy.currentVersion,'1.0');
  assert.equal(copy.draftVersion,'1.0');
  assert.equal(copy.versions[0].status,'Entwurf');
  assert.notEqual(copy.id,source.id);
});

test('createCustomerOverlay legt versioniertes Kunden-Overlay gegen die Basis-SOP an',()=>{
  const base=released('SOP-EH-060');
  const overlay=editor.createCustomerOverlay(base,{number:'SOP-CUST-060-9000003019',customerId:'9000003019',version:'1.0',actor:'Admin',reason:'Kundenspezifische ABD-Prüfung'});
  assert.equal(overlay.type,'customer');
  assert.equal(overlay.baseProcessSop,'SOP-EH-060');
  assert.equal(overlay.customerId,'9000003019');
  assert.equal(overlay.draftVersion,'1.0');
  assert.equal(overlay.versions[0].status,'Entwurf');
  assert.deepEqual(overlay.versions[0].content.overlays,[]);
});

test('assignVisual bindet Screenshot nur an existierenden Draft-Step und erhält Released-Visuals',()=>{
  let doc=editor.createDraft(released('SOP-EH-060'),{version:'2.1',actor:'Admin',reason:'Bild ergänzen'});
  const releasedVisuals=JSON.stringify(current(doc,'2.0').visuals||[]);
  const stepId=current(doc,'2.1').content.steps[0].id;
  doc=editor.assignVisual(doc,{version:'2.1',stepId,visual:{type:'screenshot',src:'/assets/sop/screenshots/rc1018-abd.png',caption:'ABD prüfen',order:2}});
  const draft=current(doc,'2.1');
  const assigned=(draft.visuals||[]).find(v=>v.stepId===stepId&&v.caption==='ABD prüfen');
  assert.ok(assigned,'Visual wurde nicht zugeordnet');
  assert.equal(assigned.src,'/assets/sop/screenshots/rc1018-abd.png');
  assert.equal(JSON.stringify(current(doc,'2.0').visuals||[]),releasedVisuals);
  assert.throws(()=>editor.assignVisual(doc,{version:'2.1',stepId:'step-fehlt',visual:{type:'screenshot',src:'/assets/sop/screenshots/rc1018-abd.png'}}),/Schritt|step/i);
});

test('Editor-Validierung meldet Draft-Probleme statt sie still zu speichern',()=>{
  let doc=editor.createDraft(released(),{version:'2.1',actor:'Admin',reason:'Validierung'});
  doc=editor.addStep(doc,{version:'2.1',step:{id:'duplicate-test',instruction:'A'}});
  assert.throws(()=>editor.addStep(doc,{version:'2.1',step:{id:'duplicate-test',instruction:'B'}}),/doppelt|existiert/i);
  const summary=editor.validateDraft(doc,{version:'2.1'});
  assert.equal(summary.ok,true);
  assert.equal(summary.version,'2.1');
  assert.ok(Array.isArray(summary.errors));
  assert.ok(Array.isArray(summary.warnings));
});
