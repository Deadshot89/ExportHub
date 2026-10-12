import test from 'node:test';
import assert from 'node:assert/strict';
await import('../assets/sop/rc1500-sop-step-contract.js');
await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1007-sop-catalog.js');
await import('../assets/sop/rc1016-sop-consolidation.js');
await import('../assets/sop/rc1500-sop-overlay.js');
await import('../assets/sop/rc1501-sop-tour-targets.js');
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

function targetElement(key){
  return {
    getAttribute(name){return name==='data-tour-key'?key:'';},
    closest(selector){return selector==='[data-tour-key]'?this:null;}
  };
}
function targetScope(elements=[]){
  const listeners=new Map();
  return {
    listeners,
    addEventListener(name,handler,capture){listeners.set(name,{handler,capture});},
    removeEventListener(name,handler){const item=listeners.get(name);if(item&&item.handler===handler)listeners.delete(name);},
    querySelectorAll(selector){
      const match=String(selector).match(/data-tour-key="([^"]+)"/);
      const key=match?match[1]:'';
      return elements.filter(element=>element.getAttribute('data-tour-key')===key);
    }
  };
}

test('Target Picker übernimmt ausschließlich data-tour-key und speichert stableKey plus abgeleiteten Selector im Draft-Step',()=>{
  assert.equal(typeof editor.beginTargetPick,'function','beginTargetPick fehlt');
  assert.equal(typeof editor.cancelTargetPick,'function','cancelTargetPick fehlt');
  let doc=editor.createDraft(released(),{version:'2.1',actor:'Admin',reason:'Tourziel pflegen'});
  const stepId=current(doc,'2.1').content.steps[0].id;
  const element=targetElement('shipment-abd-decision');
  const scope=targetScope([element]);
  let selected=null;
  const state=editor.beginTargetPick(stepId,{document:doc,version:'2.1',scope,onSelected(result){selected=result;}});
  assert.equal(state.active,true);
  assert.equal(state.stepId,stepId);
  const click=scope.listeners.get('click');
  assert.ok(click&&click.capture===true,'Picker muss Clicks im Capture-Modus beobachten');
  click.handler({target:element,preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}});
  assert.ok(selected,'Auswahl wurde nicht gemeldet');
  doc=selected.document;
  const step=current(doc,'2.1').content.steps.find(item=>item.id===stepId);
  assert.deepEqual(step.target,{stableKey:'shipment-abd-decision',selector:'[data-tour-key="shipment-abd-decision"]'});
  assert.equal(scope.listeners.has('click'),false,'Picker wurde nach erfolgreicher Auswahl nicht beendet');
});

test('Target Picker bleibt fail-closed wenn angeklicktes Element keinen data-tour-key besitzt',()=>{
  const scope=targetScope([]);
  let error=null;
  const noKey={getAttribute(){return'';},closest(){return null;}};
  const doc=editor.createDraft(released(),{version:'2.1',actor:'Admin',reason:'Tourziel pflegen'});
  const stepId=current(doc,'2.1').content.steps[0].id;
  editor.beginTargetPick(stepId,{document:doc,version:'2.1',scope,onError(result){error=result;}});
  scope.listeners.get('click').handler({target:noKey,preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}});
  assert.equal(error.code,'TARGET_KEY_REQUIRED');
  assert.equal(scope.listeners.has('click'),true,'Picker darf bei ungültigem Klick nicht still beendet werden');
  assert.equal(editor.cancelTargetPick().cancelled,true);
  assert.equal(scope.listeners.has('click'),false);
});

test('testTarget unterscheidet eindeutiges fehlendes und doppeltes Tourziel',()=>{
  assert.equal(typeof editor.testTarget,'function','testTarget fehlt');
  const one=targetElement('shipment-documents');
  const duplicate=targetElement('shipment-documents');
  assert.deepEqual(editor.testTarget('shipment-documents',targetScope([one])),{ok:true,status:'unique',stableKey:'shipment-documents',error:null});
  assert.deepEqual(editor.testTarget('shipment-documents',targetScope([])),{ok:false,status:'missing',stableKey:'shipment-documents',error:'TARGET_NOT_FOUND'});
  assert.deepEqual(editor.testTarget('shipment-documents',targetScope([one,duplicate])),{ok:false,status:'duplicate',stableKey:'shipment-documents',error:'TARGET_AMBIGUOUS'});
});
